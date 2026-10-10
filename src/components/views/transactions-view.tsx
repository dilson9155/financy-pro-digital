"use client";

import { useEffect, useMemo, useState } from "react";
import { api, buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useCan } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  statusTone,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  TRANSACTION_ORIGIN_LABELS,
} from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

interface TransactionRow {
  id: string;
  date: string;
  competenceDate: string;
  description: string;
  type: "INFLOW" | "OUTFLOW";
  origin: string;
  status: string;
  amount: string;
  bankAccount: { id: string; name: string; type: string } | null;
  category: { id: string; name: string; type: string } | null;
  costCenter: { id: string; code: string; name: string } | null;
  accountPlan: { id: string; code: string; name: string } | null;
  partner: { id: string; name: string } | null;
  title: { id: string; description: string; direction: string } | null;
  createdBy: { id: string; name: string } | null;
}

interface ListResponse {
  items: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { inflow: string; outflow: string; net: string };
}

interface Option {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

/** Origens que podem ser estornadas diretamente no modulo de lancamentos. */
const REVERSIBLE_ORIGINS = new Set(["MANUAL", "ADJUSTMENT", "OPENING_BALANCE"]);

export function TransactionsView() {
  const { notify } = useToast();
  const can = useCan();
  const [values, setValues] = useState<FilterValues>({});
  const [applied, setApplied] = useState<FilterValues>({});
  const [page, setPage] = useState(1);

  const [accounts, setAccounts] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [centers, setCenters] = useState<Option[]>([]);
  const [plans, setPlans] = useState<Option[]>([]);
  const [partners, setPartners] = useState<Option[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<Option[]>("/api/accounts"),
      api.get<Option[]>("/api/categories"),
      api.get<Option[]>("/api/cost-centers"),
      api.get<Option[]>("/api/account-plans"),
      api.get<Option[]>("/api/partners"),
    ]).then((res) => {
      const pick = (i: number) =>
        res[i].status === "fulfilled" ? (res[i].value as Option[]) : [];
      setAccounts(pick(0));
      setCategories(pick(1));
      setCenters(pick(2));
      setPlans(pick(3));
      setPartners(pick(4));
    });
  }, []);

  const url = useMemo(() => {
    const qs = buildQuery({ ...applied, page, pageSize: 20 });
    return `/api/transactions${qs}`;
  }, [applied, page]);

  const { data, loading, error, reload } = useApiQuery<ListResponse>(url);

  // ---- modal de criacao ----
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  function openCreate() {
    setForm({
      description: "",
      type: "INFLOW",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      competenceDate: new Date().toISOString().slice(0, 10),
      bankAccountId: accounts[0]?.id ?? "",
      categoryId: "",
      costCenterId: "",
      accountPlanId: "",
      partnerId: "",
    });
    setFormError(null);
    setOpen(true);
  }

  async function create() {
    setSaving(true);
    setFormError(null);
    try {
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Informe um valor válido.");
      const payload = {
        bankAccountId: form.bankAccountId,
        type: form.type,
        amount,
        date: new Date(`${form.date}T12:00:00`).toISOString(),
        competenceDate: form.competenceDate
          ? new Date(`${form.competenceDate}T12:00:00`).toISOString()
          : undefined,
        description: form.description,
        categoryId: form.categoryId || undefined,
        costCenterId: form.costCenterId || undefined,
        accountPlanId: form.accountPlanId || undefined,
        partnerId: form.partnerId || undefined,
      };
      await api.post("/api/transactions", payload);
      notify("Lançamento registrado com sucesso.", "success");
      setOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  // ---- modal de estorno ----
  const [reverseState, setReverseState] = useState<TransactionRow | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  async function reverse() {
    if (!reverseState) return;
    setReversing(true);
    setReverseError(null);
    try {
      await api.post(`/api/transactions/${reverseState.id}/reverse`, {
        reason: reverseReason,
      });
      notify("Lançamento estornado com sucesso.", "success");
      setReverseState(null);
      setReverseReason("");
      await reload();
    } catch (err) {
      setReverseError(err instanceof Error ? err.message : "Erro no estorno.");
    } finally {
      setReversing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  const summary = data?.summary;

  const filterFields = useMemo(
    () => [
      { key: "q", label: "Buscar", type: "text" as const, placeholder: "Descrição, parceiro…" },
      {
        key: "type",
        label: "Tipo",
        type: "select" as const,
        options: [
          { value: "INFLOW", label: "Entrada" },
          { value: "OUTFLOW", label: "Saída" },
        ],
      },
      {
        key: "origin",
        label: "Origem",
        type: "select" as const,
        options: Object.entries(TRANSACTION_ORIGIN_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
      {
        key: "status",
        label: "Situação",
        type: "select" as const,
        options: [
          { value: "POSTED", label: "Lançado" },
          { value: "REVERSED", label: "Estornado" },
        ],
      },
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">
            Movimentações do ledger: todas as entradas e saídas da empresa.
          </p>
        </div>
        {can(PERMISSIONS.TRANSACTIONS_CREATE) ? (
          <Button onClick={openCreate}>Novo lançamento</Button>
        ) : null}
      </div>

      {summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Entradas" value={formatCurrency(summary.inflow)} tone="success" />
          <StatCard label="Saídas" value={formatCurrency(summary.outflow)} tone="destructive" />
          <StatCard
            label="Resultado (filtrados)"
            value={formatCurrency(summary.net)}
            tone={Number(summary.net) >= 0 ? "default" : "destructive"}
          />
        </div>
      ) : null}

      <FilterBar
        fields={filterFields}
        values={values}
        onChange={setValues}
        onSubmit={() => {
          setPage(1);
          setApplied(values);
        }}
        onReset={() => {
          setPage(1);
          setApplied({});
        }}
        loading={loading}
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> Carregando…
            </div>
          ) : error ? (
            <EmptyState title="Erro ao carregar" description={error} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Nenhum lançamento encontrado"
              description="Ajuste os filtros ou crie um novo lançamento."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Data</TH>
                  <TH>Descrição</TH>
                  <TH className="hidden md:table-cell">Conta</TH>
                  <TH className="hidden lg:table-cell">Origem</TH>
                  <TH align="right">Valor</TH>
                  <TH>Status</TH>
                  <TH align="right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {(data?.items ?? []).map((t) => (
                  <TR key={t.id}>
                    <TD className="whitespace-nowrap">{formatDate(t.date)}</TD>
                    <TD>
                      <p className="max-w-[260px] truncate font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.category?.name ?? t.partner?.name ?? "—"}
                      </p>
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {t.bankAccount?.name ?? "—"}
                    </TD>
                    <TD className="hidden lg:table-cell">
                      <Badge tone="gray">
                        {TRANSACTION_ORIGIN_LABELS[t.origin] ?? t.origin}
                      </Badge>
                    </TD>
                    <TD align="right" className="whitespace-nowrap">
                      <span
                        className={
                          t.type === "INFLOW"
                            ? "font-medium text-emerald-600"
                            : "font-medium text-red-600"
                        }
                      >
                        {t.type === "INFLOW" ? "+" : "−"}
                        {formatCurrency(t.amount)}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone={statusTone(t.status)}>
                        {t.status === "POSTED" ? "Lançado" : t.status === "REVERSED" ? "Estornado" : t.status}
                      </Badge>
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1">
                        {t.status === "POSTED" &&
                        REVERSIBLE_ORIGINS.has(t.origin) &&
                        can(PERMISSIONS.TRANSACTIONS_REVERSE) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                              setReverseState(t);
                              setReverseReason("");
                              setReverseError(null);
                            }}
                          >
                            Estornar
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} lançamento(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="px-2">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      </div>

      {/* Modal criar lançamento */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo lançamento"
        description="Movimento manual no ledger (entrada ou saída)."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>
              {saving ? <Spinner /> : null} Salvar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Descrição" className="sm:col-span-2">
            <Input required value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Tipo">
            <Select value={form.type ?? ""} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="INFLOW">Entrada</option>
              <option value="OUTFLOW">Saída</option>
            </Select>
          </Field>
          <Field label="Valor">
            <Input type="number" step="0.01" min="0.01" required value={form.amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="Conta / caixa">
            <Select required value={form.bankAccountId ?? ""} onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Data do movimento">
            <Input type="date" required value={form.date ?? ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Competência" hint="Mês contábil, quando diferente da data do movimento.">
            <Input type="date" value={form.competenceDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, competenceDate: e.target.value }))} />
          </Field>
          <Field label="Categoria">
            <Select value={form.categoryId ?? ""} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Selecione…</option>
              {categories
                .filter((c) => (form.type === "INFLOW" ? c.type === "INCOME" : c.type === "EXPENSE"))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </Select>
          </Field>
          <Field label="Centro de custo">
            <Select value={form.costCenterId ?? ""} onChange={(e) => setForm((f) => ({ ...f, costCenterId: e.target.value }))}>
              <option value="">Selecione…</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Conta contábil" className="sm:col-span-2">
            <Select value={form.accountPlanId ?? ""} onChange={(e) => setForm((f) => ({ ...f, accountPlanId: e.target.value }))}>
              <option value="">Selecione…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Parceiro" className="sm:col-span-2">
            <Select value={form.partnerId ?? ""} onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}>
              <option value="">Selecione…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        {formError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        ) : null}
      </Modal>

      {/* Modal estorno */}
      <Modal
        open={Boolean(reverseState)}
        onClose={() => setReverseState(null)}
        title="Estornar lançamento"
        description={reverseState ? `Contrapartida de "${reverseState.description}".` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setReverseState(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reverse} disabled={reversing || reverseReason.trim().length < 3}>
              {reversing ? <Spinner /> : null} Confirmar estorno
            </Button>
          </>
        }
      >
        <Field label="Motivo do estorno">
          <Textarea
            required
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            placeholder="Informe o motivo (mínimo 3 caracteres)…"
          />
        </Field>
        {reverseError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{reverseError}</p>
        ) : null}
      </Modal>
    </div>
  );
}