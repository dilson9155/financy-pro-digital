"use client";

import { useApiQuery } from "@/lib/hooks";
import { api } from "@/lib/client";
import { buildQuery } from "@/lib/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Badge,
} from "@/components/ui";
import { CashFlowChart, NetLineChart, CategoryPie } from "@/components/charts";
import { formatCurrency, formatDate, TRANSACTION_TYPE_LABELS, TRANSACTION_ORIGIN_LABELS } from "@/lib/format";
import { useSession } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { useEffect, useState } from "react";
import { Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";

interface DashboardData {
  balance: { total: string; accounts: { id: string; name: string; type: string; balance: string }[] };
  receivables: { open: string; count: number; overdue: string; due7: string; due30: string };
  payables: { open: string; count: number; overdue: string; due7: string; due30: string };
  month: { inflow: string; outflow: string; net: string; result: string };
  projection: { net: string };
  series: { label: string; inflow: string; outflow: string; net: string }[];
  recent: {
    id: string;
    date: string;
    description: string;
    type: string;
    origin: string;
    amount: string;
    bankAccount: string;
    category: string | null;
  }[];
}

export function DashboardView() {
  const session = useSession();
  const { data, loading, error, reload } = useApiQuery<DashboardData>(
    "/api/dashboard",
  );
  const [filter, setFilter] = useState("");
  const [categories, setCategories] = useState<{ name: string; outflow: string }[]>([]);

  useEffect(() => {
    if (!filter) {
      setCategories([]);
      return;
    }
    api
      .get<{ name: string; outflow: string }[]>(
        `/api/reports/by-category?${buildQuery({
          from: filter,
          to: filter,
        })}`,
      )
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [filter]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Spinner /> Carregando dashboard…
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Erro" description={error} action={<button onClick={reload} className="text-primary">Tentar novamente</button>} />;
  }
  if (!data) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          session.memberships.find((m) => m.companyId === session.companyId)?.companyName
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo total"
          value={formatCurrency(data.balance.total)}
          hint={`${data.balance.accounts.length} conta(s) ativa(s)`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="A receber (aberto)"
          value={formatCurrency(data.receivables.open)}
          hint={`${data.receivables.count} título(s) · vencidos ${formatCurrency(data.receivables.overdue)}`}
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="A pagar (aberto)"
          value={formatCurrency(data.payables.open)}
          hint={`${data.payables.count} título(s) · vencidos ${formatCurrency(data.payables.overdue)}`}
          tone="destructive"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label="Resultado do mês"
          value={formatCurrency(data.month.net)}
          hint={`Entradas ${formatCurrency(data.month.inflow)} · Saídas ${formatCurrency(data.month.outflow)}`}
          tone={Number(data.month.net) >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo de caixa — 12 meses</CardTitle>
            <CardDescription>Entradas e saídas por competência.</CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={data.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projeção</CardTitle>
            <CardDescription>Saldo + vencimentos (a receber × a pagar).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <span className="text-sm text-muted-foreground">Projeção líquida</span>
              <span className="text-lg font-bold">{formatCurrency(data.projection.net)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">A receber (7 dias)</span>
              <span className="font-medium text-emerald-600">{formatCurrency(data.receivables.due7)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">A pagar (7 dias)</span>
              <span className="font-medium text-red-600">{formatCurrency(data.payables.due7)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">A receber (30 dias)</span>
              <span className="font-medium">{formatCurrency(data.receivables.due30)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">A pagar (30 dias)</span>
              <span className="font-medium">{formatCurrency(data.payables.due30)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Despesas por categoria</CardTitle>
              <CardDescription>
                Selecione um mês para análise.
              </CardDescription>
            </div>
            <input
              type="month"
              value={filter || today.slice(0, 7)}
              onChange={(e) => setFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
          </CardHeader>
          <CardContent>
            <CategoryPie data={categories} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimos lançamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <EmptyState title="Sem lançamentos" description="Crie o primeiro lançamento para começar." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Data</TH>
                    <TH>Descrição</TH>
                    <TH>Conta</TH>
                    <TH align="right">Valor</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.recent.map((t) => (
                    <TR key={t.id}>
                      <TD className="whitespace-nowrap">{formatDate(t.date)}</TD>
                      <TD>
                        <p className="max-w-[240px] truncate font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.category ?? TRANSACTION_ORIGIN_LABELS[t.origin] ?? t.origin}
                        </p>
                      </TD>
                      <TD className="text-muted-foreground">{t.bankAccount}</TD>
                      <TD align="right">
                        <span className={t.type === "INFLOW" ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                          {t.type === "INFLOW" ? "+" : "−"}
                          {formatCurrency(t.amount)}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}