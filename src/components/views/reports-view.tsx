"use client";

import { useMemo, useState } from "react";
import { buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useCan, useSession } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  EmptyState,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { CashFlowChart, CategoryPie } from "@/components/charts";
import { formatCurrency, formatDate } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import {
  buildAgingDocument,
  buildCashFlowDocument,
  buildGroupDocument,
  buildIncomeStatementDocument,
  buildPositionsDocument,
  buildTitlesDocument,
  type AgingData,
  type CashFlowData,
  type GroupRow,
  type IncomeStatementData,
  type PositionsData,
  type ReportDocument,
  type TitleReportData,
} from "@/lib/report-documents";

type Tab =
  | "category"
  | "cost-center"
  | "aging"
  | "positions"
  | "payables"
  | "receivables"
  | "dre"
  | "cashflow";

interface TabDef {
  id: Tab;
  label: string;
  /** Permissao extra necessaria (alem de reports.view). */
  permission?: string;
}

const TABS: TabDef[] = [
  { id: "category", label: "Por categoria" },
  { id: "cost-center", label: "Por centro de custo" },
  { id: "aging", label: "Vencimentos" },
  { id: "positions", label: "Posições de contas" },
  { id: "payables", label: "Contas a pagar" },
  { id: "receivables", label: "Contas a receber" },
  { id: "dre", label: "DRE" },
  { id: "cashflow", label: "Movimento de caixa", permission: PERMISSIONS.CASH_FLOW_VIEW },
];

const REPORT_TITLES: Record<Tab, string> = {
  category: "Resultado por categoria",
  "cost-center": "Resultado por centro de custo",
  aging: "Vencimentos",
  positions: "Posições de contas e caixas",
  payables: "Contas a pagar",
  receivables: "Contas a receber",
  dre: "DRE — Demonstrativo do resultado",
  cashflow: "Movimento de caixa",
};

const AGING_BUCKETS: { key: keyof AgingData; label: string; tone?: "destructive" | "warning" }[] = [
  { key: "overdue", label: "Vencidos", tone: "destructive" },
  { key: "dueToday", label: "Vencem hoje", tone: "warning" },
  { key: "due7", label: "Até 7 dias" },
  { key: "due30", label: "Até 30 dias" },
  { key: "dueLater", label: "Depois de 30 dias" },
  { key: "total", label: "Total em aberto" },
];

function isoDate(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

function periodLabel(applied: FilterValues): string {
  const from = applied.from ? formatDate(isoDate(applied.from)) : null;
  const to = applied.to ? formatDate(isoDate(applied.to)) : null;
  if (from && to) return `Período: ${from} a ${to}`;
  if (from) return `A partir de ${from}`;
  if (to) return `Até ${to}`;
  return "Todo o período";
}

/** Renderiza um documento de relatorio (destaques + secoes) — usado nas novas abas. */
function DocumentPreview({ doc }: { doc: ReportDocument | null }) {
  if (!doc) return null;
  return (
    <div className="space-y-6 p-5">
      {doc.summary && doc.summary.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {doc.summary.map((s) => (
            <div key={s.label} className="rounded-lg border p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 text-lg font-bold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {doc.sections.map((section, si) => (
        <div key={`${section.heading ?? "secao"}-${si}`}>
          {section.heading ? (
            <p className="mb-2 text-sm font-semibold text-primary">{section.heading}</p>
          ) : null}
          {section.rows.length === 0 ? (
            <EmptyState
              title="Sem dados"
              description="Nenhum registro para os filtros selecionados."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  {section.columns.map((col, ci) => (
                    <TH key={ci} align={section.align?.[ci] ?? "left"}>
                      {col}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {section.rows.map((row, ri) => (
                  <TR key={ri}>
                    {row.map((cell, ci) => (
                      <TD
                        key={ci}
                        align={section.align?.[ci] ?? "left"}
                        className={ci === 0 ? "font-medium" : ""}
                      >
                        {cell}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReportsView() {
  const can = useCan();
  const session = useSession();
  const { notify } = useToast();
  const today = useMemo(() => new Date(), []);
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const [tab, setTab] = useState<Tab>("category");
  const [values, setValues] = useState<FilterValues>({ from: monthStart });
  const [applied, setApplied] = useState<FilterValues>({ from: monthStart });
  const [agingDirection, setAgingDirection] = useState<"PAYABLE" | "RECEIVABLE">("PAYABLE");
  const [exporting, setExporting] = useState(false);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.permission || can(t.permission)),
    [can],
  );

  const periodQs = useMemo(
    () =>
      buildQuery({
        from: applied.from ? isoDate(applied.from) : undefined,
        to: applied.to ? isoDate(applied.to) : undefined,
        categoryId: applied.categoryId,
        costCenterId: applied.costCenterId,
      }),
    [applied],
  );

  // Titulos usam dueFrom/dueTo (vencimento), nao from/to.
  const titlesQs = useMemo(
    () =>
      buildQuery({
        dueFrom: applied.from ? isoDate(applied.from) : undefined,
        dueTo: applied.to ? isoDate(applied.to) : undefined,
        categoryId: applied.categoryId,
      }),
    [applied],
  );

  const { data: categories, loading: loadingCat, error: errorCat, reload: reloadCat } =
    useApiQuery<GroupRow[]>(tab === "category" ? `/api/reports/by-category${periodQs}` : null);
  const { data: centers, loading: loadingCenter, error: errorCenter, reload: reloadCenter } =
    useApiQuery<GroupRow[]>(tab === "cost-center" ? `/api/reports/by-cost-center${periodQs}` : null);
  const { data: aging, loading: loadingAging, error: errorAging, reload: reloadAging } =
    useApiQuery<AgingData>(tab === "aging" ? `/api/reports/aging?direction=${agingDirection}` : null);
  const { data: positions, loading: loadingPos, error: errorPos, reload: reloadPos } =
    useApiQuery<PositionsData>(tab === "positions" ? "/api/reports/account-positions" : null);
  const { data: payables, loading: loadingPay, error: errorPay, reload: reloadPay } =
    useApiQuery<TitleReportData>(tab === "payables" ? `/api/reports/titles?direction=PAYABLE${titlesQs}` : null);
  const { data: receivables, loading: loadingRec, error: errorRec, reload: reloadRec } =
    useApiQuery<TitleReportData>(tab === "receivables" ? `/api/reports/titles?direction=RECEIVABLE${titlesQs}` : null);
  const { data: dre, loading: loadingDre, error: errorDre, reload: reloadDre } =
    useApiQuery<IncomeStatementData>(tab === "dre" ? `/api/reports/income-statement${periodQs}` : null);
  const { data: cashflow, loading: loadingCash, error: errorCash, reload: reloadCash } =
    useApiQuery<CashFlowData>(tab === "cashflow" ? `/api/reports/cash-flow${periodQs}` : null);

  const state: { loading: boolean; error: string | null; reload: () => void } = (() => {
    switch (tab) {
      case "category":
        return { loading: loadingCat, error: errorCat, reload: reloadCat };
      case "cost-center":
        return { loading: loadingCenter, error: errorCenter, reload: reloadCenter };
      case "aging":
        return { loading: loadingAging, error: errorAging, reload: reloadAging };
      case "positions":
        return { loading: loadingPos, error: errorPos, reload: reloadPos };
      case "payables":
        return { loading: loadingPay, error: errorPay, reload: reloadPay };
      case "receivables":
        return { loading: loadingRec, error: errorRec, reload: reloadRec };
      case "dre":
        return { loading: loadingDre, error: errorDre, reload: reloadDre };
      default:
        return { loading: loadingCash, error: errorCash, reload: reloadCash };
    }
  })();

  const period = {
    from: applied.from ? isoDate(applied.from) : null,
    to: applied.to ? isoDate(applied.to) : null,
  };

  /** Documento para exportacao/impressao do relatorio ativo. */
  function buildDocument(): ReportDocument | null {
    const p = { from: period.from, to: period.to };
    switch (tab) {
      case "category":
        return categories ? buildGroupDocument("category", categories, p) : null;
      case "cost-center":
        return centers ? buildGroupDocument("cost-center", centers, p) : null;
      case "aging":
        return aging ? buildAgingDocument(aging, agingDirection) : null;
      case "positions":
        return positions ? buildPositionsDocument(positions) : null;
      case "payables":
        return payables ? buildTitlesDocument(payables, p) : null;
      case "receivables":
        return receivables ? buildTitlesDocument(receivables, p) : null;
      case "dre":
        return dre ? buildIncomeStatementDocument(dre, p) : null;
      default:
        return cashflow ? buildCashFlowDocument(cashflow, p) : null;
    }
  }

  async function handleExport() {
    const doc = buildDocument();
    if (!doc) {
      notify("Nada para exportar ainda.", "error");
      return;
    }
    setExporting(true);
    try {
      const { exportReportPdf } = await import("@/lib/report-export");
      await exportReportPdf(doc, {
        company: {
          name: session.company.name,
          legalName: session.company.legalName,
          document: session.company.document,
          email: session.company.email,
          phone: session.company.phone,
          address: session.company.address,
          logoUrl: session.company.logoUrl,
        },
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao gerar o PDF.", "error");
    } finally {
      setExporting(false);
    }
  }

  const showPeriodFilter = tab !== "positions" && tab !== "aging";

  const filters2 = useMemo(
    () => [
      { key: "from", label: "De", type: "date" as const },
      { key: "to", label: "Até", type: "date" as const },
    ],
    [],
  );

  const company = session.company;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Análises gerenciais sobre o realizado (lançamentos) e posições.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button onClick={handleExport} disabled={exporting || state.loading}>
            {exporting ? <Spinner /> : null} Exportar PDF
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1 print:hidden">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {showPeriodFilter ? (
        <div className="print:hidden">
          <FilterBar
            fields={filters2}
            values={values}
            onChange={setValues}
            onSubmit={() => setApplied(values)}
            onReset={() => {
              setValues({ from: monthStart });
              setApplied({ from: monthStart });
            }}
            loading={state.loading}
          />
        </div>
      ) : null}

      {tab === "aging" ? (
        <div className="flex items-center justify-end gap-2 print:hidden">
          <Button
            variant={agingDirection === "PAYABLE" ? "primary" : "outline"}
            size="sm"
            onClick={() => setAgingDirection("PAYABLE")}
          >
            A pagar
          </Button>
          <Button
            variant={agingDirection === "RECEIVABLE" ? "primary" : "outline"}
            size="sm"
            onClick={() => setAgingDirection("RECEIVABLE")}
          >
            A receber
          </Button>
        </div>
      ) : null}

      {/* Cabecalho institucional (aparece na tela e na impressao) */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="flex flex-col gap-3 border-b pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt={company.name || "Logo"}
                className="h-12 w-12 shrink-0 rounded-md object-contain"
              />
            ) : null}
            <div>
              <p className="text-lg font-bold text-primary">{company.name || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {[company.document, company.email, company.phone]
                  .filter(Boolean)
                  .join("  •  ") || "—"}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-base font-semibold">{REPORT_TITLES[tab]}</p>
            <p className="text-xs text-muted-foreground">{periodLabel(applied)}</p>
            <p className="text-[11px] text-muted-foreground">
              Gerado em {new Date().toLocaleString("pt-BR")}
            </p>
          </div>
        </CardContent>

        {state.loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Spinner /> Carregando…
          </div>
        ) : state.error ? (
          <EmptyState
            title="Erro ao carregar"
            description={state.error}
            action={
              <button onClick={state.reload} className="text-primary">
                Tentar novamente
              </button>
            }
          />
        ) : tab === "category" ? (
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-3">
            <div className="p-5 lg:col-span-1">
              <CategoryPie
                data={categories?.map((c) => ({ name: c.name, outflow: c.outflow })) ?? []}
              />
            </div>
            <div className="lg:col-span-2">
              <DocumentPreview doc={categories ? buildGroupDocument("category", categories, period) : null} />
            </div>
          </div>
        ) : tab === "cost-center" ? (
          <DocumentPreview doc={centers ? buildGroupDocument("cost-center", centers, period) : null} />
        ) : tab === "aging" && aging ? (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {AGING_BUCKETS.map((b) => (
              <div key={b.key} className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {b.label}
                </p>
                <p
                  className={
                    b.key === "total"
                      ? "mt-1 text-2xl font-bold tracking-tight"
                      : b.tone === "destructive"
                        ? "mt-1 text-2xl font-bold tracking-tight text-red-600"
                        : b.tone === "warning"
                          ? "mt-1 text-2xl font-bold tracking-tight text-amber-600"
                          : "mt-1 text-2xl font-bold tracking-tight"
                  }
                >
                  {formatCurrency(aging[b.key])}
                </p>
              </div>
            ))}
          </div>
        ) : tab === "positions" && positions ? (
          <div>
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <CardTitle>Contas e caixas</CardTitle>
                <CardDescription>
                  Saldo atual (derivado do ledger) × saldo calculado pela soma dos lançamentos.
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total ativas</p>
                <p className="text-lg font-bold">{formatCurrency(positions.total)}</p>
              </div>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Conta</TH>
                  <TH className="hidden md:table-cell">Tipo</TH>
                  <TH align="right">Saldo atual</TH>
                  <TH align="right" className="hidden md:table-cell">Calculado</TH>
                  <TH align="right">Divergência</TH>
                </TR>
              </THead>
              <TBody>
                {positions.items.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <p className="font-medium">{a.name}</p>
                      {!a.active ? <Badge tone="gray">Inativa</Badge> : null}
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {a.type === "BANK" ? "Banco" : a.type === "CASH" ? "Caixa" : a.type === "INVESTMENT" ? "Investimento" : "Outro"}
                    </TD>
                    <TD align="right" className="whitespace-nowrap font-medium">
                      {formatCurrency(a.currentBalance)}
                    </TD>
                    <TD align="right" className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatCurrency(a.calculatedBalance)}
                    </TD>
                    <TD align="right" className="whitespace-nowrap">
                      {Number(a.divergence) === 0 ? (
                        <Badge tone="green">OK</Badge>
                      ) : (
                        <Badge tone="red">{formatCurrency(a.divergence)}</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : tab === "cashflow" && cashflow ? (
          <div className="space-y-4 pt-5">
            <div className="px-5">
              <CashFlowChart
                data={cashflow.daily.map((d) => ({
                  label: formatDate(d.date),
                  inflow: d.inflow,
                  outflow: d.outflow,
                  net: d.net,
                }))}
              />
            </div>
            <DocumentPreview doc={buildCashFlowDocument(cashflow, period)} />
          </div>
        ) : tab === "payables" || tab === "receivables" || tab === "dre" ? (
          <DocumentPreview doc={buildDocument()} />
        ) : (
          <DocumentPreview doc={buildDocument()} />
        )}
      </Card>
    </div>
  );
}
