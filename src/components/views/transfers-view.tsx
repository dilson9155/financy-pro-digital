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
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  statusTone,
} from "@/components/ui";
import { formatCurrency, formatDate, TRANSFER_STATUS_LABELS } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

interface TransferRow {
  id: string;
  date: string;
  amount: string;
  description: string | null;
  status: string;
  fromBankAccount: { id: string; name: string };
  toBankAccount: { id: string; name: string };
  createdBy: { id: string; name: string } | null;
}

interface ListResponse {
  items: TransferRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface Option {
  id: string;
  name: string;
}

export function TransfersView() {
  const { notify } = useToast();
  const can = useCan();
  const [values, setValues] = useState<FilterValues>({});
  const [applied, setApplied] = useState<FilterValues>({});
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState<Option[]>([]);

  useEffect(() => {
    api
      .get<Option[]>("/api/accounts")
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const url = useMemo(
    () => `/api/transfers${buildQuery({ ...applied, page, pageSize: 20 })}`,
    [applied, page],
  );
  const { data, loading, error, reload } = useApiQuery<ListResponse>(url);

  // ---- criacao ----
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  function openCreate() {
    setForm({
      fromBankAccountId: accounts[0]?.id ?? "",
      toBankAccountId: accounts[1]?.id ?? "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
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
      await api.post("/api/transfers", {
        fromBankAccountId: form.fromBankAccountId,
        toBankAccountId: form.toBankAccountId,
        amount,
        date: new Date(`${form.date}T12:00:00`).toISOString(),
        description: form.description || undefined,
      });
      notify("Transferência registrada com sucesso.", "success");
      setOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  // ---- estorno ----
  const [reverseState, setReverseState] = useState<TransferRow | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  async function reverse() {
    if (!reverseState) return;
    setReversing(true);
    setReverseError(null);
    try {
      await api.post(`/api/transfers/${reverseState.id}/reverse`, {
        reason: reverseReason,
      });
      notify("Transferência estornada.", "success");
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

  const filterFields = useMemo(
    () => [
      { key: "from", label: "De", type: "date" as const },
      { key: "to", label: "Até", type: "date" as const },
      {
        key: "fromBankAccountId",
        label: "Conta de origem",
        type: "select" as const,
        options: accounts.map((a) => ({ value: a.id, label: a.name })),
      },
      {
        key: "toBankAccountId",
        label: "Conta de destino",
        type: "select" as const,
        options: accounts.map((a) => ({ value: a.id, label: a.name })),
      },
      {
        key: "status",
        label: "Situação",
        type: "select" as const,
        options: Object.entries(TRANSFER_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
    ],
    [accounts],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transferências</h1>
          <p className="text-sm text-muted-foreground">
            Movimentação de valores entre contas e caixas da empresa.
          </p>
        </div>
        {can(PERMISSIONS.TRANSFERS_CREATE) ? (
          <Button onClick={openCreate}>Nova transferência</Button>
        ) : null}
      </div>

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
              title="Nenhuma transferência encontrada"
              description="Ajuste os filtros ou crie uma nova transferência."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Data</TH>
                  <TH>Descrição</TH>
                  <TH className="hidden md:table-cell">Origem → Destino</TH>
                  <TH align="right">Valor</TH>
                  <TH>Situação</TH>
                  <TH align="right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {(data?.items ?? []).map((t) => (
                  <TR key={t.id}>
                    <TD className="whitespace-nowrap">{formatDate(t.date)}</TD>
                    <TD>
                      <p className="max-w-[240px] truncate font-medium">
                        {t.description ?? "Transferência"}
                      </p>
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {t.fromBankAccount.name}
                      <span className="mx-1 text-muted-foreground/60">→</span>
                      {t.toBankAccount.name}
                    </TD>
                    <TD align="right" className="whitespace-nowrap font-medium">
                      {formatCurrency(t.amount)}
                    </TD>
                    <TD>
                      <Badge tone={statusTone(t.status)}>
                        {TRANSFER_STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1">
                        {t.status === "COMPLETED" && can(PERMISSIONS.TRANSFERS_REVERSE) ? (
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
        <span>{data?.total ?? 0} transferência(s)</span>
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

      {/* Modal criar transferência */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova transferência"
        description="Gera saída na origem e entrada no destino, de forma atômica."
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
          <Field label="Conta de origem">
            <Select required value={form.fromBankAccountId ?? ""} onChange={(e) => setForm((f) => ({ ...f, fromBankAccountId: e.target.value }))}>
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Conta de destino">
            <Select required value={form.toBankAccountId ?? ""} onChange={(e) => setForm((f) => ({ ...f, toBankAccountId: e.target.value }))}>
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valor">
            <Input type="number" step="0.01" min="0.01" required value={form.amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="Data">
            <Input type="date" required value={form.date ?? ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Input value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Opcional…" />
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
        title="Estornar transferência"
        description={reverseState ? `${reverseState.fromBankAccount.name} → ${reverseState.toBankAccount.name}` : undefined}
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