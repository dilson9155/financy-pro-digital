import { Prisma } from "@prisma/client";
import type { Transaction, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D, round2, type MoneyValue } from "@/lib/money";
import { badRequest, conflict, notFound } from "@/lib/http";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import {
  lockBankAccount,
  postTransaction,
  reverseTransaction,
} from "@/lib/ledger";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "@/lib/validation";
import {
  dateRange,
  enumList,
  num,
  pagination,
  RawSearchParams,
  sort,
  str,
} from "@/lib/filters";

/** Lancamento manual de entrada/saida (nao vinculado a titulo). */
export async function createManualTransaction(
  companyId: string,
  userId: string | null,
  input: CreateTransactionInput,
): Promise<Transaction> {
  return prisma.$transaction(async (tx) => {
    const created = await postTransaction(tx, {
      companyId,
      bankAccountId: input.bankAccountId,
      type: input.type,
      origin: "MANUAL",
      amount: round2(input.amount),
      date: input.date,
      competenceDate: input.competenceDate ?? input.date,
      description: input.description,
      categoryId: input.categoryId ?? null,
      costCenterId: input.costCenterId ?? null,
      accountPlanId: input.accountPlanId ?? null,
      partnerId: input.partnerId ?? null,
      createdById: userId,
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Transaction",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}

const REVERSIBLE_ORIGINS = ["MANUAL", "ADJUSTMENT", "OPENING_BALANCE"] as const;

/**
 * Estorna um lancamento manual. Lancamentos originados de baixas/transferencias
 * devem ser estornados pelos fluxos proprios (reverseSettlement/reverseTransfer)
 * para manter a consistencia dos titulos.
 */
export async function reverseManualTransaction(
  companyId: string,
  userId: string | null,
  transactionId: string,
  reason: string,
): Promise<Transaction> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.transaction.findFirst({
      where: { id: transactionId, companyId },
    });
    if (!original) throw notFound("Lancamento nao encontrado.");
    if (
      !REVERSIBLE_ORIGINS.includes(
        original.origin as (typeof REVERSIBLE_ORIGINS)[number],
      )
    ) {
      throw conflict(
        "Somente lancamentos manuais/ajustes podem ser estornados diretamente. Para baixas e transferencias, use o fluxo especifico.",
      );
    }

    const counter = await reverseTransaction(tx, {
      companyId,
      transactionId,
      description: `Estorno - ${reason}`,
      createdById: userId,
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.REVERSE,
      entity: "Transaction",
      entityId: transactionId,
      before: original,
      after: { reversedById: counter.id, reason },
    });

    return counter;
  });
}

/** Efeito assinado no saldo: entrada soma, saida subtrai. */
function signedAmount(
  type: TransactionType,
  amount: MoneyValue,
): Prisma.Decimal {
  const value = D(amount);
  return type === "INFLOW" ? value : value.negated();
}

function assertEditable(origin: string, status: string, action: string): void {
  if (
    !REVERSIBLE_ORIGINS.includes(
      origin as (typeof REVERSIBLE_ORIGINS)[number],
    )
  ) {
    throw conflict(
      `Somente lancamentos manuais/ajustes podem ser ${action} diretamente. Para baixas e transferencias, use o fluxo especifico.`,
    );
  }
  if (status !== "POSTED") {
    throw conflict(
      `Lancamentos estornados nao podem ser ${action}. Mantenha o historico.`,
    );
  }
}

/**
 * Edita um lancamento manual, ajustando o saldo da(s) conta(s) envolvida(s).
 * Trocar de conta reverte o efeito na origem e aplica na conta de destino.
 */
export async function updateManualTransaction(
  companyId: string,
  userId: string | null,
  transactionId: string,
  input: UpdateTransactionInput,
): Promise<Transaction> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.transaction.findFirst({
      where: { id: transactionId, companyId },
    });
    if (!original) throw notFound("Lancamento nao encontrado.");
    assertEditable(original.origin, original.status, "editados");

    const newBankAccountId = input.bankAccountId ?? original.bankAccountId;
    const newType = input.type ?? original.type;
    const newAmount = round2(input.amount ?? original.amount);
    if (!newAmount.greaterThan(0)) {
      throw badRequest("O valor da movimentacao deve ser maior que zero.");
    }

    const oldSigned = signedAmount(original.type, original.amount);
    const newSigned = signedAmount(newType, newAmount);

    // Bloqueia as contas em ordem deterministica (evita deadlock).
    const firstId =
      original.bankAccountId < newBankAccountId
        ? original.bankAccountId
        : newBankAccountId;
    const secondId =
      original.bankAccountId < newBankAccountId
        ? newBankAccountId
        : original.bankAccountId;
    const firstRow = await lockBankAccount(tx, companyId, firstId);
    const secondRow =
      firstId === secondId ? firstRow : await lockBankAccount(tx, companyId, secondId);
    const rowFor = (id: string) => (id === firstId ? firstRow : secondRow);

    const balanceAfterRevert = D(rowFor(original.bankAccountId).currentBalance).minus(
      oldSigned,
    );

    let newBalance: Prisma.Decimal;
    if (newBankAccountId === original.bankAccountId) {
      newBalance = balanceAfterRevert.plus(newSigned);
      await tx.bankAccount.update({
        where: { id: original.bankAccountId },
        data: { currentBalance: newBalance, version: { increment: 1 } },
      });
    } else {
      await tx.bankAccount.update({
        where: { id: original.bankAccountId },
        data: { currentBalance: balanceAfterRevert, version: { increment: 1 } },
      });
      newBalance = D(rowFor(newBankAccountId).currentBalance).plus(newSigned);
      await tx.bankAccount.update({
        where: { id: newBankAccountId },
        data: { currentBalance: newBalance, version: { increment: 1 } },
      });
    }

    const updated = await tx.transaction.update({
      where: { id: original.id },
      data: {
        bankAccountId: newBankAccountId,
        type: newType,
        amount: newAmount,
        balanceAfter: newBalance,
        date: input.date ?? original.date,
        competenceDate:
          input.competenceDate ?? input.date ?? original.competenceDate,
        description: input.description ?? original.description,
        categoryId:
          input.categoryId === undefined ? original.categoryId : input.categoryId,
        costCenterId:
          input.costCenterId === undefined
            ? original.costCenterId
            : input.costCenterId,
        accountPlanId:
          input.accountPlanId === undefined
            ? original.accountPlanId
            : input.accountPlanId,
        partnerId:
          input.partnerId === undefined ? original.partnerId : input.partnerId,
        version: { increment: 1 },
      },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Transaction",
      entityId: original.id,
      before: original,
      after: updated,
    });

    return updated;
  });
}

/**
 * Exclui um lancamento manual e reverte seu efeito no saldo da conta.
 * Restrito a lancamentos postados e de origem manual/ajuste.
 */
export async function deleteManualTransaction(
  companyId: string,
  userId: string | null,
  transactionId: string,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.transaction.findFirst({
      where: { id: transactionId, companyId },
    });
    if (!original) throw notFound("Lancamento nao encontrado.");
    assertEditable(original.origin, original.status, "excluidos");

    const account = await lockBankAccount(tx, companyId, original.bankAccountId);
    const newBalance = D(account.currentBalance).minus(
      signedAmount(original.type, original.amount),
    );
    await tx.bankAccount.update({
      where: { id: original.bankAccountId },
      data: { currentBalance: newBalance, version: { increment: 1 } },
    });

    await tx.transaction.delete({ where: { id: original.id } });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Transaction",
      entityId: transactionId,
      before: original,
    });

    return { id: transactionId };
  });
}

export function buildTransactionWhere(
  companyId: string,
  sp: RawSearchParams,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { companyId };

  const bankAccountId = str(sp, "bankAccountId");
  if (bankAccountId) where.bankAccountId = bankAccountId;

  const categoryId = str(sp, "categoryId");
  if (categoryId) where.categoryId = categoryId;

  const costCenterId = str(sp, "costCenterId");
  if (costCenterId) where.costCenterId = costCenterId;

  const accountPlanId = str(sp, "accountPlanId");
  if (accountPlanId) where.accountPlanId = accountPlanId;

  const partnerId = str(sp, "partnerId");
  if (partnerId) where.partnerId = partnerId;

  const types = enumList(sp, "type", ["INFLOW", "OUTFLOW"] as const);
  if (types.length > 0) where.type = { in: types };

  const origins = enumList(sp, "origin", [
    "MANUAL",
    "PAYABLE_SETTLEMENT",
    "RECEIVABLE_SETTLEMENT",
    "TRANSFER",
    "ADJUSTMENT",
    "OPENING_BALANCE",
    "REVERSAL",
  ] as const);
  if (origins.length > 0) where.origin = { in: origins };

  const statuses = enumList(sp, "status", ["POSTED", "REVERSED"] as const);
  if (statuses.length > 0) where.status = { in: statuses };

  const range = dateRange(sp, "from", "to");
  if (range) where.date = range;

  const competenceRange = dateRange(sp, "competenceFrom", "competenceTo");
  if (competenceRange) where.competenceDate = competenceRange;

  const minAmount = num(sp, "minAmount");
  const maxAmount = num(sp, "maxAmount");
  if (minAmount !== undefined || maxAmount !== undefined) {
    where.amount = {};
    if (minAmount !== undefined) where.amount.gte = minAmount;
    if (maxAmount !== undefined) where.amount.lte = maxAmount;
  }

  const q = str(sp, "q");
  if (q) {
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { partner: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function listTransactions(
  companyId: string,
  sp: RawSearchParams,
) {
  const where = buildTransactionWhere(companyId, sp);
  const { skip, take, page, pageSize } = pagination(sp);
  const order = sort(sp, ["date", "createdAt", "amount"], {
    field: "date",
    direction: "desc",
  });

  const [items, total, inflow, outflow] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take,
      orderBy: { [order.field]: order.direction },
      include: {
        bankAccount: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true } },
        costCenter: { select: { id: true, code: true, name: true } },
        accountPlan: { select: { id: true, code: true, name: true } },
        partner: { select: { id: true, name: true } },
        title: { select: { id: true, description: true, direction: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({
      where: { ...where, type: "INFLOW", status: "POSTED" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "OUTFLOW", status: "POSTED" },
      _sum: { amount: true },
    }),
  ]);

  const inflowTotal = round2(inflow._sum.amount ?? 0);
  const outflowTotal = round2(outflow._sum.amount ?? 0);

  return {
    items,
    total,
    page,
    pageSize,
    summary: {
      inflow: inflowTotal.toFixed(2),
      outflow: outflowTotal.toFixed(2),
      net: inflowTotal.minus(outflowTotal).toFixed(2),
    },
  };
}
