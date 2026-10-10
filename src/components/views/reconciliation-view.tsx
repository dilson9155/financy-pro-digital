"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useCan } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  statusTone,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  RECONCILIATION_STATUS_LABELS,
  TRANSACTION_ORIGIN_LABELS,
} from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

interface StatementItem {
  id: string;
  fileName: string | null;
  format: string;
  periodStart: string | null;
  periodEnd: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
  createdAt: string;
  bankAccount: { id: string; name: string };
  _count: { lines: number };
}

interface StatementDetail {
  statement: {
    id: string;
    fileName: string | null;
    format: string;
    bankAccount: { id: string; name: string; type: string };
    lines: {
      id: string;
      date: string;
      description: string;
      amount: string;
      type: "INFLOW" | "OUTFLOW";
      status: string;
      matchedTransactionId: string | null;
    }[];
  };
  candidates: {
    id: string;
    date: string;
    description: string;
    amount: string;
    type: string;
    origin: string;
  }[];
  suggestions: { lineId: string; suggestedTransactionId: string | null; confidence: number }[];
}

interface Option {
  id: string;
  name: string;
}

export function ReconciliationView() {
  const { notify } = useToast();
  const can = useCan();
  const [accounts, setAccounts] = useState<Option[]>([]);

  useEffect(() => {
    api
      .get<Option[]>("/api/accounts")
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const { data, loading, error, reload } = useApiQuery<{
    items: StatementItem[];
    total: number;
  }>("/api/reconciliation/statements");

  // ---- import ----
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<
    { date: string; description: string; amount: string; type: string }[]
  >([]);

  function openImport() {
    setForm({
      bankAccountId: accounts[0]?.id ?? "",
      fileName: "",
      format: "MANUAL",
      openingBalance: "",
      closingBalance: "",
    });
    setLines([{ date: new Date().toISOString().slice(0, 10), description: "", amount: "", type: "OUTFLOW" }]);
    setFormError(null);
    setOpen(true);
  }

  function updateLine(index: number, key: string, value: string) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  }

  async function importStatement() {
    setSaving(true);
    setFormError(null);
    try {
      const validLines = lines
        .filter((l) => l.description.trim() && Number(l.amount) > 0)
        .map((l) => ({
          date: new Date(`${l.date}T12:00:00`).toISOString(),
          description: l.description.trim(),
          amount: Number(l.amount),
          type: l.type as "INFLOW" | "OUTFLOW",
        }));
      if (validLines.length === 0) throw new Error("Adicione ao menos uma linha válida.");
      await api.post("/api/reconciliation/statements", {
        bankAccountId: form.bankAccountId,
        fileName: form.fileName || undefined,
        format: "MANUAL",
        openingBalance: form.openingBalance ? Number(form.openingBalance) : undefined,
        closingBalance: form.closingBalance ? Number(form.closingBalance) : undefined,
        lines: validLines,
      });
      notify("Extrato importado com sucesso.", "success");
      setOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao importar.");
    } finally {
      setSaving(false);
    }
  }

  // ---- extrato selecionado ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailUrl = useMemo(
    () => (selectedId ? `/api/reconciliation/statements/${selectedId}` : null),
    [selectedId],
  );
  const {
    data: detail,
    loading: loadingDetail,
    error: errorDetail,
    reload: reloadDetail,
  } = useApiQuery<StatementDetail>(detailUrl);

  const [matchLineId, setMatchLineId] = useState<string | null>(null);
  const [matchTxId, setMatchTxId] = useState<string>("");

  const suggested = useMemo(() => {
    const map = new Map(
      detail?.suggestions.map((s) => [s.lineId, s.suggestedTransactionId]) ?? [],
    );
    return map;
  }, [detail]);

  async function doMatch() {
    if (!matchLineId || !matchTxId) return;
    try {
      await api.post(`/api/reconciliation/lines/${matchLineId}/match`, {
        lineId: matchLineId,
        transactionId: matchTxId,
      });
      notify("Linha conciliada.", "success");
      setMatchLineId(null);
      setMatchTxId("");
      await reloadDetail();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao conciliar.", "error");
    }
  }

  async function toggleLine(lineId: string, action: "unmatch" | "ignore") {
    try {
      await api.post(`/api/reconciliation/lines/${lineId}/${action}`);
      notify(action === "unmatch" ? "Conciliação desfeita." : "Linha marcada como ignorada.", "success");
      await reloadDetail();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao atualizar linha.", "error");
    }
  }

  function openMatch(lineId: string, suggestedId: string | null) {
    setMatchLineId(lineId);
    setMatchTxId(suggestedId ?? "");
  }

  const stats = useMemo(() => {
    if (!detail) return { pending: 0, matched: 0, ignored: 0, total: 0 };
    const lines2 = detail.statement.lines;
    return {
      pending: lines2.filter((l) => l.status === "PENDING").length,
      matched: lines2.filter((l) => l.status === "MATCHED").length,
      ignored: lines2.filter((l) => l.status === "IGNORED").length,
      total: lines2.length,
    };
  }, [detail]);

  const loadError = error ?? errorDetail;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conciliação bancária</h1>
          <p className="text-sm text-muted-foreground">
            Importe extratos e relacione as linhas com os lançamentos do ledger.
          </p>
        </div>
        {can(PERMISSIONS.RECONCILIATION_MANAGE) ? (
          <Button onClick={openImport}>Importar extrato</Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Extratos importados</CardTitle>
              <CardDescription>{data?.total ?? 0} extrato(s)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-5 text-sm text-muted-foreground">Carregando…</div>
              ) : (data?.items.length ?? 0) === 0 ? (
                <EmptyState title="Nenhum extrato" description="Importe o primeiro extrato para começar." />
              ) : (
                <div className="divide-y">
                  {(data?.items ?? []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent ${
                        selectedId === s.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {s.fileName ?? `Extrato ${formatDate(s.createdAt)}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.bankAccount.name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {s._count.lines} linha(s) ·{" "}
                        {s.periodStart && s.periodEnd
                          ? `${formatDate(s.periodStart)} a ${formatDate(s.periodEnd)}`
                          : formatDateTime(s.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!selectedId ? (
            <Card>
              <CardContent>
                <EmptyState
                  title="Selecione um extrato"
                  description="Escolha um extrato na lista para visualizar e conciliar as linhas."
                />
              </CardContent>
            </Card>
          ) : loadingDetail ? (
            <Card>
              <CardContent>
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Spinner /> Carregando extrato…
                </div>
              </CardContent>
            </Card>
          ) : errorDetail ? (
            <EmptyState title="Erro ao carregar" description={errorDetail} />
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Conciliadas</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.matched}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Ignoradas</p>
                    <p className="text-2xl font-bold">{stats.ignored}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Linhas do extrato</CardTitle>
                  <CardDescription>
                    {detail.statement.bankAccount.name} — use a sugestão automática ou
                    selecione o lançamento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Data</TH>
                        <TH>Descrição</TH>
                        <TH align="right">Valor</TH>
                        <TH>Status</TH>
                        <TH align="right">Ações</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {detail.statement.lines.map((line) => {
                        const isPending = line.status === "PENDING";
                        const isMatched = line.status === "MATCHED";
                        return (
                          <TR key={line.id}>
                            <TD className="whitespace-nowrap">{formatDate(line.date)}</TD>
                            <TD>
                              <p className="max-w-[220px] truncate font-medium">{line.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {line.type === "INFLOW" ? "Entrada" : "Saída"}
                              </p>
                            </TD>
                            <TD align="right" className="whitespace-nowrap">
                              <span className={line.type === "INFLOW" ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                                {line.type === "INFLOW" ? "+" : "−"}
                                {formatCurrency(line.amount)}
                              </span>
                            </TD>
                            <TD>
                              <Badge tone={statusTone(line.status)}>
                                {RECONCILIATION_STATUS_LABELS[line.status] ?? line.status}
                              </Badge>
                            </TD>
                            <TD align="right">
                              <div className="flex justify-end gap-1">
                                {isPending && can(PERMISSIONS.RECONCILIATION_MANAGE) ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openMatch(line.id, suggested.get(line.id) ?? null)}
                                  >
                                    Conciliar
                                  </Button>
                                ) : null}
                                {isPending ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground"
                                    onClick={() => toggleLine(line.id, "ignore")}
                                  >
                                    Ignorar
                                  </Button>
                                ) : null}
                                {isMatched ? (
                                  <Button variant="ghost" size="sm" onClick={() => toggleLine(line.id, "unmatch")}>
                                    Desfazer
                                  </Button>
                                ) : null}
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal importar extrato */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Importar extrato"
        description="Insira manualmente as linhas do extrato bancário."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={importStatement} disabled={saving}>
              {saving ? <Spinner /> : null} Importar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Conta / caixa">
              <Select required value={form.bankAccountId ?? ""} onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
                <option value="">Selecione…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Arquivo (referência)">
              <Input value={form.fileName ?? ""} onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))} placeholder="ex: extrato_banco_2026-10.csv" />
            </Field>
            <Field label="Saldo inicial">
              <Input type="number" step="0.01" value={form.openingBalance ?? ""} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} />
            </Field>
            <Field label="Saldo final">
              <Input type="number" step="0.01" value={form.closingBalance ?? ""} onChange={(e) => setForm((f) => ({ ...f, closingBalance: e.target.value }))} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Linhas do extrato</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines((ls) => [...ls, { date: new Date().toISOString().slice(0, 10), description: "", amount: "", type: "OUTFLOW" }])
                }
              >
                + Adicionar linha
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-[150px_1fr_130px_110px_auto]">
                  <Input type="date" value={l.date} onChange={(e) => updateLine(i, "date", e.target.value)} />
                  <Input placeholder="Descrição" value={l.description} onChange={(e) => updateLine(i, "description", e.target.value)} />
                  <Input type="number" step="0.01" placeholder="Valor" value={l.amount} onChange={(e) => updateLine(i, "amount", e.target.value)} />
                  <Select value={l.type} onChange={(e) => updateLine(i, "type", e.target.value)}>
                    <option value="OUTFLOW">Saída</option>
                    <option value="INFLOW">Entrada</option>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover linha"
                    className="text-destructive"
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        {formError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        ) : null}
      </Modal>

      {/* Modal conciliar linha */}
      <Modal
        open={Boolean(matchLineId)}
        onClose={() => setMatchLineId(null)}
        title="Conciliar linha"
        description="Selecione o lançamento que corresponde a esta linha do extrato."
        footer={
          <>
            <Button variant="outline" onClick={() => setMatchLineId(null)}>Cancelar</Button>
            <Button onClick={doMatch} disabled={!matchTxId}>
              Conciliar
            </Button>
          </>
        }
      >
        <Field label="Lançamento no ledger">
          <Select value={matchTxId} onChange={(e) => setMatchTxId(e.target.value)}>
            <option value="">Selecione…</option>
            {(detail?.candidates ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {formatDate(c.date)} — {c.description} ({c.type === "INFLOW" ? "+" : "−"}{formatCurrency(c.amount)})
              </option>
            ))}
          </Select>
        </Field>
        {matchTxId ? (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Sugestão automática aplicada — confirme se os valores batem com o extrato.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}