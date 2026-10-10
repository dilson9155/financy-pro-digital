import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D, round2 } from "@/lib/money";
import { buildTransactionWhere } from "./transactions";
import { buildTitleWhere } from "./titles";
import { dateRange, RawSearchParams, str } from "@/lib/filters";

const POSTED: Prisma.TransactionWhereInput = { status: "POSTED" };

/** Fluxo de caixa com saldo inicial, movimento por periodo e saldo final. */
export async function cashFlow(companyId: string, sp: RawSearchParams) {
  const where = buildTransactionWhere(companyId, sp);
  let range = dateRange(sp, "from", "to");
  const bankAccountId = str(sp, "bankAccountId");

  if (!range) {
    const now = new Date();
    range = {
      gte: new Date(now.getFullYear(), now.getMonth(), 1),
      lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }

  const accountFilter = bankAccountId ? { bankAccountId } : {};

  // Saldo inicial = movimentos POSTED antes do inicio do periodo.
  const [openingIn, openingOut] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        ...POSTED,
        companyId,
        ...accountFilter,
        date: { lt: range.gte as Date },
        type: "INFLOW",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        ...POSTED,
        companyId,
        ...accountFilter,
        date: { lt: range.gte as Date },
        type: "OUTFLOW",
      },
      _sum: { amount: true },
    }),
  ]);
  const opening = round2(openingIn._sum.amount ?? 0).minus(
    round2(openingOut._sum.amount ?? 0),
  );

  const entries = await prisma.transaction.findMany({
    where: { ...where, ...POSTED, date: range },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      bankAccount: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      costCenter: { select: { id: true, name: true } },
    },
  });

  let running = opening;
  const rows = entries.map((e) => {
    const amount = D(e.amount);
    running =
      e.type === "INFLOW" ? running.plus(amount) : running.minus(amount);
    return {
      id: e.id,
      date: e.date,
      description: e.description,
      type: e.type,
      origin: e.origin,
      amount: amount.toFixed(2),
      bankAccount: e.bankAccount.name,
      category: e.category?.name ?? null,
      costCenter: e.costCenter?.name ?? null,
      balance: running.toFixed(2),
    };
  });

  // Consolidacao diaria.
  const byDay = new Map<
    string,
    { date: string; inflow: Prisma.Decimal; outflow: Prisma.Decimal }
  >();
  for (const e of entries) {
    const key = new Date(e.date).toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? {
      date: key,
      inflow: D(0),
      outflow: D(0),
    };
    if (e.type === "INFLOW") cur.inflow = cur.inflow.plus(e.amount);
    else cur.outflow = cur.outflow.plus(e.amount);
    byDay.set(key, cur);
  }

  const inflowTotal = entries
    .filter((e) => e.type === "INFLOW")
    .reduce((acc, e) => acc.plus(e.amount), D(0));
  const outflowTotal = entries
    .filter((e) => e.type === "OUTFLOW")
    .reduce((acc, e) => acc.plus(e.amount), D(0));

  return {
    period: { from: range.gte ?? null, to: range.lte ?? null },
    opening: opening.toFixed(2),
    inflow: round2(inflowTotal).toFixed(2),
    outflow: round2(outflowTotal).toFixed(2),
    net: round2(inflowTotal.minus(outflowTotal)).toFixed(2),
    closing: round2(opening.plus(inflowTotal).minus(outflowTotal)).toFixed(2),
    rows,
    daily: Array.from(byDay.values()).map((d) => ({
      date: d.date,
      inflow: d.inflow.toFixed(2),
      outflow: d.outflow.toFixed(2),
      net: d.inflow.minus(d.outflow).toFixed(2),
    })),
  };
}

/** Saldo atual das contas/caixas (do cadastro) x saldo calculado do ledger. */
export async function accountPositions(companyId: string) {
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });

  const computed = await prisma.transaction.groupBy({
    by: ["bankAccountId", "type"],
    where: { companyId, status: "POSTED" },
    _sum: { amount: true },
  });

  const inflow = new Map<string, Prisma.Decimal>();
  const outflow = new Map<string, Prisma.Decimal>();
  for (const row of computed) {
    const target = row.type === "INFLOW" ? inflow : outflow;
    target.set(row.bankAccountId, round2(row._sum.amount ?? 0));
  }

  const items = accounts.map((a) => {
    const ledger =
      (inflow.get(a.id) ?? D(0)).minus(outflow.get(a.id) ?? D(0));
    const calculated = round2(D(a.initialBalance).plus(ledger));
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      initialBalance: round2(a.initialBalance).toFixed(2),
      currentBalance: round2(a.currentBalance).toFixed(2),
      calculatedBalance: calculated.toFixed(2),
      divergence: round2(D(a.currentBalance).minus(calculated)).toFixed(2),
      active: a.active,
    };
  });

  const total = items
    .filter((i) => i.active)
    .reduce((acc, i) => acc.plus(i.currentBalance), D(0));

  return { items, total: round2(total).toFixed(2) };
}

/** Realizado por categoria no periodo (entradas x saidas). */
export async function reportByCategory(
  companyId: string,
  sp: RawSearchParams,
) {
  const where = buildTransactionWhere(companyId, sp);
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId", "type"],
    where: { ...where, ...POSTED },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const categories = await prisma.category.findMany({
    where: { companyId },
    select: { id: true, name: true, type: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const map = new Map<
    string,
    { id: string | null; name: string; inflow: Prisma.Decimal; outflow: Prisma.Decimal; count: number }
  >();
  for (const row of rows) {
    const key = row.categoryId ?? "__none__";
    const name =
      (row.categoryId && catMap.get(row.categoryId)?.name) || "Sem categoria";
    const cur =
      map.get(key) ?? { id: row.categoryId, name, inflow: D(0), outflow: D(0), count: 0 };
    if (row.type === "INFLOW") cur.inflow = cur.inflow.plus(row._sum.amount ?? 0);
    else cur.outflow = cur.outflow.plus(row._sum.amount ?? 0);
    cur.count += row._count._all;
    map.set(key, cur);
  }

  return Array.from(map.values())
    .map((c) => ({
      id: c.id,
      name: c.name,
      inflow: round2(c.inflow).toFixed(2),
      outflow: round2(c.outflow).toFixed(2),
      net: round2(c.inflow.minus(c.outflow)).toFixed(2),
      count: c.count,
    }))
    .sort((a, b) => Number(b.inflow) + Number(b.outflow) - (Number(a.inflow) + Number(a.outflow)));
}

/** Realizado por centro de custo no periodo. */
export async function reportByCostCenter(
  companyId: string,
  sp: RawSearchParams,
) {
  const where = buildTransactionWhere(companyId, sp);
  const rows = await prisma.transaction.groupBy({
    by: ["costCenterId", "type"],
    where: { ...where, ...POSTED },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const centers = await prisma.costCenter.findMany({
    where: { companyId },
    select: { id: true, code: true, name: true },
  });
  const map = new Map(centers.map((c) => [c.id, c]));

  const grouped = new Map<
    string,
    { id: string | null; name: string; inflow: Prisma.Decimal; outflow: Prisma.Decimal; count: number }
  >();
  for (const row of rows) {
    const key = row.costCenterId ?? "__none__";
    const name =
      (row.costCenterId && map.get(row.costCenterId)?.name) || "Sem centro";
    const cur =
      grouped.get(key) ?? { id: row.costCenterId, name, inflow: D(0), outflow: D(0), count: 0 };
    if (row.type === "INFLOW") cur.inflow = cur.inflow.plus(row._sum.amount ?? 0);
    else cur.outflow = cur.outflow.plus(row._sum.amount ?? 0);
    cur.count += row._count._all;
    grouped.set(key, cur);
  }

  return Array.from(grouped.values())
    .map((c) => ({
      id: c.id,
      name: c.name,
      inflow: round2(c.inflow).toFixed(2),
      outflow: round2(c.outflow).toFixed(2),
      net: round2(c.inflow.minus(c.outflow)).toFixed(2),
      count: c.count,
    }))
    .sort((a, b) => Number(b.outflow) - Number(a.outflow));
}

/**
 * Relacao de contas a pagar/receber (titulos) com saldos e vencimento.
 * Reaproveita os mesmos filtros da tela de titulos (situacao, periodo, busca…).
 */
export async function titlesReport(
  companyId: string,
  direction: "PAYABLE" | "RECEIVABLE",
  sp: RawSearchParams,
) {
  const where = buildTitleWhere(companyId, sp, direction);
  const titles = await prisma.financialTitle.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: {
      partner: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = titles.map((t) => {
    const open = round2(D(t.totalAmount).minus(t.settledAmount));
    const overdue = open.greaterThan(0) && t.dueDate < today;
    return {
      id: t.id,
      partner: t.partner?.name ?? null,
      category: t.category?.name ?? null,
      description: t.description,
      documentNumber: t.documentNumber,
      dueDate: t.dueDate,
      issueDate: t.issueDate,
      totalAmount: round2(t.totalAmount).toFixed(2),
      settledAmount: round2(t.settledAmount).toFixed(2),
      openAmount: open.toFixed(2),
      status: t.status,
      overdue,
    };
  });

  const totalSum = items.reduce((acc, i) => acc.plus(i.totalAmount), D(0));
  const settledSum = items.reduce((acc, i) => acc.plus(i.settledAmount), D(0));
  const openSum = items.reduce((acc, i) => acc.plus(i.openAmount), D(0));
  const overdueSum = items
    .filter((i) => i.overdue)
    .reduce((acc, i) => acc.plus(i.openAmount), D(0));

  return {
    direction,
    items,
    summary: {
      count: items.length,
      totalAmount: round2(totalSum).toFixed(2),
      settledAmount: round2(settledSum).toFixed(2),
      openAmount: round2(openSum).toFixed(2),
      overdueAmount: round2(overdueSum).toFixed(2),
    },
  };
}

/**
 * DRE simplificado do periodo: receitas e despesas realizadas por categoria
 * (baseado nos lancamentos POSTED) e resultado liquido.
 */
export async function incomeStatement(companyId: string, sp: RawSearchParams) {
  const rows = await reportByCategory(companyId, sp);

  const revenues = rows
    .filter((r) => Number(r.inflow) > 0)
    .map((r) => ({ id: r.id, name: r.name, amount: r.inflow, count: r.count }));
  const expenses = rows
    .filter((r) => Number(r.outflow) > 0)
    .map((r) => ({ id: r.id, name: r.name, amount: r.outflow, count: r.count }));

  const totalRevenue = revenues.reduce((acc, r) => acc.plus(r.amount), D(0));
  const totalExpense = expenses.reduce((acc, r) => acc.plus(r.amount), D(0));
  const net = totalRevenue.minus(totalExpense);
  const margin = totalRevenue.isZero()
    ? D(0)
    : net.dividedBy(totalRevenue).times(100);

  return {
    revenues,
    expenses,
    totalRevenue: round2(totalRevenue).toFixed(2),
    totalExpense: round2(totalExpense).toFixed(2),
    net: round2(net).toFixed(2),
    margin: margin.toFixed(2),
    revenueCount: revenues.reduce((acc, r) => acc + r.count, 0),
    expenseCount: expenses.reduce((acc, r) => acc + r.count, 0),
  };
}
