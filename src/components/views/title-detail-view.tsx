"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
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
  Textarea,
  statusTone,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPixKey,
  INSTALLMENT_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  PIX_KEY_TYPE_LABELS,
  SETTLEMENT_METHOD_LABELS,
  TITLE_STATUS_LABELS,
} from "@/lib/format";

export interface InstallmentDetail {
  id: string;
  number: number;
  dueDate: string;
  amount: string;
  paidAmount: string;
  status: string;
  bankAccount: { id: string; name: string; type: string } | null;
}

export interface SettlementDetail {
  id: string;
  amount: string;
  interest: string;
  fine: string;
  discount: string;
  total: string;
  date: string;
  method: string;
  notes: string | null;
  reversed: boolean;
  createdAt: string;
  bankAccount: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  reversal: {
    id: string;
    reason: string;
    createdAt: string;
    reversedBy: { id: string; name: string } | null;
  } | null;
}

export interface TitleDetail {
  id: string;
  direction: "PAYABLE" | "RECEIVABLE";
  documentNumber: string | null;
  description: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  settledAmount: string;
  status: string;
  paymentMethod: string | null;
  pixKeyType: string | null;
  pixKey: string | null;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  partner: { id: string; name: string; document: string | null; type: string } | null;
  category: { id: string; name: string; type: string } | null;
  costCenter: { id: string; code: string; name: string } | null;
  accountPlan: { id: string; code: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  installments: InstallmentDetail[];
  settlements: SettlementDetail[];
}

interface Option {
  id: string;
  name: string;
}

export function TitleDetailView({
  direction,
  titleId,
}: {
  direction: "PAYABLE" | "RECEIVABLE";
  titleId: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const can = useCan();
  const isReceivable = direction === "RECEIVABLE";
  const module = isReceivable ? "receivables" : "payables";
  const baseHref = isReceivable ? "/contas-a-receber" : "/contas-a-pagar";

  const [accounts, setAccounts] = useState<Option[]>([]);
  useEffect(() => {
    api
      .get<Option[]>("/api/accounts")
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const { data, loading, error, reload } = useApiQuery<TitleDetail>(
    `/api/${module}/${titleId}`,
  );

  // ---- baixa ----
  const [settleOpen, setSettleOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState<Record<string, string>>({});

  function openSettle() {
    if (!data) return;
    const inst =
      data.installments.find((i) => i.status === "OPEN" || i.status === "PARTIAL") ??
      null;
    const remaining = inst
      ? (Number(inst.amount) - Number(inst.paidAmount)).toFixed(2)
      : "0.00";
    setSettleForm({
      installmentId: inst?.id ?? "",
      amount: remaining,
      interest: "0",
      fine: "0",
      discount: "0",
      date: new Date().toISOString().slice(0, 10),
      bankAccountId: accounts[0]?.id ?? "",
      method: data.paymentMethod ?? (isReceivable ? "PIX" : "BANK_TRANSFER"),
      notes: "",
    });
    setSettleError(null);
    setSettleOpen(true);
  }

  async function settle() {
    setSettling(true);
    setSettleError(null);
    try {
      await api.post(`/api/${module}/${titleId}/settle`, {
        installmentId: settleForm.installmentId,
        amount: Number(settleForm.amount),
        interest: Number(settleForm.interest) || 0,
        fine: Number(settleForm.fine) || 0,
        discount: Number(settleForm.discount) || 0,
        date: new Date(`${settleForm.date}T12:00:00`).toISOString(),
        bankAccountId: settleForm.bankAccountId,
        method: settleForm.method,
        notes: settleForm.notes || undefined,
      });
      notify("Baixa registrada com sucesso.", "success");
      setSettleOpen(false);
      await reload();
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : "Erro na baixa.");
    } finally {
      setSettling(false);
    }
  }

  // ---- estorno da baixa ----
  const [reverseState, setReverseState] = useState<SettlementDetail | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  async function reverseSettlement() {
    if (!reverseState) return;
    setReversing(true);
    setReverseError(null);
    try {
      await api.post(`/api/settlements/${reverseState.id}/reverse`, {
        reason: reverseReason,
      });
      notify("Baixa estornada com sucesso.", "success");
      setReverseState(null);
      setReverseReason("");
      await reload();
    } catch (err) {
      setReverseError(err instanceof Error ? err.message : "Erro no estorno.");
    } finally {
      setReversing(false);
    }
  }

  // ---- cancelar / excluir ----
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function cancelTitle() {
    setCanceling(true);
    setCancelError(null);
    try {
      await api.post(`/api/${module}/${titleId}/cancel`, { reason: cancelReason });
      notify("Título cancelado.", "success");
      setCancelOpen(false);
      await reload();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Erro ao cancelar.");
    } finally {
      setCanceling(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Excluir o título "${data?.description}"?`)) return;
    try {
      await api.delete(`/api/${module}/${titleId}`);
      notify("Título excluído.", "success");
      router.push(baseHref);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao excluir.", "error");
    }
  }

  const canSettle = data
    ? (data.status === "OPEN" || data.status === "PARTIAL") &&
      can(isReceivable ? "receivables.settle" : "payables.settle")
    : false;
  const canReverse = can(isReceivable ? "receivables.reverse" : "payables.reverse");
  const canUpdate = can(isReceivable ? "receivables.update" : "payables.update");
  const canDelete = can(isReceivable ? "receivables.delete" : "payables.delete");

  const openInstallments = data?.installments.filter(
    (i) => i.status === "OPEN" || i.status === "PARTIAL",
  );
  const paidPct =
    data && Number(data.totalAmount) > 0
      ? Math.min(100, (Number(data.settledAmount) / Number(data.totalAmount)) * 100)
      : 0;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Spinner /> Carregando…
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        title="Erro ao carregar"
        description={error}
        action={
          <Link href={baseHref} className="text-primary hover:underline">
            Voltar para {isReceivable ? "contas a receber" : "contas a pagar"}
          </Link>
        }
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href={baseHref} className="text-sm text-muted-foreground hover:underline">
            ← Voltar para {isReceivable ? "contas a receber" : "contas a pagar"}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{data.description}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(data.status)}>
              {TITLE_STATUS_LABELS[data.status] ?? data.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {isReceivable ? "A receber" : "A pagar"}
              {data.documentNumber ? ` · Doc. ${data.documentNumber}` : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSettle ? (
            <Button variant="success" onClick={openSettle}>
              Baixar parcela
            </Button>
          ) : null}
          {data.status !== "CANCELED" && data.status !== "REVERSED" && canUpdate ? (
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              Cancelar
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="outline" className="text-destructive" onClick={remove}>
              Excluir
            </Button>
          ) : null}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resumo financeiro</CardTitle>
            <CardDescription>Criado em {formatDateTime(data.createdAt)} por {data.createdBy?.name ?? "—"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Valor total</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(data.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Baixado</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(data.settledAmount)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Em aberto</p>
                <p className="mt-1 text-xl font-bold">
                  {formatCurrency(Number(data.totalAmount) - Number(data.settledAmount))}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{Math.round(paidPct)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emissão</span>
              <span className="font-medium">{formatDate(data.issueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vencimento</span>
              <span className="font-medium">{formatDate(data.dueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parceiro</span>
              <span className="font-medium text-right">
                {data.partner ? `${data.partner.name}${data.partner.type ? ` (${PARTNER_TYPE_LABELS[data.partner.type] ?? data.partner.type})` : ""}` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Categoria</span>
              <span className="font-medium">{data.category?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Centro de custo</span>
              <span className="font-medium">
                {data.costCenter ? `${data.costCenter.code} — ${data.costCenter.name}` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conta contábil</span>
              <span className="font-medium">
                {data.accountPlan ? `${data.accountPlan.code} — ${data.accountPlan.name}` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Forma de pagamento</span>
              <span className="font-medium">
                {data.paymentMethod
                  ? SETTLEMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod
                  : "—"}
              </span>
            </div>
            {data.paymentMethod === "PIX" && data.pixKey ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  Chave Pix
                  {data.pixKeyType
                    ? ` (${PIX_KEY_TYPE_LABELS[data.pixKeyType] ?? data.pixKeyType})`
                    : ""}
                </span>
                <span className="break-all text-right font-medium">
                  {formatPixKey(data.pixKeyType, data.pixKey)}
                </span>
              </div>
            ) : null}
            {data.notes ? (
              <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs">{data.notes}</p>
            ) : null}
            {data.cancelReason ? (
              <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
                Cancelado: {data.cancelReason}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
          <CardDescription>Histórico de vencimentos e progresso por parcela.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Parcela</TH>
                <TH>Vencimento</TH>
                <TH align="right">Valor</TH>
                <TH align="right">Pago</TH>
                <TH>Situação</TH>
                <TH className="hidden md:table-cell">Conta da baixa</TH>
              </TR>
            </THead>
            <TBody>
              {data.installments.map((i) => (
                <TR key={i.id}>
                  <TD className="font-medium">#{i.number}</TD>
                  <TD className="whitespace-nowrap">{formatDate(i.dueDate)}</TD>
                  <TD align="right" className="whitespace-nowrap">{formatCurrency(i.amount)}</TD>
                  <TD align="right" className="whitespace-nowrap text-emerald-600">{formatCurrency(i.paidAmount)}</TD>
                  <TD>
                    <Badge tone={statusTone(i.status)}>
                      {INSTALLMENT_STATUS_LABELS[i.status] ?? i.status}
                    </Badge>
                  </TD>
                  <TD className="hidden text-muted-foreground md:table-cell">
                    {i.bankAccount?.name ?? "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Baixas */}
      <Card>
        <CardHeader>
          <CardTitle>Baixas</CardTitle>
          <CardDescription>Todas as baixas e estornos registrados.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.settlements.length === 0 ? (
            <EmptyState title="Nenhuma baixa" description="Registre uma baixa para iniciar o recebimento/pagamento." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Data</TH>
                  <TH>Conta</TH>
                  <TH align="right">Principal</TH>
                  <TH align="right" className="hidden md:table-cell">Juros/Multa</TH>
                  <TH align="right">Total</TH>
                  <TH>Forma</TH>
                  <TH>Situação</TH>
                  <TH align="right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {data.settlements.map((s) => (
                  <TR key={s.id}>
                    <TD className="whitespace-nowrap">{formatDate(s.date)}</TD>
                    <TD className="text-muted-foreground">{s.bankAccount?.name ?? "—"}</TD>
                    <TD align="right" className="whitespace-nowrap">{formatCurrency(s.amount)}</TD>
                    <TD align="right" className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {Number(s.interest) + Number(s.fine) - Number(s.discount) > 0
                        ? formatCurrency(Number(s.interest) + Number(s.fine) - Number(s.discount))
                        : "—"}
                    </TD>
                    <TD align="right" className="whitespace-nowrap font-medium">{formatCurrency(s.total)}</TD>
                    <TD>
                      <Badge tone="gray">{SETTLEMENT_METHOD_LABELS[s.method] ?? s.method}</Badge>
                    </TD>
                    <TD>
                      {s.reversed ? (
                        <Badge tone="purple">Estornada</Badge>
                      ) : (
                        <Badge tone="green">Ativa</Badge>
                      )}
                    </TD>
                    <TD align="right">
                      {!s.reversed && canReverse ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setReverseState(s);
                            setReverseReason("");
                            setReverseError(null);
                          }}
                        >
                          Estornar
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal baixa */}
      <Modal
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        title={`Baixa — ${data.description}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setSettleOpen(false)}>Cancelar</Button>
            <Button variant="success" onClick={settle} disabled={settling}>
              {settling ? <Spinner /> : null} Confirmar baixa
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Parcela" className="sm:col-span-2">
            <Select value={settleForm.installmentId ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, installmentId: e.target.value }))}>
              {(openInstallments ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  Parcela {i.number} — {formatDate(i.dueDate)} — {formatCurrency(Number(i.amount) - Number(i.paidAmount))} restante
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor (principal)">
            <Input type="number" step="0.01" min="0" required value={settleForm.amount ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="Conta / caixa">
            <Select required value={settleForm.bankAccountId ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
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
          <Field label="Data da baixa">
            <Input type="date" required value={settleForm.date ?? ""} onChange={(e) => setSettleForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Forma de pagamento" className="sm:col-span-2">
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

      {/* Modal estorno da baixa */}
      <Modal
        open={Boolean(reverseState)}
        onClose={() => setReverseState(null)}
        title="Estornar baixa"
        description={reverseState ? `Baixa de ${formatCurrency(reverseState.total)} em ${formatDate(reverseState.date)}.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setReverseState(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reverseSettlement} disabled={reversing || reverseReason.trim().length < 3}>
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

      {/* Modal cancelar título */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancelar título"
        description="O cancelamento exige que não existam baixas ativas."
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={cancelTitle} disabled={canceling || cancelReason.trim().length < 3}>
              {canceling ? <Spinner /> : null} Cancelar título
            </Button>
          </>
        }
      >
        <Field label="Motivo do cancelamento">
          <Textarea
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Informe o motivo (mínimo 3 caracteres)…"
          />
        </Field>
        {cancelError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{cancelError}</p>
        ) : null}
      </Modal>
    </div>
  );
}