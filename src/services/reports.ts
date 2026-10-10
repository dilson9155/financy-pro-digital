import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D, round2 } from "@/lib/money";
import { buildTransactionWhere } from "./transactions";
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
