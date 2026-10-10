"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { api, buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { BillingMessageModal } from "@/components/billing-message-modal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatPixKey,
  INVOICE_STATUS_LABELS,
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
