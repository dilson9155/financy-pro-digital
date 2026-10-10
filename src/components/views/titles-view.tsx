"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useCan } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Label,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatPixKey,
  INSTALLMENT_STATUS_LABELS,
  PIX_KEY_TYPE_LABELS,
  SETTLEMENT_METHOD_LABELS,
  TITLE_STATUS_LABELS,
} from "@/lib/format";

export interface TitleRow {
  id: string;
  direction: "PAYABLE" | "RECEIVABLE";
  description: string;
  documentNumber: string | null;
  dueDate: string;
  issueDate: string;
  totalAmount: string;
  settledAmount: string;
  status: string;
  paymentMethod: string | null;
  pixKeyType: string | null;
  pixKey: string | null;
  partner: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  installments: {
    id: string;
    number: number;
    dueDate: string;
    amount: string;
    paidAmount: string;
    status: string;
  }[];
}

interface ListResponse {
  items: TitleRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { totalAmount: string; settledAmount: string; openAmount: string };
}

interface Option {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

export function TitlesView({ direction }: { direction: "PAYABLE" | "RECEIVABLE" }) {
  const isReceivable = direction === "RECEIVABLE";
  const { notify } = useToast();
  const can = useCan();
  const [values, setValues] = useState<FilterValues>({});
  const [applied, setApplied] = useState<FilterValues>({});
  const [page, setPage] = useState(1);

  const [partners, setPartners] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [centers, setCenters] = useState<Option[]>([]);
  const [plans, setPlans] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<Option[]>("/api/partners"),
      api.get<Option[]>("/api/categories"),
      api.get<Option[]>("/api/cost-centers"),
      api.get<Option[]>("/api/account-plans"),
      api.get<Option[]>("/api/accounts"),
    ]).then((res) => {
      const pick = (i: number) =>
        res[i].status === "fulfilled" ? (res[i].value as Option[]) : [];
      setPartners(pick(0));
      setCategories(pick(1));
      setCenters(pick(2));
      setPlans(pick(3));
      setAccounts(pick(4));
    });
  }, []);

  const url = useMemo(() => {
    const qs = buildQuery({ ...applied, page, pageSize: 20 });
    return `/api/${isReceivable ? "receivables" : "payables"}${qs}`;
  }, [applied, page, isReceivable]);

  const { data, loading, error, reload } = useApiQuery<ListResponse>(url);

  // ---- modal de criação ----
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [installmentsCount, setInstallmentsCount] = useState(1);

  function openCreate() {
    setForm({
      description: "",
      documentNumber: "",
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      totalAmount: "",
      partnerId: "",
      categoryId: "",
      costCenterId: "",
      accountPlanId: "",
      paymentMethod: "",
      pixKeyType: "",
      pixKey: "",
      notes: "",
    });
    setInstallmentsCount(1);
    setFormError(null);
    setOpen(true);
  }

  function isoDate(value: string): string {
    return new Date(`${value}T12:00:00`).toISOString();
  }

  async function create() {
    setSaving(true);
    setFormError(null);
    try {
      const dueDate = form.dueDate || form.issueDate;
      const total = Number(form.totalAmount);
      if (!total || total <= 0) throw new Error("Informe um valor válido.");
      const isPix = form.paymentMethod === "PIX";
      if (isPix && !form.pixKeyType) {
        throw new Error("Selecione o tipo da chave Pix.");
      }
      if (isPix && !(form.pixKey ?? "").trim()) {
        throw new Error("Informe a chave Pix.");
      }
      const installments = Array.from({ length: installmentsCount }, (_, i) => {
        const d = new Date(`${dueDate}T12:00:00`);
        d.setMonth(d.getMonth() + i);
        return { dueDate: d.toISOString() };
      });
      const payload = {
        direction,
        partnerId: form.partnerId || undefined,
        documentNumber: form.documentNumber || undefined,
        description: form.description,
        issueDate: isoDate(form.issueDate),
        totalAmount: total,
        categoryId: form.categoryId || undefined,
        costCenterId: form.costCenterId || undefined,
        accountPlanId: form.accountPlanId || undefined,
        paymentMethod: form.paymentMethod || undefined,
        pixKeyType: isPix ? form.pixKeyType || undefined : undefined,
        pixKey: isPix ? form.pixKey || undefined : undefined,
        notes: form.notes || undefined,
        installments,
      };
      await api.post(`/api/${isReceivable ? "receivables" : "payables"}`, payload);
      notify("Título criado com sucesso.", "success");
      setOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  // ---- modal de baixa ----
  const [settleState, setSettleState] = useState<{
    title: TitleRow;
    installments: TitleRow["installments"];
  } | null>(null);
  const [settleForm, setSettleForm] = useState<Record<string, string>>({});
  const [settleIds, setSettleIds] = useState<string[]>([]);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  function openSettle(title: TitleRow) {
    const openInst = title.installments.find((i) => i.status === "OPEN" || i.status === "PARTIAL");
    const remaining = openInst
      ? (Number(openInst.amount) - Number(openInst.paidAmount)).toFixed(2)
      : "0.00";
    setSettleState({ title, installments: title.installments.filter((i) => i.status !== "PAID") });
    setSettleIds(openInst ? [openInst.id] : []);
    setSettleForm({
      amount: remaining,
      interest: "0",
      fine: "0",
      discount: "0",
      date: new Date().toISOString().slice(0, 10),
      bankAccountId: accounts[0]?.id ?? "",
      method: title.paymentMethod ?? (isReceivable ? "PIX" : "BANK_TRANSFER"),
      notes: "",
    });
    setSettleError(null);
  }

  /** Marca/desmarca uma parcela. Quando resta apenas uma selecionada, ajusta o valor. */
  function toggleSettleInstallment(id: string) {
    const next = settleIds.includes(id)
      ? settleIds.filter((x) => x !== id)
      : [...settleIds, id];
    setSettleIds(next);
    if (next.length === 1) {
      const inst = settleState?.installments.find((i) => i.id === next[0]);
      if (inst) {
        setSettleForm((f) => ({
          ...f,
          amount: (Number(inst.amount) - Number(inst.paidAmount)).toFixed(2),
        }));
      }
    }
  }

  async function settle() {
    if (!settleState || settleIds.length === 0) return;
    setSettling(true);
    setSettleError(null);
    try {
      const targets = settleState.installments.filter((i) => settleIds.includes(i.id));
      const base = {
        date: isoDate(settleForm.date),
        bankAccountId: settleForm.bankAccountId,
        method: settleForm.method,
        notes: settleForm.notes || undefined,
      };
      const endpoint = `/api/${isReceivable ? "receivables" : "payables"}/${settleState.title.id}/settle`;

      if (targets.length === 1) {
        await api.post(endpoint, {
          ...base,
          installmentId: targets[0].id,
          amount: Number(settleForm.amount),
          interest: Number(settleForm.interest) || 0,
          fine: Number(settleForm.fine) || 0,
          discount: Number(settleForm.discount) || 0,
        });
        notify("Baixa registrada com sucesso.", "success");
      } else {
        for (const target of targets) {
          const remaining = Number(
            (Number(target.amount) - Number(target.paidAmount)).toFixed(2),
          );
          if (remaining <= 0) continue;
          await api.post(endpoint, {
            ...base,
            installmentId: target.id,
            amount: remaining,
            interest: 0,
            fine: 0,
            discount: 0,
          });
        }
        notify(`${targets.length} parcelas baixadas com sucesso.`, "success");
      }
      setSettleState(null);
      await reload();
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : "Erro na baixa.");
    } finally {
      setSettling(false);
    }
  }

  async function remove(title: TitleRow) {
    if (!window.confirm(`Excluir o título "${title.description}"?`)) return;
    try {
      await api.delete(`/api/${isReceivable ? "receivables" : "payables"}/${title.id}`);
      notify("Título excluído.", "success");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao excluir.", "error");
    }
  }

  function pixPlaceholder(type: string): string {
    switch (type) {
      case "CPF_CNPJ":
        return "000.000.000-00 ou 00.000.000/0000-00";
      case "PHONE":
        return "(00) 00000-0000";
      case "EMAIL":
        return "nome@exemplo.com";
      case "RANDOM":
        return "00000000-0000-0000-0000-000000000000";
      default:
        return "Selecione o tipo acima";
    }
  }

  function changePixType(type: string) {
    setForm((f) => ({
      ...f,
      pixKeyType: type,
      pixKey: formatPixKey(type, f.pixKey ?? ""),
    }));
  }

  function changePixKey(raw: string) {
    setForm((f) => ({ ...f, pixKey: formatPixKey(f.pixKeyType, raw) }));
  }

  const perms = isReceivable
    ? {
        settle: "receivables.settle",
        del: "receivables.delete",
        create: "receivables.create",
      }
    : { settle: "payables.settle", del: "payables.delete", create: "payables.create" };

  const settleTargets =
    settleState?.installments.filter((i) => settleIds.includes(i.id)) ?? [];
  const settleIsMulti = settleTargets.length > 1;
  const settleSelectedTotal = settleTargets.reduce(
    (acc, i) => acc + (Number(i.amount) - Number(i.paidAmount)),
    0,
  );

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  const summary = data?.summary;

  const filterFields = useMemo(() => {
    const base = [
      { key: "q", label: "Buscar", type: "text" as const, placeholder: "Descrição, documento, parceiro…" },
      { key: "status", label: "Situação", type: "select" as const, options: Object.entries(TITLE_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
      { key: "partnerId", label: "Parceiro", type: "select" as const, options: partners.map((p) => ({ value: p.id, label: p.name })) },
      { key: "overdue", label: "Vencidos", type: "select" as const, options: [{ value: "true", label: "Somente vencidos" }] },
    ];
    return base;
  }, [partners]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isReceivable ? "Contas a receber" : "Contas a pagar"}
          </h1>
          {summary ? (
            <p className="text-sm text-muted-foreground">
              Em aberto{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(summary.openAmount)}
              </span>{" "}
              · total {formatCurrency(summary.totalAmount)}
            </p>
          ) : null}
        </div>
        {can(perms.create) ? (
          <Button onClick={openCreate}>Novo título</Button>
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
              title="Nenhum título encontrado"
              description="Ajuste os filtros ou crie um novo título."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Vencimento</TH>
                  <TH>Título</TH>
                  <TH className="hidden md:table-cell">Parceiro</TH>
                  <TH align="right">Valor</TH>
                  <TH align="right">Baixado</TH>
                  <TH>Status</TH>
                  <TH className="hidden lg:table-cell">Forma</TH>
                  <TH align="right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {(data?.items ?? []).map((t) => {
                  const pct =
                    Number(t.totalAmount) > 0
                      ? Math.min(100, (Number(t.settledAmount) / Number(t.totalAmount)) * 100)
                      : 0;
                  return (
                    <TR key={t.id}>
                      <TD className="whitespace-nowrap">{formatDate(t.dueDate)}</TD>
                      <TD>
                        <Link
                          href={`/${isReceivable ? "contas-a-receber" : "contas-a-pagar"}/${t.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {t.description}
                        </Link>
                        {t.documentNumber ? (
                          <p className="text-xs text-muted-foreground">{t.documentNumber}</p>
                        ) : null}
                      </TD>
                      <TD className="hidden text-muted-foreground md:table-cell">
                        {t.partner?.name ?? "—"}
                      </TD>
                      <TD align="right" className="whitespace-nowrap font-medium">
                        {formatCurrency(t.totalAmount)}
                      </TD>
                      <TD align="right" className="w-32">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                        </div>
                      </TD>
                      <TD>
                        <Badge tone={t.status === "OPEN" ? "blue" : t.status === "PARTIAL" ? "yellow" : t.status === "PAID" ? "green" : "gray"}>
                          {TITLE_STATUS_LABELS[t.status] ?? t.status}
                        </Badge>
                      </TD>
                      <TD className="hidden lg:table-cell">
                        {t.paymentMethod ? (
                          <div className="leading-tight">
                            <span className="text-sm">
                              {SETTLEMENT_METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}
                            </span>
                            {t.paymentMethod === "PIX" && t.pixKey ? (
                              <p className="text-xs text-muted-foreground">
                                {formatPixKey(t.pixKeyType, t.pixKey)}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          {(t.status === "OPEN" || t.status === "PARTIAL") && can(perms.settle) ? (
                            <Button variant="ghost" size="sm" onClick={() => openSettle(t)}>
                              Baixar
                            </Button>
                          ) : null}
                          <Link
                            href={`/${isReceivable ? "contas-a-receber" : "contas-a-pagar"}/${t.id}`}
                            className={buttonClasses("ghost", "sm")}
                          >
                            Detalhes
                          </Link>
                          {can(perms.del) ? (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(t)}>
                              Excluir
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} título(s)</span>
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

      {/* Modal criar título */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Novo título — ${isReceivable ? "a receber" : "a pagar"}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>
              {saving ? <Spinner /> : null} Criar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Descrição" className="sm:col-span-2">
            <Input required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Parceiro">
            <Select value={form.partnerId} onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}>
              <option value="">Selecione…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Número do documento">
            <Input value={form.documentNumber ?? ""} onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))} />
          </Field>
          <Field label="Data de emissão">
            <Input type="date" required value={form.issueDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} />
          </Field>
          <Field label="Vencimento (1ª parcela)">
            <Input type="date" required value={form.dueDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </Field>
          <Field label="Valor total">
            <Input type="number" step="0.01" min="0.01" required value={form.totalAmount ?? ""} onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))} />
          </Field>
          <Field label="Quantidade de parcelas" hint="O valor é rateado automaticamente.">
            <Input type="number" min={1} max={60} value={String(installmentsCount)} onChange={(e) => setInstallmentsCount(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Forma de pagamento" hint="Se for PIX, informe a chave de destino.">
            <Select value={form.paymentMethod ?? ""} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="">Selecione…</option>
              {Object.entries(SETTLEMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          {form.paymentMethod === "PIX" ? (
            <>
              <Field label="Tipo de chave Pix">
                <Select value={form.pixKeyType ?? ""} onChange={(e) => changePixType(e.target.value)}>
                  <option value="">Selecione…</option>
                  {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Chave Pix"
                className="sm:col-span-2"
                hint="A chave é formatada automaticamente conforme o tipo escolhido."
              >
                <Input
                  value={form.pixKey ?? ""}
                  onChange={(e) => changePixKey(e.target.value)}
                  inputMode={form.pixKeyType === "CPF_CNPJ" || form.pixKeyType === "PHONE" ? "numeric" : "text"}
                  placeholder={pixPlaceholder(form.pixKeyType ?? "")}
                  autoComplete="off"
                />
              </Field>
            </>
          ) : null}
          <Field label="Categoria">
            <Select value={form.categoryId ?? ""} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Selecione…</option>
              {categories
                .filter((c) => (isReceivable ? c.type === "INCOME" : c.type === "EXPENSE"))
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
          <Field label="Observações" className="sm:col-span-2">
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
        {formError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        ) : null}
      </Modal>

      {/* Modal baixa */}
      <Modal
        open={Boolean(settleState)}
        onClose={() => setSettleState(null)}
        title={`Baixa — ${settleState?.title.description ?? ""}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setSettleState(null)}>Cancelar</Button>
            <Button variant="success" onClick={settle} disabled={settling}>
              {settling ? <Spinner /> : null} Confirmar baixa
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Parcelas"
            className="sm:col-span-2"
            hint="Marque uma ou mais parcelas. Ao marcar várias, cada uma é baixada pelo valor restante."
          >
            <div className="space-y-2">
              {settleState?.installments.map((i) => {
                const remaining = Number(i.amount) - Number(i.paidAmount);
                const checked = settleIds.includes(i.id);
                return (
                  <label
                    key={i.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={checked}
                      onChange={() => toggleSettleInstallment(i.id)}
                    />
                    <span className="flex-1">
                      Parcela {i.number} — vence {formatDate(i.dueDate)}
                    </span>
                    <span className="font-medium">{formatCurrency(remaining)}</span>
                  </label>
                );
              })}
            </div>
          </Field>
          {settleIsMulti ? (
            <Field
              label="Valor total (principal)"
              className="sm:col-span-2"
              hint="Baixa pelo valor restante de cada parcela selecionada (sem juros/multa/desconto)."
            >
              <Input value={settleSelectedTotal.toFixed(2)} readOnly />
            </Field>
          ) : (
            <>
              <Field label="Valor (principal)">
                <Input type="number" step="0.01" min="0" required value={settleForm.amount ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, amount: e.target.value }))} />
              </Field>
              <Field label="Juros">
                <Input type="number" step="0.01" min="0" value={settleForm.interest ?? "0"} onChange={(e) => setSettleForm((f) => ({ ...f, interest: e.target.value }))} />
              </Field>
              <Field label="Multa">
                <Input type="number" step="0.01" min="0" value={settleForm.fine ?? "0"} onChange={(e) => setSettleForm((f) => ({ ...f, fine: e.target.value }))} />
              </Field>
              <Field label="Desconto">
                <Input type="number" step="0.01" min="0" value={settleForm.discount ?? "0"} onChange={(e) => setSettleForm((f) => ({ ...f, discount: e.target.value }))} />
              </Field>
            </>
          )}
          <Field label="Conta / caixa">
            <Select required value={settleForm.bankAccountId ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Data da baixa">
            <Input type="date" required value={settleForm.date ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Forma de pagamento">
            <Select required value={settleForm.method ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, method: e.target.value }))}>
              {Object.entries(SETTLEMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <Textarea value={settleForm.notes ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
        {settleError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{settleError}</p>
        ) : null}
      </Modal>
    </div>
  );
}