"use client";

import { useEffect, useMemo, useState } from "react";
import { buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { api } from "@/lib/client";
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
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  statusTone,
} from "@/components/ui";
import { CashFlowChart } from "@/components/charts";
import {
  formatCurrency,
  formatDate,
  TRANSACTION_ORIGIN_LABELS,
} from "@/lib/format";

interface CashFlowData {
  period: { from: string | null; to: string | null };
  opening: string;
  inflow: string;
  outflow: string;
  net: string;
  closing: string;
  rows: {
    id: string;
    date: string;
    description: string;
    type: "INFLOW" | "OUTFLOW";
    origin: string;
    amount: string;
    bankAccount: string;
    category: string | null;
    costCenter: string | null;
    balance: string;
  }[];
  daily: { date: string; inflow: string; outflow: string; net: string }[];
}

interface Option {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

function isoDate(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function CashFlowView() {
  const today = useMemo(() => new Date(), []);
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().slice(0, 10);

  const [values, setValues] = useState<FilterValues>({ from: monthStart, to: todayStr });
  const [applied, setApplied] = useState<FilterValues>(values);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [centers, setCenters] = useState<Option[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<Option[]>("/api/accounts"),
      api.get<Option[]>("/api/categories"),
      api.get<Option[]>("/api/cost-centers"),
    ]).then((res) => {
      const pick = (i: number) =>
        res[i].status === "fulfilled" ? (res[i].value as Option[]) : [];
      setAccounts(pick(0));
      setCategories(pick(1));
      setCenters(pick(2));
    });
  }, []);

  const url = useMemo(() => {
    const qs = buildQuery({
      from: applied.from ? isoDate(applied.from) : undefined,
      to: applied.to ? isoDate(applied.to) : undefined,
      bankAccountId: applied.bankAccountId,
      categoryId: applied.categoryId,
      costCenterId: applied.costCenterId,
    });
    return `/api/reports/cash-flow${qs}`;
  }, [applied]);

  const { data, loading, error, reload } = useApiQuery<CashFlowData>(url);

  const filterFields = useMemo(
    () => [
      { key: "from", label: "De", type: "date" as const },
      { key: "to", label: "Até", type: "date" as const },
      {
        key: "bankAccountId",
        label: "Conta / caixa",
        type: "select" as const,
        options: accounts.map((a) => ({ value: a.id, label: a.name })),
      },
      {
        key: "categoryId",
        label: "Categoria",
        type: "select" as const,
        options: categories.map((c) => ({ value: c.id, label: c.name })),
      },
      {
        key: "costCenterId",
        label: "Centro de custo",
        type: "select" as const,
        options: centers.map((c) => ({
          value: c.id,
          label: c.code ? `${c.code} — ${c.name}` : c.name,
        })),
      },
    ],
    [accounts, categories, centers],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fluxo de caixa</h1>
        <p className="text-sm text-muted-foreground">
          Saldo inicial, movimentações e saldo final por período.
        </p>
      </div>

      <FilterBar
        fields={filterFields}
        values={values}
        onChange={setValues}
        onSubmit={() => setApplied(values)}
        onReset={() => {
          setValues({ from: monthStart, to: todayStr });
          setApplied({ from: monthStart, to: todayStr });
        }}
        loading={loading}
      />

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Spinner /> Carregando…
        </div>
      ) : error ? (
        <EmptyState title="Erro ao carregar" description={error} action={<button onClick={reload} className="text-primary">Tentar novamente</button>} />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Saldo inicial" value={formatCurrency(data.opening)} hint={data.period.from ? `em ${formatDate(data.period.from)}` : undefined} />
            <StatCard label="Entradas" value={formatCurrency(data.inflow)} tone="success" />
            <StatCard label="Saídas" value={formatCurrency(data.outflow)} tone="destructive" />
            <StatCard
              label="Saldo final"
              value={formatCurrency(data.closing)}
              tone={Number(data.closing) >= 0 ? "success" : "destructive"}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Movimento diário</CardTitle>
                <CardDescription>Consolidação por dia no período.</CardDescription>
              </CardHeader>
              <CardContent>
                <CashFlowChart
                  data={data.daily.map((d) => ({
                    label: d.date.slice(0, 10),
                    inflow: d.inflow,
                    outflow: d.outflow,
                    net: d.net,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Resumo do período</CardTitle>
                <CardDescription>
                  {`${formatCurrency(data.inflow)} de entradas × ${formatCurrency(data.outflow)} de saídas`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                  <span className="text-sm text-muted-foreground">Resultado líquido do período</span>
                  <span className={`text-lg font-bold ${Number(data.net) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(data.net)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Consistência (inicial + líquido)</span>
                  <span className="font-medium">{formatCurrency(data.closing)}</span>
                </div>
                {data.rows.length === 0 ? (
                  <p className="pt-4 text-center text-sm text-muted-foreground">
                    Nenhuma movimentação no período.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {data.rows.length} lançamento(s) no período.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento</CardTitle>
              <CardDescription>Saldo acumulado (running balance) por lançamento.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.rows.length === 0 ? (
                <EmptyState title="Sem movimentações" description="Nenhum lançamento no período selecionado." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Data</TH>
                      <TH>Descrição</TH>
                      <TH className="hidden md:table-cell">Conta</TH>
                      <TH className="hidden lg:table-cell">Origem</TH>
                      <TH align="right">Valor</TH>
                      <TH align="right">Saldo</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.rows.map((r) => (
                      <TR key={r.id}>
                        <TD className="whitespace-nowrap">{formatDate(r.date)}</TD>
                        <TD>
                          <p className="max-w-[240px] truncate font-medium">{r.description}</p>
                          <p className="text-xs text-muted-foreground">{r.category ?? "—"}</p>
                        </TD>
                        <TD className="hidden text-muted-foreground md:table-cell">{r.bankAccount}</TD>
                        <TD className="hidden lg:table-cell">
                          <Badge tone={statusTone(r.origin)}>
                            {TRANSACTION_ORIGIN_LABELS[r.origin] ?? r.origin}
                          </Badge>
                        </TD>
                        <TD align="right" className="whitespace-nowrap">
                          <span className={r.type === "INFLOW" ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                            {r.type === "INFLOW" ? "+" : "−"}
                            {formatCurrency(r.amount)}
                          </span>
                        </TD>
                        <TD align="right" className="whitespace-nowrap font-medium">
                          {formatCurrency(r.balance)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}