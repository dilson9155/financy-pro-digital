import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D, round2 } from "@/lib/money";
import { dateRange, RawSearchParams, str } from "@/lib/filters";

const POSTED: Prisma.TransactionWhereInput = { status: "POSTED" };

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + offset + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}

export interface DashboardFilters {
  bankAccountId?: string;
  categoryId?: string;
  costCenterId?: string;
  /** Data base para os indicadores (default: hoje). */
  reference?: Date;
}

function dashboardTransactionWhere(
  companyId: string,
  filters: DashboardFilters,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { companyId, ...POSTED };
  if (filters.bankAccountId) where.bankAccountId = filters.bankAccountId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.costCenterId) where.costCenterId = filters.costCenterId;
  return where;
}

export async function getDashboard(
  companyId: string,
  filters: DashboardFilters = {},
) {
  const reference = filters.reference ?? new Date();
  const current = monthRange(0);
  const whereBase = dashboardTransactionWhere(companyId, filters);
  const titleFilter: Prisma.FinancialTitleWhereInput = { companyId };
  if (filters.categoryId) titleFilter.categoryId = filters.categoryId;
  if (filters.costCenterId) titleFilter.costCenterId = filters.costCenterId;

  const todayStart = new Date(reference);
  todayStart.setHours(0, 0, 0, 0);
  const in7 = new Date(todayStart);
  in7.setDate(in7.getDate() + 7);
  const in30 = new Date(todayStart);
  in30.setDate(in30.getDate() + 30);

  // Series dos ultimos 12 meses.
  const seriesStart = monthRange(-11).start;

  const [
    accounts,
    arAgg,
    apAgg,
    monthIn,
    monthOut,
    recent,
    seriesTx,
    receivables,
    payables,
  ] = await Promise.all([
    prisma.bankAccount.findMany({
      where: {
        companyId,
        active: true,
        ...(filters.bankAccountId ? { id: filters.bankAccountId } : {}),
      },
      select: { id: true, name: true, currentBalance: true, type: true },
    }),
    prisma.financialTitle.aggregate({
      where: { ...titleFilter, direction: "RECEIVABLE", status: { in: ["OPEN", "PARTIAL"] } },
      _sum: { totalAmount: true, settledAmount: true },
      _count: { _all: true },
    }),
    prisma.financialTitle.aggregate({
      where: { ...titleFilter, direction: "PAYABLE", status: { in: ["OPEN", "PARTIAL"] } },
      _sum: { totalAmount: true, settledAmount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { ...whereBase, type: "INFLOW", date: { gte: current.start, lte: current.end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...whereBase, type: "OUTFLOW", date: { gte: current.start, lte: current.end } },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: whereBase,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        bankAccount: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { ...whereBase, date: { gte: seriesStart } },
      select: { date: true, type: true, amount: true },
    }),
    prisma.titleInstallment.findMany({
      where: {
        companyId,
        status: { in: ["OPEN", "PARTIAL"] },
        title: { direction: "RECEIVABLE", ...titleFilter },
      },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
    prisma.titleInstallment.findMany({
      where: {
        companyId,
        status: { in: ["OPEN", "PARTIAL"] },
        title: { direction: "PAYABLE", ...titleFilter },
      },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
  ]);

  const totalBalance = accounts.reduce(
    (acc, a) => acc.plus(a.currentBalance),
    D(0),
  );

  const arOpen = round2(arAgg._sum.totalAmount ?? 0).minus(
    round2(arAgg._sum.settledAmount ?? 0),
  );
  const apOpen = round2(apAgg._sum.totalAmount ?? 0).minus(
    round2(apAgg._sum.settledAmount ?? 0),
  );

  const openAmount = (i: { amount: Prisma.Decimal; paidAmount: Prisma.Decimal }) =>
    D(i.amount).minus(i.paidAmount);

  const overdueOf = (items: typeof receivables) =>
    items
      .filter((i) => new Date(i.dueDate) < todayStart)
      .reduce((acc, i) => acc.plus(openAmount(i)), D(0));

  const dueBetween = (items: typeof receivables, from: Date, to: Date) =>
    items
      .filter((i) => new Date(i.dueDate) >= from && new Date(i.dueDate) <= to)
      .reduce((acc, i) => acc.plus(openAmount(i)), D(0));

  const months: { label: string; inflow: Prisma.Decimal; outflow: Prisma.Decimal }[] =
    [];
  for (let offset = -11; offset <= 0; offset += 1) {
    const { start, end } = monthRange(offset);
    const inflow = seriesTx
      .filter(
        (t) => t.type === "INFLOW" && new Date(t.date) >= start && new Date(t.date) <= end,
      )
      .reduce((acc, t) => acc.plus(t.amount), D(0));
    const outflow = seriesTx
      .filter(
        (t) => t.type === "OUTFLOW" && new Date(t.date) >= start && new Date(t.date) <= end,
      )
      .reduce((acc, t) => acc.plus(t.amount), D(0));
    months.push({
      label: `${String(start.getMonth() + 1).padStart(2, "0")}/${start.getFullYear()}`,
      inflow: round2(inflow),
      outflow: round2(outflow),
    });
  }

  const monthInTotal = round2(monthIn._sum.amount ?? 0);
  const monthOutTotal = round2(monthOut._sum.amount ?? 0);

  return {
    reference: reference.toISOString(),
    balance: {
      total: round2(totalBalance).toFixed(2),
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: round2(a.currentBalance).toFixed(2),
      })),
    },
    receivables: {
      open: arOpen.toFixed(2),
      count: arAgg._count._all,
      overdue: round2(overdueOf(receivables)).toFixed(2),
      due7: round2(dueBetween(receivables, todayStart, in7)).toFixed(2),
      due30: round2(dueBetween(receivables, todayStart, in30)).toFixed(2),
    },
    payables: {
      open: apOpen.toFixed(2),
      count: apAgg._count._all,
      overdue: round2(overdueOf(payables)).toFixed(2),
      due7: round2(dueBetween(payables, todayStart, in7)).toFixed(2),
      due30: round2(dueBetween(payables, todayStart, in30)).toFixed(2),
    },
    month: {
      inflow: monthInTotal.toFixed(2),
      outflow: monthOutTotal.toFixed(2),
      net: monthInTotal.minus(monthOutTotal).toFixed(2),
      result: arOpen.minus(apOpen).toFixed(2),
    },
    projection: {
      net: arOpen.minus(apOpen).toFixed(2),
    },
    series: months.map((m) => ({
      label: m.label,
      inflow: m.inflow.toFixed(2),
      outflow: m.outflow.toFixed(2),
      net: m.inflow.minus(m.outflow).toFixed(2),
    })),
    recent: recent.map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      type: t.type,
      origin: t.origin,
      amount: round2(t.amount).toFixed(2),
      bankAccount: t.bankAccount.name,
      category: t.category?.name ?? null,
    })),
  };
}

export function dashboardFiltersFromSearch(sp: RawSearchParams): DashboardFilters {
  return {
    bankAccountId: str(sp, "bankAccountId"),
    categoryId: str(sp, "categoryId"),
    costCenterId: str(sp, "costCenterId"),
  };
}
