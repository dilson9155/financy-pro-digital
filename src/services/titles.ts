import { Prisma } from "@prisma/client";
import type {
  FinancialTitle,
  InstallmentStatus,
  TitleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  D,
  MoneyValue,
  equals,
  isGreaterThan,
  round2,
  splitInstallments,
  sum,
} from "@/lib/money";
import { badRequest, conflict, notFound } from "@/lib/http";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import type { CreateTitleInput } from "@/lib/validation";
import {
  dateRange,
  enumList,
  num,
  pagination,
  RawSearchParams,
  sort,
  str,
} from "@/lib/filters";

const TITLE_STATUSES = [
  "OPEN",
  "PARTIAL",
  "PAID",
  "CANCELED",
  "REVERSED",
] as const;
const TITLE_SORT_FIELDS = ["dueDate", "issueDate", "totalAmount", "createdAt"] as const;

// -----------------------------------------------------------------------------
// Criacao / edicao
// -----------------------------------------------------------------------------

export async function createTitle(
  companyId: string,
  userId: string | null,
  input: CreateTitleInput,
): Promise<FinancialTitle> {
  const total = round2(input.totalAmount);
  if (!isGreaterThan(total, 0)) {
    throw badRequest("O valor do titulo deve ser maior que zero.");
  }

  const parts =
    input.installments && input.installments.length > 0
      ? input.installments.map((i) => ({
          dueDate: i.dueDate,
          amount: i.amount !== undefined ? round2(i.amount) : undefined,
        }))
      : [{ dueDate: input.issueDate, amount: total }];

  // Distribui automaticamente o valor quando nao informado.
  const missing = parts.filter((p) => p.amount === undefined);
  const assigned = sum(
    parts.filter((p) => p.amount !== undefined).map((p) => p.amount as MoneyValue),
  );
  const remaining = total.minus(assigned);
  if (missing.length > 0) {
    if (!isGreaterThan(remaining, 0)) {
      throw badRequest("A soma das parcelas excede o valor do titulo.");
    }
    const distributed = splitInstallments(remaining, missing.length);
    let idx = 0;
    for (const p of parts) {
      if (p.amount === undefined) {
        p.amount = distributed[idx];
        idx += 1;
      }
    }
  }

  const sumParts = sum(parts.map((p) => p.amount as MoneyValue));
  if (!equals(sumParts, total)) {
    throw badRequest(
      `A soma das parcelas (${sumParts.toFixed(2)}) difere do valor total (${total.toFixed(2)}).`,
    );
  }

  const dueDate = parts.reduce(
    (min, p) => (p.dueDate < min ? p.dueDate : min),
    parts[0].dueDate,
  );

  return prisma.$transaction(async (tx) => {
    const title = await tx.financialTitle.create({
      data: {
        companyId,
        direction: input.direction,
        partnerId: input.partnerId ?? null,
        documentNumber: input.documentNumber ?? null,
        description: input.description,
        issueDate: input.issueDate,
        dueDate,
        totalAmount: total,
        categoryId: input.categoryId ?? null,
        costCenterId: input.costCenterId ?? null,
        accountPlanId: input.accountPlanId ?? null,
        notes: input.notes ?? null,
        createdById: userId,
        installments: {
          create: parts.map((p, index) => ({
            companyId,
            number: index + 1,
            dueDate: p.dueDate,
            amount: p.amount as MoneyValue,
          })),
        },
      },
      include: { installments: true },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "FinancialTitle",
      entityId: title.id,
      after: title,
    });

    return title;
  });
}

export async function updateTitle(
  companyId: string,
  userId: string | null,
  titleId: string,
  input: Partial<CreateTitleInput>,
): Promise<FinancialTitle> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.financialTitle.findFirst({
      where: { id: titleId, companyId },
    });
    if (!before) throw notFound("Titulo nao encontrado.");
    if (before.status === "PAID") {
      throw conflict("Titulo liquidado nao pode ser editado.");
    }
    if (before.status === "CANCELED" || before.status === "REVERSED") {
      throw conflict("Titulo cancelado/estornado nao pode ser editado.");
    }

    const updated = await tx.financialTitle.update({
      where: { id: titleId },
      data: {
        partnerId: input.partnerId ?? before.partnerId,
        documentNumber:
          input.documentNumber === undefined
            ? before.documentNumber
            : input.documentNumber,
        description: input.description ?? before.description,
        issueDate: input.issueDate ?? before.issueDate,
        categoryId:
          input.categoryId === undefined ? before.categoryId : input.categoryId,
        costCenterId:
          input.costCenterId === undefined
            ? before.costCenterId
            : input.costCenterId,
        accountPlanId:
          input.accountPlanId === undefined
            ? before.accountPlanId
            : input.accountPlanId,
        notes: input.notes === undefined ? before.notes : input.notes,
        version: { increment: 1 },
      },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "FinancialTitle",
      entityId: titleId,
      before,
      after: updated,
    });

    return updated;
  });
}

export async function cancelTitle(
  companyId: string,
  userId: string | null,
  titleId: string,
  reason: string,
): Promise<FinancialTitle> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.financialTitle.findFirst({
      where: { id: titleId, companyId },
    });
    if (!before) throw notFound("Titulo nao encontrado.");
    if (before.status === "CANCELED") {
      throw conflict("Titulo ja esta cancelado.");
    }

    const activeSettlements = await tx.settlement.count({
      where: { titleId, reversed: false },
    });
    if (activeSettlements > 0) {
      throw conflict(
        "Existem baixas ativas. Estorne as baixas antes de cancelar o titulo.",
      );
    }

    const updated = await tx.financialTitle.update({
      where: { id: titleId },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        cancelReason: reason,
        version: { increment: 1 },
      },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CANCEL,
      entity: "FinancialTitle",
      entityId: titleId,
      before,
      after: updated,
    });

    return updated;
  });
}

export async function deleteTitle(
  companyId: string,
  userId: string | null,
  titleId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.financialTitle.findFirst({
      where: { id: titleId, companyId },
      include: { installments: true },
    });
    if (!before) throw notFound("Titulo nao encontrado.");

    const settlements = await tx.settlement.count({
      where: { titleId, reversed: false },
    });
    if (settlements > 0) {
      throw conflict(
        "Nao e possivel excluir um titulo com baixas ativas. Estorne as baixas primeiro.",
      );
    }

    await tx.financialTitle.delete({ where: { id: titleId } });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "FinancialTitle",
      entityId: titleId,
      before,
    });
  });
}

// -----------------------------------------------------------------------------
// Recomposicao de status (derivado das baixas)
// -----------------------------------------------------------------------------

export async function recomputeInstallment(
  tx: Prisma.TransactionClient,
  installmentId: string,
): Promise<{ paid: Prisma.Decimal; status: InstallmentStatus }> {
  const inst = await tx.titleInstallment.findUnique({
    where: { id: installmentId },
  });
  if (!inst) throw notFound("Parcela nao encontrada.");

  const agg = await tx.settlement.aggregate({
    where: { installmentId, reversed: false },
    _sum: { amount: true },
  });
  const paid = round2(agg._sum.amount ?? 0);
  const status: InstallmentStatus = paid.greaterThanOrEqualTo(inst.amount)
    ? "PAID"
    : paid.greaterThan(0)
      ? "PARTIAL"
      : "OPEN";

  await tx.titleInstallment.update({
    where: { id: installmentId },
    data: { paidAmount: paid, status, version: { increment: 1 } },
  });

  return { paid, status };
}

export async function recomputeTitle(
  tx: Prisma.TransactionClient,
  titleId: string,
): Promise<{ settled: Prisma.Decimal; status: TitleStatus }> {
  const title = await tx.financialTitle.findUnique({
    where: { id: titleId },
    include: { installments: true },
  });
  if (!title) throw notFound("Titulo nao encontrado.");

  const settled = round2(sum(title.installments.map((i) => i.paidAmount)));

  let status: TitleStatus = title.status;
  if (title.status !== "CANCELED" && title.status !== "REVERSED") {
    status = settled.greaterThanOrEqualTo(title.totalAmount)
      ? "PAID"
      : settled.greaterThan(0)
        ? "PARTIAL"
        : "OPEN";
  }

  await tx.financialTitle.update({
    where: { id: titleId },
    data: { settledAmount: settled, status, version: { increment: 1 } },
  });

  return { settled, status };
}

// -----------------------------------------------------------------------------
// Consultas com filtros dinamicos e combinaveis
// -----------------------------------------------------------------------------

export function buildTitleWhere(
  companyId: string,
  sp: RawSearchParams,
  direction?: "PAYABLE" | "RECEIVABLE",
): Prisma.FinancialTitleWhereInput {
  const where: Prisma.FinancialTitleWhereInput = { companyId };
  if (direction) where.direction = direction;

  const dirFilter = enumList(sp, "direction", ["PAYABLE", "RECEIVABLE"] as const);
  if (!direction && dirFilter.length === 1) where.direction = dirFilter[0];

  const statuses = enumList(sp, "status", TITLE_STATUSES);
  if (statuses.length > 0) where.status = { in: statuses as TitleStatus[] };

  const partnerId = str(sp, "partnerId");
  if (partnerId) where.partnerId = partnerId;

  const categoryId = str(sp, "categoryId");
  if (categoryId) where.categoryId = categoryId;

  const costCenterId = str(sp, "costCenterId");
  if (costCenterId) where.costCenterId = costCenterId;

  const accountPlanId = str(sp, "accountPlanId");
  if (accountPlanId) where.accountPlanId = accountPlanId;

  const dueRange = dateRange(sp, "dueFrom", "dueTo");
  if (dueRange) where.dueDate = dueRange;

  const issueRange = dateRange(sp, "issueFrom", "issueTo");
  if (issueRange) where.issueDate = issueRange;

  const minAmount = num(sp, "minAmount");
  const maxAmount = num(sp, "maxAmount");
  if (minAmount !== undefined || maxAmount !== undefined) {
    where.totalAmount = {};
    if (minAmount !== undefined) where.totalAmount.gte = minAmount;
    if (maxAmount !== undefined) where.totalAmount.lte = maxAmount;
  }

  const q = str(sp, "q");
  if (q) {
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { documentNumber: { contains: q, mode: "insensitive" } },
      { partner: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  // Filtro "somente vencidos": em aberto/parcial e vencimento anterior a hoje.
  const overdue = str(sp, "overdue");
  if (overdue === "true") {
    where.status = { in: ["OPEN", "PARTIAL"] };
    where.dueDate = { lt: new Date(new Date().setHours(0, 0, 0, 0)) };
  }

  return where;
}

export interface ListTitlesOptions {
  direction?: "PAYABLE" | "RECEIVABLE";
  defaultSort?: (typeof TITLE_SORT_FIELDS)[number];
}

export async function listTitles(
  companyId: string,
  sp: RawSearchParams,
  options: ListTitlesOptions = {},
) {
  const where = buildTitleWhere(companyId, sp, options.direction);
  const { skip, take, page, pageSize } = pagination(sp, { pageSize: 20 });
  const order = sort(sp, TITLE_SORT_FIELDS, {
    field: options.defaultSort ?? "dueDate",
    direction: "asc",
  });

  const [items, total, aggOpen] = await Promise.all([
    prisma.financialTitle.findMany({
      where,
      skip,
      take,
      orderBy: { [order.field]: order.direction },
      include: {
        partner: { select: { id: true, name: true, document: true } },
        category: { select: { id: true, name: true, type: true } },
        costCenter: { select: { id: true, code: true, name: true } },
        accountPlan: { select: { id: true, code: true, name: true } },
        installments: { orderBy: { number: "asc" } },
        _count: { select: { settlements: true } },
      },
    }),
    prisma.financialTitle.count({ where }),
    prisma.financialTitle.aggregate({
      where,
      _sum: { totalAmount: true, settledAmount: true },
    }),
  ]);

  const totalAmount = round2(aggOpen._sum.totalAmount ?? 0);
  const settledAmount = round2(aggOpen._sum.settledAmount ?? 0);

  return {
    items,
    total,
    page,
    pageSize,
    summary: {
      totalAmount: totalAmount.toFixed(2),
      settledAmount: settledAmount.toFixed(2),
      openAmount: totalAmount.minus(settledAmount).toFixed(2),
    },
  };
}

export async function getTitle(
  companyId: string,
  titleId: string,
) {
  const title = await prisma.financialTitle.findFirst({
    where: { id: titleId, companyId },
    include: {
      partner: true,
      category: true,
      costCenter: true,
      accountPlan: true,
      createdBy: { select: { id: true, name: true } },
      installments: {
        orderBy: { number: "asc" },
        include: {
          bankAccount: { select: { id: true, name: true, type: true } },
        },
      },
      settlements: {
        orderBy: { createdAt: "desc" },
        include: {
          bankAccount: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          reversal: {
            include: { reversedBy: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!title) throw notFound("Titulo nao encontrado.");
  return title;
}

export async function agingReport(
  companyId: string,
  direction: "PAYABLE" | "RECEIVABLE",
) {
  const titles = await prisma.financialTitle.findMany({
    where: {
      companyId,
      direction,
      status: { in: ["OPEN", "PARTIAL"] },
    },
    include: { installments: { where: { status: { in: ["OPEN", "PARTIAL"] } } } },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = {
    overdue: 0n,
    dueToday: 0n,
    due7: 0n,
    due30: 0n,
    dueLater: 0n,
  };

  const toCents = (v: MoneyValue) => BigInt(round2(v).times(100).toFixed(0));

  for (const title of titles) {
    for (const inst of title.installments) {
      const open = D(inst.amount).minus(inst.paidAmount);
      if (!isGreaterThan(open, 0)) continue;
      const due = new Date(inst.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      const cents = toCents(open);
      if (diffDays < 0) buckets.overdue += cents;
      else if (diffDays === 0) buckets.dueToday += cents;
      else if (diffDays <= 7) buckets.due7 += cents;
      else if (diffDays <= 30) buckets.due30 += cents;
      else buckets.dueLater += cents;
    }
  }

  const fromCents = (c: bigint) => (Number(c) / 100).toFixed(2);
  return {
    overdue: fromCents(buckets.overdue),
    dueToday: fromCents(buckets.dueToday),
    due7: fromCents(buckets.due7),
    due30: fromCents(buckets.due30),
    dueLater: fromCents(buckets.dueLater),
    total: fromCents(
      buckets.overdue +
        buckets.dueToday +
        buckets.due7 +
        buckets.due30 +
        buckets.dueLater,
    ),
  };
}
