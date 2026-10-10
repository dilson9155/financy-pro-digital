import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D, isGreaterThan, round2 } from "@/lib/money";

export type OverdueDirection = "ALL" | "RECEIVABLE" | "PAYABLE";
export type OverdueBucket = "0-30" | "31-60" | "61-90" | "90+";

export interface OverdueInstallment {
  id: string;
  number: number;
  dueDate: string;
  remaining: string;
  daysOverdue: number;
}

export interface OverdueItem {
  id: string;
  direction: string;
  description: string;
  documentNumber: string | null;
  /** Soma do saldo em aberto das parcelas vencidas (e nao baixadas). */
  openAmount: string;
  totalAmount: string;
  status: string;
  /** Maior atraso entre as parcelas vencidas (a mais antiga). */
  daysOverdue: number;
  bucket: OverdueBucket;
  /** Data de vencimento da parcela mais antiga ainda em atraso. */
  dueDate: string;
  overdueInstallments: OverdueInstallment[];
  partner: { id: string; name: string; document: string | null } | null;
  category: { id: string; name: string } | null;
}

export interface OverdueBucketSummary {
  key: OverdueBucket;
  label: string;
  count: number;
  amount: string;
}

export interface OverdueDirectionSummary {
  count: number;
  amount: string;
}

export interface OverdueSummary {
  totalCount: number;
  totalAmount: string;
  byBucket: OverdueBucketSummary[];
  byDirection: {
    PAYABLE: OverdueDirectionSummary;
    RECEIVABLE: OverdueDirectionSummary;
  };
}

export interface OverdueScanResult {
  items: OverdueItem[];
  summary: OverdueSummary;
  scannedAt: string;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketOf(days: number): OverdueBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

const BUCKET_LABELS: Record<OverdueBucket, string> = {
  "0-30": "1 a 30 dias",
  "31-60": "31 a 60 dias",
  "61-90": "61 a 90 dias",
  "90+": "Mais de 90 dias",
};

/**
 * Faz a varredura **por parcela**: entra em cada conta (titulo) e olha cada
 * TitleInstallment, incluindo apenas as parcelas que venceram e nao foram
 * totalmente baixadas. Os titulos sao agrupados (uma linha por titulo) com
 * o total em aberto = soma dos saldos das parcelas vencidas, e a maior
 * espera = dias da parcela mais antiga em atraso.
 *
 * Se `direction` for informado, filtra para "PAYABLE" ou "RECEIVABLE".
 *
 * O "vencido" e derivado da parcela (status OPEN/PARTIAL + dueDate < hoje),
 * nao da data do titulo.
 */
export async function scanOverdueTitles(
  companyId: string,
  direction: OverdueDirection = "ALL",
): Promise<OverdueScanResult> {
  const today = startOfToday();

  const where: Prisma.TitleInstallmentWhereInput = {
    companyId,
    status: { in: ["OPEN", "PARTIAL"] },
    dueDate: { lt: today },
  };
  if (direction === "RECEIVABLE" || direction === "PAYABLE") {
    where.title = { direction };
  }

  // 1) busca todas as parcelas vencidas e nao baixadas (com o titulo/pai)
  const installments = await prisma.titleInstallment.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: {
      title: {
        include: {
          partner: { select: { id: true, name: true, document: true } },
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  // 2) agrupa por titulo: soma saldos, maior atraso, parcela mais antiga
  type Group = {
    titleId: string;
    title: (typeof installments)[number]["title"];
    overdueInstallments: OverdueInstallment[];
    totalOpen: ReturnType<typeof D>;
    worstDays: number;
    oldestDue: Date;
  };

  const groups = new Map<string, Group>();
  for (const inst of installments) {
    const remaining = round2(D(inst.amount).minus(inst.paidAmount));
    if (!isGreaterThan(remaining, 0)) continue;

    const days = Math.max(
      0,
      Math.floor(
        (today.getTime() - new Date(inst.dueDate).getTime()) / 86_400_000,
      ),
    );

    let g = groups.get(inst.titleId);
    if (!g) {
      g = {
        titleId: inst.titleId,
        title: inst.title,
        overdueInstallments: [],
        totalOpen: D(0),
        worstDays: 0,
        oldestDue: inst.dueDate,
      };
      groups.set(inst.titleId, g);
    }
    g.overdueInstallments.push({
      id: inst.id,
      number: inst.number,
      dueDate: inst.dueDate.toISOString(),
      remaining: remaining.toFixed(2),
      daysOverdue: days,
    });
    g.totalOpen = round2(g.totalOpen.plus(remaining));
    if (days > g.worstDays) g.worstDays = days;
    if (inst.dueDate.getTime() < g.oldestDue.getTime()) g.oldestDue = inst.dueDate;
  }

  // 3) monta a lista (ordenada pela parcela mais antiga em atraso)
  const items: OverdueItem[] = Array.from(groups.values())
    .sort((a, b) => a.oldestDue.getTime() - b.oldestDue.getTime())
    .map((g) => {
      const open = g.totalOpen;
      return {
        id: g.titleId,
        direction: g.title.direction,
        description: g.title.description,
        documentNumber: g.title.documentNumber,
        openAmount: open.toFixed(2),
        totalAmount: round2(g.title.totalAmount).toFixed(2),
        status: g.title.status,
        daysOverdue: g.worstDays,
        bucket: bucketOf(g.worstDays),
        dueDate: g.oldestDue.toISOString(),
        overdueInstallments: g.overdueInstallments.sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        ),
        partner: g.title.partner,
        category: g.title.category,
      };
    });

  // 4) agrega o resumo
  const counts: Record<OverdueBucket, number> = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  const amounts: Record<OverdueBucket, ReturnType<typeof D>> = {
    "0-30": D(0),
    "31-60": D(0),
    "61-90": D(0),
    "90+": D(0),
  };
  const dirCounts = { PAYABLE: 0, RECEIVABLE: 0 };
  const dirAmounts = { PAYABLE: D(0), RECEIVABLE: D(0) };
  let totalAmount = D(0);

  for (const it of items) {
    counts[it.bucket] += 1;
    amounts[it.bucket] = round2(amounts[it.bucket].plus(it.openAmount));
    const dir = it.direction === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
    dirCounts[dir] += 1;
    dirAmounts[dir] = round2(dirAmounts[dir].plus(it.openAmount));
    totalAmount = round2(totalAmount.plus(it.openAmount));
  }

  const summary: OverdueSummary = {
    totalCount: items.length,
    totalAmount: totalAmount.toFixed(2),
    byBucket: (Object.keys(counts) as OverdueBucket[]).map((key) => ({
      key,
      label: BUCKET_LABELS[key],
      count: counts[key],
      amount: amounts[key].toFixed(2),
    })),
    byDirection: {
      PAYABLE: {
        count: dirCounts.PAYABLE,
        amount: dirAmounts.PAYABLE.toFixed(2),
      },
      RECEIVABLE: {
        count: dirCounts.RECEIVABLE,
        amount: dirAmounts.RECEIVABLE.toFixed(2),
      },
    },
  };

  return {
    items,
    summary,
    scannedAt: new Date().toISOString(),
  };
}
