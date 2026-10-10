import { Prisma } from "@prisma/client";
import type { Transfer } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isGreaterThan, round2 } from "@/lib/money";
import { badRequest, conflict, notFound } from "@/lib/http";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { lockBankAccount, postTransaction, reverseTransaction } from "@/lib/ledger";
import type { TransferInput } from "@/lib/validation";
import {
  dateRange,
  enumList,
  pagination,
  RawSearchParams,
  sort,
  str,
} from "@/lib/filters";

/**
 * Transferencia entre contas/caixas da mesma empresa.
 * Gera dois lancamentos (saida na origem, entrada no destino) de forma atomica,
 * bloqueando ambas as contas em ordem deterministica para evitar deadlock.
 */
export async function createTransfer(
  companyId: string,
  userId: string | null,
  input: TransferInput,
): Promise<Transfer> {
  const amount = round2(input.amount);
  if (!isGreaterThan(amount, 0)) {
    throw badRequest("O valor da transferencia deve ser maior que zero.");
  }
  if (input.fromBankAccountId === input.toBankAccountId) {
    throw badRequest("A conta de origem e destino devem ser diferentes.");
  }

  // Ordem deterministica de bloqueio.
  const lockOrder = [input.fromBankAccountId, input.toBankAccountId].sort();

  return prisma.$transaction(async (tx) => {
    await lockBankAccount(tx, companyId, lockOrder[0]);
    await lockBankAccount(tx, companyId, lockOrder[1]);

    const transfer = await tx.transfer.create({
      data: {
        companyId,
        fromBankAccountId: input.fromBankAccountId,
        toBankAccountId: input.toBankAccountId,
        amount,
        date: input.date,
        description: input.description ?? null,
        status: "COMPLETED",
        createdById: userId,
      },
    });

    const outTx = await postTransaction(tx, {
      companyId,
      bankAccountId: input.fromBankAccountId,
      type: "OUTFLOW",
      origin: "TRANSFER",
      amount,
      date: input.date,
      description: input.description ?? "Transferencia enviada",
      transferId: transfer.id,
      createdById: userId,
    });

    const inTx = await postTransaction(tx, {
      companyId,
      bankAccountId: input.toBankAccountId,
      type: "INFLOW",
      origin: "TRANSFER",
      amount,
      date: input.date,
      description: input.description ?? "Transferencia recebida",
      transferId: transfer.id,
      createdById: userId,
    });

    const updated = await tx.transfer.update({
      where: { id: transfer.id },
      data: { outTransactionId: outTx.id, inTransactionId: inTx.id },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.TRANSFER,
      entity: "Transfer",
      entityId: transfer.id,
      after: updated,
    });

    return updated;
  });
}

export async function reverseTransfer(
  companyId: string,
  userId: string | null,
  transferId: string,
  reason: string,
): Promise<Transfer> {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findFirst({
      where: { id: transferId, companyId },
    });
    if (!transfer) throw notFound("Transferencia nao encontrada.");
    if (transfer.status === "REVERSED") {
      throw conflict("Esta transferencia ja foi estornada.");
    }

    if (transfer.outTransactionId) {
      await reverseTransaction(tx, {
        companyId,
        transactionId: transfer.outTransactionId,
        description: `Estorno de transferencia - ${reason}`,
        createdById: userId,
      });
    }
    if (transfer.inTransactionId) {
      await reverseTransaction(tx, {
        companyId,
        transactionId: transfer.inTransactionId,
        description: `Estorno de transferencia - ${reason}`,
        createdById: userId,
      });
    }

    const updated = await tx.transfer.update({
      where: { id: transferId },
      data: { status: "REVERSED" },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.REVERSE,
      entity: "Transfer",
      entityId: transferId,
      before: transfer,
      after: { status: "REVERSED", reason },
    });

    return updated;
  });
}

export async function listTransfers(
  companyId: string,
  sp: RawSearchParams,
) {
  const where: Prisma.TransferWhereInput = { companyId };

  const fromId = str(sp, "fromBankAccountId");
  if (fromId) where.fromBankAccountId = fromId;
  const toId = str(sp, "toBankAccountId");
  if (toId) where.toBankAccountId = toId;

  const statuses = enumList(sp, "status", [
    "PENDING",
    "COMPLETED",
    "CANCELED",
    "REVERSED",
  ] as const);
  if (statuses.length > 0) where.status = { in: statuses };

  const range = dateRange(sp, "from", "to");
  if (range) where.date = range;

  const { skip, take, page, pageSize } = pagination(sp);
  const order = sort(sp, ["date", "createdAt", "amount"], {
    field: "date",
    direction: "desc",
  });

  const [items, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      skip,
      take,
      orderBy: { [order.field]: order.direction },
      include: {
        fromBankAccount: { select: { id: true, name: true } },
        toBankAccount: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.transfer.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
