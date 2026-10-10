"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/modal";
import { BillingMessageModal } from "@/components/billing-message-modal";
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
  PageHeader,
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
} from "@/components/ui";
import {
  COMPANY_STATUS_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPixKey,
  INVOICE_STATUS_LABELS,
  PIX_KEY_TYPE_LABELS,
  SETTLEMENT_METHOD_LABELS,
} from "@/lib/format";
import { mailtoLink, rawPixKey, whatsappLink } from "@/lib/billing";

interface Member {
  membershipId: string;
  membershipStatus: string;
  userId: string;
  name: string;
  email: string;
  userStatus: string;
  lastLoginAt: string | null;
  isSuperAdmin: boolean;
  roleName: string;
}

interface Invoice {
  id: string;
  companyId: string;
  description: string;
  amount: string;
  dueDate: string;
  status: string;
  method: string | null;
  pixKeyType: string | null;
  pixKey: string | null;
  boletoUrl: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface CompanyDetail {
  id: string;
  name: string;
  legalName: string | null;
  document: string | null;
  email: string | null;
  billingEmail: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  status: string;
  suspendedReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  memberships: Member[];
  invoices: Invoice[];
  _count: { titles: number; bankAccounts: number; transactions: number };
}

interface BillingSettings {
  pixKeyType: string | null;
  pixKey: string | null;
  pixHolder: string | null;
  bankName: string | null;
  paymentInstructions: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  defaultAmount: number | null;
  defaultDueDays: number | null;
}

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Recife",
  "America/Porto_Velho",
  "America/Bahia",
  "UTC",
];

const STATUS_TONES: Record<string, "green" | "yellow" | "gray"> = {
  ACTIVE: "green",
  SUSPENDED: "yellow",
  CANCELED: "gray",
};

const INVOICE_TONES: Record<string, "yellow" | "green" | "red" | "gray"> = {
  PENDING: "yellow",
  PAID: "green",
  OVERDUE: "red",
  CANCELED: "gray",
};

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AdminCompanyDetailView({ companyId }: { companyId: string }) {
  const { notify } = useToast();
  const router = useRouter();

  const { data, loading, error, reload } = useApiQuery<CompanyDetail>(
    `/api/admin/companies/${companyId}`,
  );
  const { data: settings } = useApiQuery<BillingSettings>("/api/admin/settings");

  const [tab, setTab] = useState<"dados" | "cobrancas">("dados");
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: "SUSPENDED", reason: "" });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const [invoiceModal, setInvoiceModal] = useState<{
    open: boolean;
    editing: Invoice | null;
  }>({ open: false, editing: null });
  const [invoiceForm, setInvoiceForm] = useState<Record<string, string>>({});
  const [savingInvoice, setSavingInvoice] = useState(false);

  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  function hydrate(d: CompanyDetail) {
    setForm({
      name: d.name ?? "",
      legalName: d.legalName ?? "",
      document: d.document ?? "",
      email: d.email ?? "",
      billingEmail: d.billingEmail ?? "",
      phone: d.phone ?? "",
      address: d.address ?? "",
      currency: d.currency ?? "BRL",
      timezone: d.timezone ?? "America/Sao_Paulo",
    });
    setStatusForm({
      status: d.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      reason: d.suspendedReason ?? "",
    });
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Spinner /> Carregando…
      </div>
    );
  }
  if (error) {
    return <EmptyState title="Erro ao carregar" description={error} />;
  }
  if (!data) return null;

  if (Object.keys(form).length === 0) {
    setTimeout(() => hydrate(data), 0);
  }

  const members = data.memberships;
  const admins = members.filter((m) => m.roleName === "Administrador");
  const contacts = admins.length > 0 ? admins : members;

  async function saveData() {
    setSaving(true);
    try {
      await api.patch(`/api/admin/companies/${companyId}`, {
        name: form.name,
        legalName: form.legalName || null,
        document: form.document || null,
        email: form.email || null,
        billingEmail: form.billingEmail || null,
        phone: form.phone || null,
        address: form.address || null,
        currency: form.currency || "BRL",
        timezone: form.timezone || "America/Sao_Paulo",
      });
      notify("Dados salvos.", "success");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function applyStatus() {
    setBusy(true);
    try {
      await api.post(`/api/admin/companies/${companyId}/status`, {
        status: statusForm.status,
        reason: statusForm.reason || null,
      });
      notify("Status atualizado.", "success");
      setStatusOpen(false);
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao atualizar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (confirmName !== data?.name) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/companies/${companyId}`);
      notify("Empresa excluída.", "success");
      router.push("/admin/empresas");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao excluir.", "error");
      setBusy(false);
    }
  }

  function openNewInvoice() {
    const days = settings?.defaultDueDays ?? 5;
    setInvoiceForm({
      description: "",
      amount: settings?.defaultAmount != null ? String(settings.defaultAmount) : "",
      dueDate: todayPlusDays(days),
      method: settings?.pixKey ? "PIX" : "PIX",
      pixKeyType: settings?.pixKeyType ?? "",
      pixKey: settings?.pixKey ?? "",
      boletoUrl: "",
      notes: "",
    });
    setInvoiceModal({ open: true, editing: null });
  }

  function openEditInvoice(inv: Invoice) {
    setInvoiceForm({
      description: inv.description,
      amount: inv.amount,
      dueDate: inv.dueDate.slice(0, 10),
      method: inv.method ?? "",
      pixKeyType: inv.pixKeyType ?? "",
      pixKey: inv.pixKey ?? "",
      boletoUrl: inv.boletoUrl ?? "",
      notes: inv.notes ?? "",
    });
    setInvoiceModal({ open: true, editing: inv });
  }

  async function saveInvoice() {
    setSavingInvoice(true);
    try {
      const isPix = invoiceForm.method === "PIX";
      const payload = {
        description: invoiceForm.description,
        amount: Number(invoiceForm.amount || 0),
        dueDate: invoiceForm.dueDate,
        method: invoiceForm.method || null,
        pixKeyType: isPix ? invoiceForm.pixKeyType || null : null,
        pixKey: isPix ? invoiceForm.pixKey || null : null,
        boletoUrl: invoiceForm.boletoUrl || null,
        notes: invoiceForm.notes || null,
      };
      if (invoiceModal.editing) {
        await api.patch(`/api/admin/invoices/${invoiceModal.editing.id}`, payload);
        notify("Cobrança atualizada.", "success");
      } else {
        await api.post("/api/admin/invoices", { companyId, ...payload });
        notify("Cobrança criada.", "success");
      }
      setInvoiceModal({ open: false, editing: null });
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setSavingInvoice(false);
    }
  }

  async function markInvoice(inv: Invoice, status: string) {
    try {
      await api.patch(`/api/admin/invoices/${inv.id}`, { status });
      notify("Cobrança atualizada.", "success");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro.", "error");
    }
  }

  async function deleteInvoice(inv: Invoice) {
    try {
      await api.delete(`/api/admin/invoices/${inv.id}`);
      notify("Cobrança removida.", "success");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro.", "error");
    }
  }

  const totalOpen = data.invoices
    .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.name}
        description={data.legalName ?? data.document ?? "Detalhes da empresa"}
        actions={
          <>
            <Button
              variant={data.status === "ACTIVE" ? "outline" : "success"}
              onClick={() => {
                setStatusOpen(true);
              }}
            >
              {data.status === "ACTIVE" ? "Inativar" : "Ativar"}
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                setConfirmName("");
                setDeleteOpen(true);
              }}
            >
              Excluir
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONES[data.status] ?? "gray"}>
          {COMPANY_STATUS_LABELS[data.status] ?? data.status}
        </Badge>
        {data.suspendedReason ? (
          <span className="text-xs text-muted-foreground">
            Motivo: {data.suspendedReason}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          Criada em {formatDate(data.createdAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Usuários" value={String(members.length)} />
        <StatCard label="Títulos" value={String(data._count.titles)} />
        <StatCard label="Contas/caixas" value={String(data._count.bankAccounts)} />
        <StatCard
          label="Em aberto"
          value={formatCurrency(totalOpen)}
          tone={totalOpen > 0 ? "warning" : "default"}
        />
      </div>

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab("dados")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "dados"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Dados e contato
        </button>
        <button
          type="button"
          onClick={() => setTab("cobrancas")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "cobrancas"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Cobranças ({data.invoices.length})
        </button>
      </div>

      {tab === "dados" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Dados da empresa</CardTitle>
              <CardDescription>Edite as informações cadastrais.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nome fantasia">
                  <Input
                    value={form.name ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Razão social">
                  <Input
                    value={form.legalName ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, legalName: e.target.value }))
                    }
                  />
                </Field>
                <Field label="CNPJ / CPF">
                  <Input
                    value={form.document ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, document: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={form.phone ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="E-mail de cobrança"
                  hint="Usado no envio de cobranças."
                >
                  <Input
                    type="email"
                    value={form.billingEmail ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, billingEmail: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Endereço">
                  <Input
                    value={form.address ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Moeda">
                  <Select
                    value={form.currency ?? "BRL"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, currency: e.target.value }))
                    }
                  >
                    <option value="BRL">BRL — Real</option>
                    <option value="USD">USD — Dólar</option>
                    <option value="EUR">EUR — Euro</option>
                  </Select>
                </Field>
                <Field label="Fuso horário">
                  <Select
                    value={form.timezone ?? "America/Sao_Paulo"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, timezone: e.target.value }))
                    }
                  >
                    {TIMEZONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={saveData} disabled={saving}>
                  {saving ? <Spinner /> : null} Salvar dados
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contato dos administradores</CardTitle>
              <CardDescription>
                Fale com quem administra esta empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {contacts.length === 0 ? (
                <EmptyState title="Nenhum usuário vinculado." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Usuário</TH>
                      <TH className="hidden md:table-cell">Papel</TH>
                      <TH className="hidden lg:table-cell">Último acesso</TH>
                      <TH align="right">Contato</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {contacts.map((m) => {
                      const msg = `Ola, ${m.name}! Falamos sobre a conta da empresa ${data.name}.`;
                      const mail = mailtoLink(
                        m.email,
                        `Contato — ${data.name}`,
                        msg,
                      );
                      const wa = whatsappLink(data.phone, msg);
                      return (
                        <TR key={m.membershipId}>
                          <TD>
                            <span className="font-medium">{m.name}</span>
                            <p className="text-xs text-muted-foreground">
                              {m.email}
                            </p>
                          </TD>
                          <TD className="hidden md:table-cell">
                            <Badge tone={m.isSuperAdmin ? "purple" : "blue"}>
                              {m.roleName}
                            </Badge>
                          </TD>
                          <TD className="hidden lg:table-cell">
                            {m.lastLoginAt ? formatDateTime(m.lastLoginAt) : "—"}
                          </TD>
                          <TD align="right">
                            <div className="flex justify-end gap-1">
                              {mail ? (
                                <a
                                  href={mail}
                                  className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                                >
                                  E-mail
                                </a>
                              ) : null}
                              {wa ? (
                                <a
                                  href={wa}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                                >
                                  WhatsApp
                                </a>
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
        </>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Cobranças</CardTitle>
              <CardDescription>
                Emita, envie e acompanhe os pagamentos desta empresa.
              </CardDescription>
            </div>
            <Button onClick={openNewInvoice}>Nova cobrança</Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.invoices.length === 0 ? (
              <EmptyState
                title="Nenhuma cobrança emitida"
                description="Clique em Nova cobrança para gerar a primeira."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Descrição</TH>
                    <TH align="right">Valor</TH>
                    <TH>Vencimento</TH>
                    <TH>Status</TH>
                    <TH className="hidden lg:table-cell">Forma</TH>
                    <TH align="right">Ações</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.invoices.map((inv) => (
                    <TR key={inv.id}>
                      <TD>
                        <span className="font-medium">{inv.description}</span>
                        {inv.pixKey && inv.method === "PIX" ? (
                          <p className="text-xs text-muted-foreground">
                            Pix: {formatPixKey(inv.pixKeyType, inv.pixKey)}
                          </p>
                        ) : null}
                      </TD>
                      <TD align="right">{formatCurrency(inv.amount)}</TD>
                      <TD>{formatDate(inv.dueDate)}</TD>
                      <TD>
                        <Badge tone={INVOICE_TONES[inv.status] ?? "gray"}>
                          {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                        </Badge>
                      </TD>
                      <TD className="hidden lg:table-cell">
                        {inv.method
                          ? SETTLEMENT_METHOD_LABELS[inv.method] ?? inv.method
                          : "—"}
                      </TD>
                      <TD align="right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSendInvoice(inv)}
                          >
                            Enviar
                          </Button>
                          {inv.status !== "PAID" ? (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => markInvoice(inv, "PAID")}
                            >
                              Paga
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditInvoice(inv)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => deleteInvoice(inv)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: status */}
      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={
          statusForm.status === "ACTIVE" ? "Ativar empresa" : "Inativar empresa"
        }
        description={data.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={
                statusForm.status === "ACTIVE" ? "success" : "destructive"
              }
              onClick={applyStatus}
              disabled={busy}
            >
              {busy ? <Spinner /> : null} Confirmar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Novo status">
            <Select
              value={statusForm.status}
              onChange={(e) =>
                setStatusForm((s) => ({ ...s, status: e.target.value }))
              }
            >
              <option value="ACTIVE">Ativa</option>
              <option value="SUSPENDED">Suspensa (bloqueia acesso)</option>
              <option value="CANCELED">Cancelada (bloqueia acesso)</option>
            </Select>
          </Field>
          {statusForm.status !== "ACTIVE" ? (
            <Field label="Motivo" hint="Ex.: falta de pagamento.">
              <Textarea
                value={statusForm.reason}
                onChange={(e) =>
                  setStatusForm((s) => ({ ...s, reason: e.target.value }))
                }
              />
            </Field>
          ) : null}
        </div>
      </Modal>

      {/* Modal: excluir */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Excluir empresa definitivamente"
        description={data.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={doDelete}
              disabled={busy || confirmName !== data.name}
            >
              {busy ? <Spinner /> : null} Excluir definitivamente
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Esta ação apaga <strong>todos os dados</strong> da empresa e não pode
            ser desfeita.
          </p>
          <Field label={`Digite "${data.name}" para confirmar`}>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      {/* Modal: criar/editar cobrança */}
      <Modal
        open={invoiceModal.open}
        onClose={() => setInvoiceModal({ open: false, editing: null })}
        title={invoiceModal.editing ? "Editar cobrança" : "Nova cobrança"}
        description={data.name}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setInvoiceModal({ open: false, editing: null })}
            >
              Cancelar
            </Button>
            <Button onClick={saveInvoice} disabled={savingInvoice}>
              {savingInvoice ? <Spinner /> : null} Salvar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Descrição" className="sm:col-span-2">
            <Input
              value={invoiceForm.description ?? ""}
              onChange={(e) =>
                setInvoiceForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Ex.: Mensalidade — Outubro/2026"
            />
          </Field>
          <Field label="Valor (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={invoiceForm.amount ?? ""}
              onChange={(e) =>
                setInvoiceForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </Field>
          <Field label="Vencimento">
            <Input
              type="date"
              value={invoiceForm.dueDate ?? ""}
              onChange={(e) =>
                setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))
              }
            />
          </Field>
          <Field label="Forma de pagamento">
            <Select
              value={invoiceForm.method ?? ""}
              onChange={(e) =>
                setInvoiceForm((f) => ({ ...f, method: e.target.value }))
              }
            >
              <option value="">Selecione…</option>
              {Object.entries(SETTLEMENT_METHOD_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {invoiceForm.method === "PIX" ? (
            <>
              <Field label="Tipo de chave Pix">
                <Select
                  value={invoiceForm.pixKeyType ?? ""}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({
                      ...f,
                      pixKeyType: e.target.value,
                      pixKey: formatPixKey(e.target.value, f.pixKey ?? ""),
                    }))
                  }
                >
                  <option value="">Selecione…</option>
                  {Object.entries(PIX_KEY_TYPE_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Chave Pix"
                className="sm:col-span-2"
                hint="Formatada automaticamente. Deixe vazio para usar a chave padrão da plataforma."
              >
                <Input
                  value={invoiceForm.pixKey ?? ""}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({
                      ...f,
                      pixKey: formatPixKey(f.pixKeyType, e.target.value),
                    }))
                  }
                />
              </Field>
            </>
          ) : null}
          <Field
            label="Link do boleto (opcional)"
            className="sm:col-span-2"
            hint="Cole aqui o link do boleto, se houver."
          >
            <Input
              value={invoiceForm.boletoUrl ?? ""}
              onChange={(e) =>
                setInvoiceForm((f) => ({ ...f, boletoUrl: e.target.value }))
              }
              placeholder="https://…"
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <Textarea
              value={invoiceForm.notes ?? ""}
              onChange={(e) =>
                setInvoiceForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </Field>
        </div>
      </Modal>

      {/* Modal: enviar cobrança */}
      <BillingMessageModal
        open={Boolean(sendInvoice)}
        onClose={() => setSendInvoice(null)}
        companyName={data.name}
        contactEmail={data.billingEmail ?? data.email}
        contactPhone={data.phone}
        invoice={
          sendInvoice
            ? {
                description: sendInvoice.description,
                amount: sendInvoice.amount,
                dueDate: sendInvoice.dueDate,
                pixKey: sendInvoice.pixKey,
                pixKeyType: sendInvoice.pixKeyType,
                boletoUrl: sendInvoice.boletoUrl,
              }
            : null
        }
        settings={settings ?? {}}
      />
    </div>
  );
}
