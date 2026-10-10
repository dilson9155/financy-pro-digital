import { Prisma } from "@prisma/client";
import type { Transaction } from "@prisma/client";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/money";
import { conflict, notFound } from "@/lib/http";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { postTransaction, reverseTransaction } from "@/lib/ledger";
import type { CreateTransactionInput } from "@/lib/validation";
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
