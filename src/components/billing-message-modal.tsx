"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "./modal";
import { Button, buttonClasses, Field, Spinner, Textarea } from "./ui";
import { useToast } from "./toast";
import { api } from "@/lib/client";
import {
  billingSubject,
  buildBillingMessage,
  mailtoLink,
  rawPixKey,
  whatsappLink,
  type BillingInvoiceInfo,
  type BillingSettingsInfo,
} from "@/lib/billing";

export function BillingMessageModal({
  open,
  onClose,
  companyName,
  contactEmail,
  contactPhone,
  invoice,
  invoiceId,
  settings,
  onNotified,
}: {
  open: boolean;
  onClose: () => void;
  companyName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  invoice: BillingInvoiceInfo | null;
  /** Se informado, permite enviar a cobranca para as notificacoes do sistema. */
  invoiceId?: string | null;
  settings: BillingSettingsInfo;
  onNotified?: () => void;
}) {
  const { notify } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const baseMessage = useMemo(
    () =>
      invoice
        ? buildBillingMessage({ companyName, invoice, settings })
        : "",
    [companyName, invoice, settings],
  );

  useEffect(() => {
    setMessage(baseMessage);
  }, [baseMessage]);

  const subject = invoice ? billingSubject(invoice.description) : "";
  const mail = mailtoLink(contactEmail, subject, message);
  const wa = whatsappLink(contactPhone, message);
  const key = invoice?.pixKey ?? settings.pixKey ?? null;
  const keyType = invoice?.pixKeyType ?? settings.pixKeyType ?? null;

  async function copy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} copiado(a).`, "success");
    } catch {
      notify("Nao foi possivel copiar. Copie manualmente.", "error");
    }
  }

  async function sendToSystem() {
    if (!invoiceId) return;
    setSending(true);
    try {
      await api.post(`/api/admin/invoices/${invoiceId}/notify`, { message });
      notify("Cobrança enviada para as notificações da empresa.", "success");
      onNotified?.();
      onClose();
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Não foi possível enviar.",
        "error",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar cobrança"
      description={companyName}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4">
        <Field
          label="Mensagem"
          hint="A mensagem já vem preenchida com valor, vencimento e a chave Pix. Edite se quiser."
        >
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[240px] font-mono text-xs"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {invoiceId ? (
            <Button onClick={sendToSystem} disabled={sending}>
              {sending ? <Spinner /> : null} Enviar no sistema
            </Button>
          ) : null}
          {mail ? (
            <a className={buttonClasses("primary", "md")} href={mail}>
              Enviar por e-mail
            </a>
          ) : null}
          {wa ? (
            <a
              className={buttonClasses("success", "md")}
              href={wa}
              target="_blank"
              rel="noreferrer"
            >
              Enviar no WhatsApp
            </a>
          ) : null}
          <Button variant="outline" onClick={() => copy(message, "Mensagem")}>
            Copiar mensagem
          </Button>
          {key ? (
            <Button
              variant="outline"
              onClick={() => copy(rawPixKey(keyType, key), "Chave Pix")}
            >
              Copiar chave Pix
            </Button>
          ) : null}
        </div>

        {!contactEmail && !contactPhone ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Esta empresa não tem e-mail/telefone de cobrança cadastrado. Informe
            o contato nos dados da empresa ou copie a mensagem manualmente.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
