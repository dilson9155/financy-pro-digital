"use client";

import { useEffect, useMemo, useState } from "react";
import { api, buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useCan } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  statusTone,
} from "@/components/ui";
import { CategoryPie, CashFlowChart } from "@/components/charts";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

type Tab = "category" | "cost-center" | "aging" | "positions";

interface GroupRow {
  id: string | null;
  name: string;
  inflow: string;
  outflow: string;
  net: string;
  count: number;
}

interface Aging {
  overdue: string;
  dueToday: string;
  due7: string;
  due30: string;
  dueLater: string;
  total: string;
}

interface Positions {
  items: {
    id: string;
    name: string;
    type: string;
    currency: string;
    initialBalance: string;
    currentBalance: string;
    calculatedBalance: string;
    divergence: string;
    active: boolean;
  }[];
  total: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "category", label: "Por categoria" },
  { id: "cost-center", label: "Por centro de custo" },
  { id: "aging", label: "Vencimentos" },
  { id: "positions", label: "Posições de contas" },
];

export function ReportsView() {
  const can = useCan();
  const { notify } = useToast();
  const today = useMemo(() => new Date(), []);
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const [tab, setTab] = useState<Tab>("category");
  const [values, setValues] = useState<FilterValues>({});
  const [applied, setApplied] = useState<FilterValues>({});
  const [agingDirection, setAgingDirection] = useState<"PAYABLE" | "RECEIVABLE">(
    "PAYABLE",
  );

  function isoDate(value: string): string {
    return new Date(`${value}T12:00:00`).toISOString();
  }

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

  const categoryUrl = useMemo(
    () => `/api/reports/by-category${periodQs}`,
    [periodQs],
  );
  const costCenterUrl = useMemo(
    () => `/api/reports/by-cost-center${periodQs}`,
    [periodQs],
  );

  const { data: categories, loading: loadingCat, error: errorCat, reload: reloadCat } =
    useApiQuery<GroupRow[]>(tab === "category" ? categoryUrl : null);
  const { data: centers, loading: loadingCenter, error: errorCenter, reload: reloadCenter } =
    useApiQuery<GroupRow[]>(tab === "cost-center" ? costCenterUrl : null);
  const { data: aging, loading: loadingAging, error: errorAging, reload: reloadAging } =
    useApiQuery<Aging>(
      tab === "aging" ? `/api/reports/aging?direction=${agingDirection}` : null,
    );
  const { data: positions, loading: loadingPos, error: errorPos, reload: reloadPos } =
    useApiQuery<Positions>(tab === "positions" ? "/api/reports/account-positions" : null);

  function reload() {
    if (tab === "category") void reloadCat();
    else if (tab === "cost-center") void reloadCenter();
    else if (tab === "aging") void reloadAging();
    else void reloadPos();
  }

  const filters2 = useMemo(
    () => [
      { key: "from", label: "De", type: "date" as const },
      { key: "to", label: "Até", type: "date" as const },
    ],
    [],
  );

  const loading = tab === "category" ? loadingCat : tab === "cost-center" ? loadingCenter : tab === "aging" ? loadingAging : loadingPos;
  const error = tab === "category" ? errorCat : tab === "cost-center" ? errorCenter : tab === "aging" ? errorAging : errorPos;

  function renderGroupRows(rows: GroupRow[] | null) {
    if (!rows) return null;
    if (rows.length === 0) {
      return <EmptyState title="Sem dados no período" description="Nenhuma movimentação encontrada para os filtros." />;
    }
    return (
      <Table>
        <THead>
          <TR>
            <TH>{tab === "category" ? "Categoria" : "Centro de custo"}</TH>
            <TH align="right">Entradas</TH>
            <TH align="right">Saídas</TH>
            <TH align="right">Resultado</TH>
            <TH align="right" className="hidden md:table-cell">Lançamentos</TH>
            <TH align="right" className="hidden lg:table-cell">% do total</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            const totalFlow = Number(r.inflow) + Number(r.outflow);
            const grand = rows.reduce((acc, x) => acc + Number(x.inflow) + Number(x.outflow), 0);
            return (
              <TR key={r.id ?? r.name}>
                <TD className="font-medium">{r.name}</TD>
                <TD align="right" className="whitespace-nowrap text-emerald-600">{formatCurrency(r.inflow)}</TD>
                <TD align="right" className="whitespace-nowrap text-red-600">{formatCurrency(r.outflow)}</TD>
                <TD align="right" className="whitespace-nowrap font-medium">
                  <span className={Number(r.net) >= 0 ? "text-emerald-700" : "text-red-700"}>
                    {formatCurrency(r.net)}
                  </span>
                </TD>
                <TD align="right" className="hidden text-muted-foreground md:table-cell">{r.count}</TD>
                <TD align="right" className="hidden lg:table-cell">
                  {grand > 0 ? formatPercent((totalFlow / grand) * 100) : "—"}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    );
  }

  const AGING_BUCKETS: { key: keyof Aging; label: string; tone?: "success" | "destructive" | "warning" }[] = [
    { key: "overdue", label: "Vencidos", tone: "destructive" },
    { key: "dueToday", label: "Vencem hoje", tone: "warning" },
    { key: "due7", label: "Até 7 dias" },
    { key: "due30", label: "Até 30 dias" },
    { key: "dueLater", label: "Depois de 30 dias" },
    { key: "total", label: "Total em aberto" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Análises gerenciais sobre o realizado (lançamentos) e posições.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
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

      {tab !== "positions" && tab !== "aging" ? (
        <FilterBar
          fields={filters2}
          values={values}
          onChange={setValues}
          onSubmit={() => setApplied(values)}
          onReset={() => {
            setValues({ from: monthStart });
            setApplied({ from: monthStart });
          }}
          loading={loading}
        />
      ) : null}

      {tab === "aging" ? (
        <div className="flex items-center justify-end gap-2">
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> Carregando…
            </div>
          ) : error ? (
            <EmptyState title="Erro ao carregar" description={error} action={<button onClick={reload} className="text-primary">Tentar novamente</button>} />
          ) : tab === "category" ? (
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-3">
              <div className="p-5 lg:col-span-1">
                <CategoryPie data={categories?.map((c) => ({ name: c.name, outflow: c.outflow })) ?? []} />
              </div>
              <div className="lg:col-span-2">{renderGroupRows(categories)}</div>
            </div>
          ) : tab === "cost-center" ? (
            renderGroupRows(centers)
          ) : tab === "aging" && aging ? (
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {AGING_BUCKETS.map((b) => (
                <div key={b.key} className="rounded-lg border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{b.label}</p>
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
            <div className="p-0">
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
                      <TD align="right" className="whitespace-nowrap font-medium">{formatCurrency(a.currentBalance)}</TD>
                      <TD align="right" className="hidden whitespace-nowrap text-muted-foreground md:table-cell">{formatCurrency(a.calculatedBalance)}</TD>
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
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}