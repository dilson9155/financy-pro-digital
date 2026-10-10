import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D, isGreaterThan, round2 } from "@/lib/money";

export type OverdueDirection = "ALL" | "RECEIVABLE" | "PAYABLE";
export type OverdueBucket = "0-30" | "31-60" | "61-90" | "90+";

export interface OverdueItem {
  id: string;
  direction: string;
  description: string;
  documentNumber: string | null;
  dueDate: string;
  daysOverdue: number;
  bucket: OverdueBucket;
  totalAmount: string;
  settledAmount: string;
  openAmount: string;
  status: string;
  partner: { id: string; name: string; document: string | null } | null;
  category: { id: string; name: string } | null;
}

export interface OverdueBucketSummary {
  key: OverdueBucket;
  label: string;
  count: number;
  amount: string;
}

export interface OverdueSummary {
  totalCount: number;
  totalAmount: string;
  byBucket: OverdueBucketSummary[];
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
 * Faz a varredura dos titulos em aberto/parcial com vencimento anterior a hoje
 * (escopo da empresa ativa) e devolve a lista ordenada, o resumo por faixa
 * de atraso e o timestamp da varredura.
 *
 * O "vencido" e derivado (status permanece OPEN/PARTIAL; a classificacao
 * "vencido" vem do cruzamento status + data de vencimento).
 */
export async function scanOverdueTitles(
  companyId: string,
  direction: OverdueDirection = "ALL",
): Promise<OverdueScanResult> {
  const today = startOfToday();

  const where: Prisma.FinancialTitleWhereInput = {
    companyId,
    status: { in: ["OPEN", "PARTIAL"] },
    dueDate: { lt: today },
  };
  if (direction === "RECEIVABLE" || direction === "PAYABLE") {
    where.direction = direction;
  }

  const rows = await prisma.financialTitle.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: {
      partner: { select: { id: true, name: true, document: true } },
      category: { select: { id: true, name: true } },
    },
  });

  const items: OverdueItem[] = [];
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
  let totalAmount = D(0);

  for (const t of rows) {
    const open = round2(D(t.totalAmount).minus(t.settledAmount));
    if (!isGreaterThan(open, 0)) continue;

    const days = Math.max(
      0,
      Math.floor(
        (today.getTime() - new Date(t.dueDate).getTime()) / 86_400_000,
      ),
    );
    const bucket = bucketOf(days);

    items.push({
      id: t.id,
      direction: t.direction,
      description: t.description,
      documentNumber: t.documentNumber,
      dueDate: t.dueDate.toISOString(),
      daysOverdue: days,
      bucket,
      totalAmount: round2(t.totalAmount).toFixed(2),
      settledAmount: round2(t.settledAmount).toFixed(2),
      openAmount: open.toFixed(2),
      status: t.status,
      partner: t.partner,
      category: t.category,
    });

    counts[bucket] += 1;
    amounts[bucket] = round2(amounts[bucket].plus(open));
    totalAmount = round2(totalAmount.plus(open));
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
  };

  return {
    items,
    summary,
    scannedAt: new Date().toISOString(),
  };
}
