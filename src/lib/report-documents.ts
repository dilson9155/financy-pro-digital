import {
  BANK_ACCOUNT_TYPE_LABELS,
  TITLE_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  formatCurrency,
  formatDate,
  formatPercent,
} from "@/lib/format";

/** Item de destaque exibido no topo do PDF. */
export interface ReportSummaryItem {
  label: string;
  value: string;
}

/** Bloco (tabela) do relatorio. */
export interface ReportSection {
  heading?: string;
  columns: string[];
  rows: string[][];
  /** Alinhamento por indice de coluna. */
  align?: Record<number, "left" | "right" | "center">;
}

/** Documento de relatorio pronto para exportacao. */
export interface ReportDocument {
  title: string;
  subtitle?: string;
  summary?: ReportSummaryItem[];
  sections: ReportSection[];
}

// -----------------------------------------------------------------------------
// DTOs (compartilhados com a tela de relatorios)
// -----------------------------------------------------------------------------

export interface GroupRow {
  id: string | null;
  name: string;
  inflow: string;
  outflow: string;
  net: string;
  count: number;
}

export interface AgingData {
  overdue: string;
  dueToday: string;
  due7: string;
  due30: string;
  dueLater: string;
  total: string;
}

export interface PositionRow {
  id: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: string;
  currentBalance: string;
  calculatedBalance: string;
  divergence: string;
  active: boolean;
}

export interface PositionsData {
  items: PositionRow[];
  total: string;
}

export interface TitleReportItem {
  id: string;
  partner: string | null;
  category: string | null;
  description: string;
  documentNumber: string | null;
  dueDate: string;
  issueDate: string;
  totalAmount: string;
  settledAmount: string;
  openAmount: string;
  status: string;
  overdue: boolean;
}

export interface TitleReportData {
  direction: "PAYABLE" | "RECEIVABLE";
  items: TitleReportItem[];
  summary: {
    count: number;
    totalAmount: string;
    settledAmount: string;
    openAmount: string;
    overdueAmount: string;
  };
}

export interface IncomeStatementLine {
  id: string | null;
  name: string;
  amount: string;
  count: number;
}

export interface IncomeStatementData {
  revenues: IncomeStatementLine[];
  expenses: IncomeStatementLine[];
  totalRevenue: string;
  totalExpense: string;
  net: string;
  margin: string;
  revenueCount: number;
  expenseCount: number;
}

export interface CashFlowRow {
  id: string;
  date: string;
  description: string;
  type: string;
  origin: string;
  amount: string;
  bankAccount: string;
  category: string | null;
  costCenter: string | null;
  balance: string;
}

export interface CashFlowData {
  period: { from: string | null; to: string | null };
  opening: string;
  inflow: string;
  outflow: string;
  net: string;
  closing: string;
  rows: CashFlowRow[];
  daily: { date: string; inflow: string; outflow: string; net: string }[];
}

// -----------------------------------------------------------------------------
// Construtores de documento (puros)
// -----------------------------------------------------------------------------

function rightAlign(columns: number[]): Record<number, "right"> {
  const align: Record<number, "right"> = {};
  for (const c of columns) align[c] = "right";
  return align;
}

function periodLabel(period?: { from?: string | null; to?: string | null }): string | undefined {
  if (!period) return undefined;
  const from = period.from ? formatDate(period.from) : null;
  const to = period.to ? formatDate(period.to) : null;
  if (from && to) return `Período: ${from} a ${to}`;
  if (from) return `A partir de ${from}`;
  if (to) return `Até ${to}`;
  return "Todo o período";
}

export function buildGroupDocument(
  kind: "category" | "cost-center",
  rows: GroupRow[],
  period?: { from?: string | null; to?: string | null },
): ReportDocument {
  const title = kind === "category" ? "Resultado por categoria" : "Resultado por centro de custo";
  const label = kind === "category" ? "Categoria" : "Centro de custo";

  const grandFlow = rows.reduce(
    (acc, r) => acc + Number(r.inflow) + Number(r.outflow),
    0,
  );
  const totalInflow = rows.reduce((acc, r) => acc + Number(r.inflow), 0);
  const totalOutflow = rows.reduce((acc, r) => acc + Number(r.outflow), 0);

  return {
    title,
    subtitle: periodLabel(period),
    summary: [
      { label: "Entradas", value: formatCurrency(totalInflow) },
      { label: "Saídas", value: formatCurrency(totalOutflow) },
      { label: "Resultado", value: formatCurrency(totalInflow - totalOutflow) },
    ],
    sections: [
      {
        heading: "Detalhamento",
        columns: [label, "Entradas", "Saídas", "Resultado", "Lançamentos", "% do total"],
        align: rightAlign([1, 2, 3, 4, 5]),
        rows: rows.map((r) => [
          r.name,
          formatCurrency(r.inflow),
          formatCurrency(r.outflow),
          formatCurrency(r.net),
          String(r.count),
          grandFlow > 0
            ? formatPercent(((Number(r.inflow) + Number(r.outflow)) / grandFlow) * 100)
            : "—",
        ]),
      },
    ],
  };
}

const AGING_BUCKETS: { key: keyof AgingData; label: string }[] = [
  { key: "overdue", label: "Vencidos" },
  { key: "dueToday", label: "Vencem hoje" },
  { key: "due7", label: "Até 7 dias" },
  { key: "due30", label: "Até 30 dias" },
  { key: "dueLater", label: "Depois de 30 dias" },
  { key: "total", label: "Total em aberto" },
];

export function buildAgingDocument(
  data: AgingData,
  direction: "PAYABLE" | "RECEIVABLE",
): ReportDocument {
  return {
    title: direction === "PAYABLE" ? "Vencimentos — contas a pagar" : "Vencimentos — contas a receber",
    summary: [
      { label: "Vencidos", value: formatCurrency(data.overdue) },
      { label: "Vencem hoje", value: formatCurrency(data.dueToday) },
      { label: "Total em aberto", value: formatCurrency(data.total) },
    ],
    sections: [
      {
        heading: "Faixas de vencimento",
        columns: ["Faixa", "Valor"],
        align: rightAlign([1]),
        rows: AGING_BUCKETS.map((b) => [b.label, formatCurrency(data[b.key])]),
      },
    ],
  };
}

export function buildPositionsDocument(data: PositionsData): ReportDocument {
  return {
    title: "Posições de contas e caixas",
    subtitle: "Saldo atual (ledger) × saldo calculado",
    summary: [{ label: "Total em contas ativas", value: formatCurrency(data.total) }],
    sections: [
      {
        columns: ["Conta", "Tipo", "Saldo atual", "Calculado", "Divergência", "Situação"],
        align: rightAlign([2, 3, 4]),
        rows: data.items.map((a) => [
          a.name,
          BANK_ACCOUNT_TYPE_LABELS[a.type] ?? a.type,
          formatCurrency(a.currentBalance),
          formatCurrency(a.calculatedBalance),
          formatCurrency(a.divergence),
          a.active ? "Ativa" : "Inativa",
        ]),
      },
    ],
  };
}

export function buildTitlesDocument(
  data: TitleReportData,
  period?: { from?: string | null; to?: string | null },
): ReportDocument {
  const isPayable = data.direction === "PAYABLE";
  return {
    title: isPayable ? "Contas a pagar" : "Contas a receber",
    subtitle: periodLabel(period),
    summary: [
      { label: "Títulos", value: String(data.summary.count) },
      { label: "Valor total", value: formatCurrency(data.summary.totalAmount) },
      { label: "Liquidado", value: formatCurrency(data.summary.settledAmount) },
      { label: "Em aberto", value: formatCurrency(data.summary.openAmount) },
      { label: "Vencido", value: formatCurrency(data.summary.overdueAmount) },
    ],
    sections: [
      {
        heading: "Relação de títulos",
        columns: [
          "Parceiro",
          "Descrição",
          "Vencimento",
          "Total",
          "Pago",
          "Em aberto",
          "Situação",
        ],
        align: rightAlign([3, 4, 5]),
        rows: data.items.map((t) => [
          t.partner ?? "—",
          t.description,
          formatDate(t.dueDate),
          formatCurrency(t.totalAmount),
          formatCurrency(t.settledAmount),
          formatCurrency(t.openAmount),
          `${TITLE_STATUS_LABELS[t.status] ?? t.status}${t.overdue ? " (vencido)" : ""}`,
        ]),
      },
    ],
  };
}

export function buildIncomeStatementDocument(
  data: IncomeStatementData,
  period?: { from?: string | null; to?: string | null },
): ReportDocument {
  return {
    title: "DRE — Demonstrativo do resultado",
    subtitle: periodLabel(period),
    summary: [
      { label: "Receitas", value: formatCurrency(data.totalRevenue) },
      { label: "Despesas", value: formatCurrency(data.totalExpense) },
      { label: "Resultado", value: formatCurrency(data.net) },
      { label: "Margem", value: formatPercent(Number(data.margin)) },
    ],
    sections: [
      {
        heading: "Receitas",
        columns: ["Categoria", "Valor", "Lançamentos"],
        align: rightAlign([1, 2]),
        rows: [
          ...data.revenues.map((r) => [r.name, formatCurrency(r.amount), String(r.count)]),
          ["Total de receitas", formatCurrency(data.totalRevenue), String(data.revenueCount)],
        ],
      },
      {
        heading: "Despesas",
        columns: ["Categoria", "Valor", "Lançamentos"],
        align: rightAlign([1, 2]),
        rows: [
          ...data.expenses.map((r) => [r.name, formatCurrency(r.amount), String(r.count)]),
          ["Total de despesas", formatCurrency(data.totalExpense), String(data.expenseCount)],
        ],
      },
      {
        heading: "Resultado",
        columns: ["Descrição", "Valor"],
        align: rightAlign([1]),
        rows: [
          ["Receitas", formatCurrency(data.totalRevenue)],
          ["(-) Despesas", formatCurrency(data.totalExpense)],
          ["(=) Resultado líquido", formatCurrency(data.net)],
          ["Margem líquida", formatPercent(Number(data.margin))],
        ],
      },
    ],
  };
}

export function buildCashFlowDocument(
  data: CashFlowData,
  period?: { from?: string | null; to?: string | null },
): ReportDocument {
  return {
    title: "Movimento de caixa",
    subtitle: periodLabel(period ?? data.period),
    summary: [
      { label: "Saldo inicial", value: formatCurrency(data.opening) },
      { label: "Entradas", value: formatCurrency(data.inflow) },
      { label: "Saídas", value: formatCurrency(data.outflow) },
      { label: "Resultado", value: formatCurrency(data.net) },
      { label: "Saldo final", value: formatCurrency(data.closing) },
    ],
    sections: [
      {
        heading: "Consolidado diário",
        columns: ["Data", "Entradas", "Saídas", "Resultado"],
        align: rightAlign([1, 2, 3]),
        rows: data.daily.map((d) => [
          formatDate(d.date),
          formatCurrency(d.inflow),
          formatCurrency(d.outflow),
          formatCurrency(d.net),
        ]),
      },
      {
        heading: "Lançamentos",
        columns: ["Data", "Descrição", "Conta", "Categoria", "Tipo", "Valor", "Saldo"],
        align: rightAlign([5, 6]),
        rows: data.rows.map((r) => [
          formatDate(r.date),
          r.description,
          r.bankAccount,
          r.category ?? "—",
          TRANSACTION_TYPE_LABELS[r.type] ?? r.type,
          formatCurrency(r.amount),
          formatCurrency(r.balance),
        ]),
      },
    ],
  };
}
