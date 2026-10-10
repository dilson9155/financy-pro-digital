"use client";

import { useState } from "react";
import { useApiQuery } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatPixKey,
  INVOICE_STATUS_LABELS,
  PIX_KEY_TYPE_LABELS,
  SETTLEMENT_METHOD_LABELS,
} from "@/lib/format";
import { rawPixKey } from "@/lib/billing";

interface InvoiceItem {
  id: string;
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
}

interface PaymentInfo {
  pixKey: string | null;
  pixKeyType: string | null;
  pixHolder: string | null;
  bankName: string | null;
  paymentInstructions: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  qrCodeUrl: string | null;
}

interface Response {
  items: InvoiceItem[];
  summary: {
    openCount: number;
    overdueCount: number;
    paidCount: number;
    openAmount: number;
  };
  payment: PaymentInfo;
}

const STATUS_TONES: Record<string, "yellow" | "green" | "red" | "gray"> = {
  PENDING: "yellow",
  PAID: "green",
  OVERDUE: "red",
  CANCELED: "gray",
};

export function MyInvoicesView() {
  const { notify } = useToast();
  const { data, loading, error } =
    useApiQuery<Response>("/api/invoices");
  const [selected, setSelected] = useState<InvoiceItem | null>(null);

  async function copy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} copiado(a).`, "success");
    } catch {
      notify("Não foi possível copiar. Copie manualmente.", "error");
    }
  }

  const payment: PaymentInfo | undefined = data?.payment;
  const payKey = selected?.pixKey ?? payment?.pixKey ?? null;
  const payKeyType = selected?.pixKeyType ?? payment?.pixKeyType ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Minhas cobranças"
        description="Acompanhe aqui as mensalidades e cobranças da sua conta."
      />

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <EmptyState title="Não foi possível carregar" description={error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Em aberto"
              value={formatCurrency(data?.summary.openAmount ?? 0)}
              hint={`${data?.summary.openCount ?? 0} cobrança(s)`}
              tone="primary"
            />
            <StatCard
              label="Vencidas"
              value={String(data?.summary.overdueCount ?? 0)}
              hint="Precisam de atenção"
              tone="destructive"
            />
            <StatCard
              label="Pagas"
              value={String(data?.summary.paidCount ?? 0)}
              hint="Liquidado com sucesso"
              tone="success"
            />
          </div>

          {payment?.pixKey || payment?.qrCodeUrl ? (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-4 text-sm sm:flex-row sm:items-start sm:gap-5">
                {payment.qrCodeUrl ? (
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-md border bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={payment.qrCodeUrl}
                        alt="QR Code Pix"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Leia com o app do banco
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col gap-1">
                  <p className="font-medium">Como pagar</p>
                  {payment.pixKey ? (
                    <p className="text-muted-foreground">
                      PIX{" "}
                      {payment.pixKeyType
                        ? `(${PIX_KEY_TYPE_LABELS[payment.pixKeyType] ?? payment.pixKeyType})`
                        : ""}
                      : {formatPixKey(payment.pixKeyType, payment.pixKey)}
                      {payment.pixHolder ? ` · Titular: ${payment.pixHolder}` : ""}
                      {payment.bankName ? ` · Banco: ${payment.bankName}` : ""}
                    </p>
                  ) : null}
                  {payment.paymentInstructions ? (
                    <p className="text-muted-foreground">
                      {payment.paymentInstructions}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!data || data.items.length === 0 ? (
            <EmptyState
              title="Nenhuma cobrança"
              description="Quando houver mensalidades ou cobranças, elas aparecerão aqui."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {data.items.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="flex items-start justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inv.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Vence em {formatDate(inv.dueDate)}
                        {inv.paidAt
                          ? ` · pago em ${formatDate(inv.paidAt)}`
                          : ""}
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {formatCurrency(inv.amount)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge tone={STATUS_TONES[inv.status] ?? "gray"}>
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(inv)}
                      >
                        Ver pagamento
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detalhes da cobrança"
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Fechar
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{selected.description}</p>
                <p className="text-muted-foreground">
                  Vencimento: {formatDate(selected.dueDate)}
                </p>
              </div>
              <Badge tone={STATUS_TONES[selected.status] ?? "gray"}>
                {INVOICE_STATUS_LABELS[selected.status] ?? selected.status}
              </Badge>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(selected.amount)}
            </p>

            {selected.method ? (
              <p className="text-muted-foreground">
                Forma de pagamento:{" "}
                {SETTLEMENT_METHOD_LABELS[selected.method] ?? selected.method}
              </p>
            ) : null}

            {payment?.qrCodeUrl ? (
              <div className="flex flex-col items-center gap-1 rounded-md border p-3">
                <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-md bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={payment.qrCodeUrl}
                    alt="QR Code Pix"
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Abra o app do banco e leia o QR Code para pagar
                </span>
              </div>
            ) : null}

            {payKey ? (
              <div className="rounded-md border p-3">
                <p className="mb-1 font-medium">Chave Pix</p>
                <p className="break-all text-muted-foreground">
                  {payKeyType
                    ? `(${PIX_KEY_TYPE_LABELS[payKeyType] ?? payKeyType}) `
                    : ""}
                  {formatPixKey(payKeyType, payKey)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copy(rawPixKey(payKeyType, payKey), "Chave Pix")}
                >
                  Copiar chave Pix
                </Button>
              </div>
            ) : null}

            {selected.boletoUrl ? (
              <a
                className="block rounded-md border p-3 text-primary hover:underline"
                href={selected.boletoUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir boleto
              </a>
            ) : null}

            {payment?.paymentInstructions ? (
              <p className="rounded-md bg-muted p-3 text-muted-foreground">
                {payment.paymentInstructions}
              </p>
            ) : null}

            {selected.notes ? (
              <p className="text-muted-foreground">{selected.notes}</p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Após o pagamento, envie o comprovante para{" "}
              {payment?.contactEmail ?? payment?.contactPhone ?? "o suporte"}.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
