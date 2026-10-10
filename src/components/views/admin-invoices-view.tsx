"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { api, buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { BillingMessageModal } from "@/components/billing-message-modal";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatPixKey,
  INVOICE_STATUS_LABELS,
  PIX_KEY_TYPE_LABELS,
  SETTLEMENT_METHOD_LABELS,
} from "@/lib/format";

interface InvoiceItem {
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
  company: {
    id: string;
    name: string;
    email: string | null;
    billingEmail: string | null;
    phone: string | null;
  };
}

interface ListResponse {
  items: InvoiceItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface CompanyOption {
  id: string;
  name: string;
  status: string;
}

interface CompanyListResponse {
  items: CompanyOption[];
  total: number;
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

const INVOICE_TONES: Record<string, "yellow" | "green" | "red" | "gray"> = {
  PENDING: "yellow",
  PAID: "green",
  OVERDUE: "red",
  CANCELED: "gray",
};

export function AdminInvoicesView() {
  const { notify } = useToast();
  const [filters, setFilters] = useState<FilterValues>({ q: "", status: "" });
  const [applied, setApplied] = useState<FilterValues>({ q: "", status: "" });
  const [page, setPage] = useState(1);
  const [sendInvoice, setSendInvoice] = useState<InvoiceItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ---- nova cobrança ----
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<Record<string, string>>({});
  const [savingNew, setSavingNew] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  const { data: companiesData } = useApiQuery<CompanyListResponse>(
    "/api/admin/companies?pageSize=100",
  );
  const companies = companiesData?.items ?? [];

  function todayPlusDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function openNewInvoice() {
    const days = settings?.defaultDueDays ?? 5;
    setNewForm({
      companyId: "",
      description: "",
      amount:
        settings?.defaultAmount != null ? String(settings.defaultAmount) : "",
      dueDate: todayPlusDays(days),
      method: "PIX",
      pixKeyType: settings?.pixKeyType ?? "",
      pixKey: settings?.pixKey ?? "",
      boletoUrl: "",
      notes: "",
      installments: "1",
      intervalMonths: "1",
    });
    setNewError(null);
    setNewOpen(true);
  }

  async function createNewInvoice() {
    setSavingNew(true);
    setNewError(null);
    try {
      if (!newForm.companyId) throw new Error("Selecione a empresa.");
      const isPix = newForm.method === "PIX";
      if (isPix && !newForm.pixKeyType) {
        throw new Error("Selecione o tipo da chave Pix.");
      }
      if (isPix && !(newForm.pixKey ?? "").trim()) {
        throw new Error("Informe a chave Pix.");
      }
      const count = Math.max(1, Number(newForm.installments || 1));
      const intervalMonths = Math.max(1, Number(newForm.intervalMonths || 1));
      await api.post("/api/admin/invoices", {
        companyId: newForm.companyId,
        description: newForm.description,
        amount: Number(newForm.amount || 0),
        dueDate: newForm.dueDate,
        method: newForm.method || null,
        pixKeyType: isPix ? newForm.pixKeyType || null : null,
        pixKey: isPix ? newForm.pixKey || null : null,
        boletoUrl: newForm.boletoUrl || null,
        notes: newForm.notes || null,
        installments: count,
        intervalMonths,
      });
      notify(
        count > 1
          ? `${count} cobranças geradas com sucesso.`
          : "Cobrança criada.",
        "success",
      );
      setNewOpen(false);
      await reload();
    } catch (err) {
      setNewError(
        err instanceof Error ? err.message : "Erro ao criar cobrança.",
      );
    } finally {
      setSavingNew(false);
    }
  }

  const { data: settings } = useApiQuery<BillingSettings>("/api/admin/settings");

  const query = useMemo(
    () =>
      `/api/admin/invoices${buildQuery({
        q: applied.q,
        status: applied.status,
        page,
      })}`,
    [applied, page],
  );
  const { data, loading, error, reload } = useApiQuery<ListResponse>(query);

  async function patchInvoice(inv: InvoiceItem, body: Record<string, unknown>) {
    setBusyId(inv.id);
    try {
      await api.patch(`/api/admin/invoices/${inv.id}`, body);
      notify("Cobrança atualizada.", "success");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function removeInvoice(inv: InvoiceItem) {
    setBusyId(inv.id);
    try {
      await api.delete(`/api/admin/invoices/${inv.id}`);
      notify("Cobrança removida.", "success");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro.", "error");
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cobranças"
        description="Todas as faturas emitidas para as empresas da plataforma."
        actions={
          <Button onClick={openNewInvoice}>
            <Receipt className="mr-1 h-4 w-4" /> Nova cobrança
          </Button>
        }
      />

      <FilterBar
        fields={[
          {
            key: "q",
            label: "Buscar",
            type: "text",
            placeholder: "Descrição da cobrança",
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "PENDING", label: "Pendentes" },
              { value: "OVERDUE", label: "Vencidas" },
              { value: "PAID", label: "Pagas" },
              { value: "CANCELED", label: "Canceladas" },
            ],
          },
        ]}
        values={filters}
        onChange={setFilters}
        onSubmit={() => {
          setApplied(filters);
          setPage(1);
        }}
        onReset={() => {
          setApplied({ q: "", status: "" });
          setPage(1);
        }}
        loading={loading}
      />

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> Carregando…
            </div>
          ) : error ? (
            <EmptyState
              title="Erro ao carregar"
              description={error}
              action={
                <button onClick={reload} className="text-primary">
                  Tentar novamente
                </button>
              }
            />
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="Nenhuma cobrança encontrada"
              description="Emita cobranças na tela de cada empresa."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Empresa / Descrição</TH>
                  <TH align="right">Valor</TH>
                  <TH>Vencimento</TH>
                  <TH>Status</TH>
                  <TH className="hidden lg:table-cell">Forma</TH>
                  <TH align="right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((inv) => (
                  <TR key={inv.id}>
                    <TD>
                      <Link
                        href={`/admin/empresas/${inv.company.id}`}
                        className="text-xs font-medium text-muted-foreground hover:text-primary"
                      >
                        {inv.company.name}
                      </Link>
                      <p className="font-medium">{inv.description}</p>
                      {inv.method === "PIX" && inv.pixKey ? (
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
                            disabled={busyId === inv.id}
                            onClick={() => patchInvoice(inv, { status: "PAID" })}
                          >
                            Paga
                          </Button>
                        ) : null}
                        {inv.status !== "CANCELED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === inv.id}
                            onClick={() =>
                              patchInvoice(inv, { status: "CANCELED" })
                            }
                          >
                            Cancelar
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={busyId === inv.id}
                          onClick={() => removeInvoice(inv)}
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

      {data && data.total > data.pageSize ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {data.page} de {totalPages} · {data.total} cobrança(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}

      {/* Modal: nova cobrança (única ou parcelada/recorrente) */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nova cobrança"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createNewInvoice} disabled={savingNew}>
              {savingNew ? <Spinner /> : null} Gerar
            </Button>
          </>
        }
      >
        {newError ? (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {newError}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Empresa" className="sm:col-span-2">
            <Select
              value={newForm.companyId ?? ""}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, companyId: e.target.value }))
              }
            >
              <option value="">Selecione…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Input
              value={newForm.description ?? ""}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Ex.: Mensalidade do plano"
            />
          </Field>
          <Field label="Valor de cada parcela">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={newForm.amount ?? ""}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </Field>
          <Field label="Vencimento da 1ª parcela">
            <Input
              type="date"
              value={newForm.dueDate ?? ""}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, dueDate: e.target.value }))
              }
            />
          </Field>
          <Field
            label="Nº de parcelas"
            hint="1 = cobrança única. Ex.: 12 para gerar 12 cobranças."
          >
            <Input
              type="number"
              min="1"
              max="60"
              value={newForm.installments ?? "1"}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, installments: e.target.value }))
              }
            />
          </Field>
          <Field label="Repetir a cada (meses)">
            <Select
              value={newForm.intervalMonths ?? "1"}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, intervalMonths: e.target.value }))
              }
            >
              <option value="1">1 mês (mensal)</option>
              <option value="2">2 meses (bimestral)</option>
              <option value="3">3 meses (trimestral)</option>
              <option value="6">6 meses (semestral)</option>
              <option value="12">12 meses (anual)</option>
            </Select>
          </Field>
          <Field label="Forma de pagamento">
            <Select
              value={newForm.method ?? ""}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, method: e.target.value }))
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
          {newForm.method === "PIX" ? (
            <>
              <Field label="Tipo de chave Pix">
                <Select
                  value={newForm.pixKeyType ?? ""}
                  onChange={(e) =>
                    setNewForm((f) => ({
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
                  value={newForm.pixKey ?? ""}
                  onChange={(e) =>
                    setNewForm((f) => ({
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
              value={newForm.boletoUrl ?? ""}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, boletoUrl: e.target.value }))
              }
              placeholder="https://…"
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <Textarea
              value={newForm.notes ?? ""}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </Field>
        </div>

        {Number(newForm.installments || 1) > 1 &&
        Number(newForm.amount || 0) > 0 ? (
          <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm">
            Serão geradas <strong>{Number(newForm.installments)}</strong>{" "}
            cobranças de{" "}
            <strong>{formatCurrency(Number(newForm.amount))}</strong> cada
            (total{" "}
            <strong>
              {formatCurrency(
                Number(newForm.amount) * Number(newForm.installments),
              )}
            </strong>
            ), a cada {Number(newForm.intervalMonths || 1)} mês(es), a partir de{" "}
            <strong>{formatDate(newForm.dueDate ?? "")}</strong>.
          </p>
        ) : null}
      </Modal>

      <BillingMessageModal
        open={Boolean(sendInvoice)}
        onClose={() => setSendInvoice(null)}
        companyName={sendInvoice?.company.name ?? ""}
        contactEmail={
          sendInvoice?.company.billingEmail ?? sendInvoice?.company.email
        }
        contactPhone={sendInvoice?.company.phone}
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
