import { Prisma } from "@prisma/client";
import type { Settlement } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D, isGreaterThan, round2, sum } from "@/lib/money";
import { badRequest, conflict, notFound } from "@/lib/http";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { postTransaction, reverseTransaction } from "@/lib/ledger";
import type { SettleInput } from "@/lib/validation";
import { recomputeInstallment, recomputeTitle } from "./titles";
import {
  dateRange,
  enumList,
  pagination,
  RawSearchParams,
  sort,
  str,
} from "@/lib/filters";

/**
 * Baixa (total ou parcial) de uma parcela.
 * Toda a operacao roda em uma unica transacao SQL: bloqueio da parcela,
 * lancamento no ledger, atualizacao do saldo da conta, recomposicao dos
 * status da parcela/titulo e trilha de auditoria.
 */
export async function settle(
  companyId: string,
  userId: string | null,
  input: SettleInput,
): Promise<Settlement> {
  const principal = round2(input.amount);
  const interest = round2(input.interest);
  const fine = round2(input.fine);
  const discount = round2(input.discount);

  if (!isGreaterThan(principal, 0)) {
    throw badRequest("O valor da baixa deve ser maior que zero.");
  }
  if (
    interest.isNegative() ||
    fine.isNegative() ||
    discount.isNegative()
  ) {
    throw badRequest("Juros, multa e desconto nao podem ser negativos.");
  }

  const total = principal.plus(interest).plus(fine).minus(discount);
  if (total.isNegative()) {
    throw badRequest("O desconto nao pode exceder o valor total da baixa.");
  }

  return prisma.$transaction(async (tx) => {
    // Bloqueia a parcela para evitar baixas concorrentes.
    await tx.$queryRaw`
      SELECT id FROM title_installments
      WHERE id = ${input.installmentId}::uuid AND company_id = ${companyId}::uuid
      FOR UPDATE
    `;

    const installment = await tx.titleInstallment.findFirst({
      where: { id: input.installmentId, companyId },
      include: { title: true },
    });
    if (!installment) throw notFound("Parcela nao encontrada.");

    const title = installment.title;
    if (title.status === "CANCELED" || title.status === "REVERSED") {
      throw conflict("Titulo cancelado/estornado nao pode receber baixas.");
    }

    const agg = await tx.settlement.aggregate({
      where: { installmentId: installment.id, reversed: false },
      _sum: { amount: true },
    });
    const alreadyPaid = round2(agg._sum.amount ?? 0);
    const remaining = round2(D(installment.amount).minus(alreadyPaid));

    if (!isGreaterThan(remaining, 0)) {
      throw conflict("Esta parcela ja esta totalmente liquidada.");
    }
    if (isGreaterThan(principal, remaining)) {
      throw badRequest(
        `O valor informado (${principal.toFixed(2)}) excede o saldo da parcela (${remaining.toFixed(2)}).`,
      );
    }

    const isReceivable = title.direction === "RECEIVABLE";

    // Movimenta o caixa somente quando ha valor presente.
    let transactionId: string | null = null;
    if (isGreaterThan(total, 0)) {
      const transaction = await postTransaction(tx, {
        companyId,
        bankAccountId: input.bankAccountId,
        type: isReceivable ? "INFLOW" : "OUTFLOW",
        origin: isReceivable
          ? "RECEIVABLE_SETTLEMENT"
          : "PAYABLE_SETTLEMENT",
        amount: total,
        date: input.date,
        competenceDate: input.competenceDate ?? input.date,
        description: `${isReceivable ? "Recebimento" : "Pagamento"} - ${title.description}`,
        categoryId: title.categoryId,
        costCenterId: title.costCenterId,
        accountPlanId: title.accountPlanId,
        partnerId: title.partnerId,
        titleId: title.id,
        installmentId: installment.id,
        createdById: userId,
      });
      transactionId = transaction.id;
    }

    const settlement = await tx.settlement.create({
      data: {
        companyId,
        titleId: title.id,
        installmentId: installment.id,
        bankAccountId: input.bankAccountId,
        amount: principal,
        interest,
        fine,
        discount,
        total,
        date: input.date,
        method: input.method,
        notes: input.notes ?? null,
        transactionId,
        createdById: userId,
      },
    });

    // Vincula o lancamento a baixa (settlementId) apos criar o registro.
    if (transactionId) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { settlementId: settlement.id },
      });
      await tx.settlement.update({
        where: { id: settlement.id },
        data: { transactionId },
      });
    }

    await recomputeInstallment(tx, installment.id);
    await recomputeTitle(tx, title.id);

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.SETTLE,
      entity: "Settlement",
      entityId: settlement.id,
      after: settlement,
    });

    return settlement;
  });
}

/**
 * Estorno auditavel de uma baixa: gera contrapartida no ledger, marca a baixa
 * como estornada e recompoe os saldos da parcela e do titulo.
 */
export async function reverseSettlement(
  companyId: string,
  userId: string | null,
  settlementId: string,
  reason: string,
): Promise<Settlement> {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findFirst({
      where: { id: settlementId, companyId },
    });
    if (!settlement) throw notFound("Baixa nao encontrada.");
    if (settlement.reversed) throw conflict("Esta baixa ja foi estornada.");

    // Marca como estornada ANTES de recompor (para excluir do somatorio).
    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: { reversed: true },
    });

    let counterTransactionId: string | null = null;
    if (settlement.transactionId) {
      const counter = await reverseTransaction(tx, {
        companyId,
        transactionId: settlement.transactionId,
        description: `Estorno de baixa - ${reason}`,
        createdById: userId,
      });
      counterTransactionId = counter.id;
      await tx.transaction.update({
        where: { id: counter.id },
        data: { settlementId: settlement.id },
      });
    }

    const reversal = await tx.settlementReversal.create({
      data: {
        companyId,
        settlementId: settlement.id,
        reason,
        reversedById: userId,
        transactionId: counterTransactionId,
      },
    });

    await recomputeInstallment(tx, settlement.installmentId);
    await recomputeTitle(tx, settlement.titleId);

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.REVERSE,
      entity: "Settlement",
      entityId: settlement.id,
      before: settlement,
      after: { reversed: true, reversalId: reversal.id, reason },
    });

    return updated;
  });
}

export async function listSettlements(
  companyId: string,
  sp: RawSearchParams,
) {
  const where: Prisma.SettlementWhereInput = { companyId };

  const titleId = str(sp, "titleId");
  if (titleId) where.titleId = titleId;
  const installmentId = str(sp, "installmentId");
  if (installmentId) where.installmentId = installmentId;
  const bankAccountId = str(sp, "bankAccountId");
  if (bankAccountId) where.bankAccountId = bankAccountId;

  const methods = enumList(sp, "method", [
    "CASH",
    "PIX",
    "BANK_TRANSFER",
    "BOLETO",
    "CARD",
    "CHECK",
    "OTHER",
  ] as const);
  if (methods.length > 0) where.method = { in: methods };

  const reversed = str(sp, "reversed");
  if (reversed === "true") where.reversed = true;
  if (reversed === "false") where.reversed = false;

  const range = dateRange(sp, "from", "to");
  if (range) where.date = range;

  const direction = enumList(sp, "direction", ["PAYABLE", "RECEIVABLE"] as const);
  if (direction.length === 1) where.title = { direction: direction[0] };

  const { skip, take, page, pageSize } = pagination(sp);
  const order = sort(sp, ["date", "createdAt", "amount", "total"], {
    field: "date",
    direction: "desc",
  });

  const [items, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      skip,
      take,
      orderBy: { [order.field]: order.direction },
      include: {
        title: { select: { id: true, description: true, direction: true } },
        installment: { select: { id: true, number: true, dueDate: true } },
        bankAccount: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        reversal: true,
      },
    }),
    prisma.settlement.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
