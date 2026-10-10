import {
  formatCurrency,
  formatDate,
  formatPixKey,
  PIX_KEY_TYPE_LABELS,
} from "./format";

export interface BillingInvoiceInfo {
  description: string;
  amount: string | number;
  dueDate: string | Date;
  pixKey?: string | null;
  pixKeyType?: string | null;
  boletoUrl?: string | null;
}

export interface BillingSettingsInfo {
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixHolder?: string | null;
  bankName?: string | null;
  paymentInstructions?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

/** Chave Pix "crua" para copiar/colar (documento e telefone apenas com digitos). */
export function rawPixKey(
  type: string | null | undefined,
  value: string | null | undefined,
): string {
  if (!value) return "";
  if (type === "CPF_CNPJ" || type === "PHONE") return value.replace(/\D/g, "");
  return value.trim();
}

/** Monta a mensagem de cobranca usada no e-mail e no WhatsApp. */
export function buildBillingMessage(opts: {
  companyName: string;
  greetingName?: string | null;
  invoice: BillingInvoiceInfo;
  settings: BillingSettingsInfo;
  appName?: string;
}): string {
  const appName = opts.appName ?? "Financy Pro Digital";
  const { invoice, settings } = opts;
  const name = opts.greetingName || opts.companyName;
  const key = invoice.pixKey ?? settings.pixKey ?? null;
  const keyType = invoice.pixKeyType ?? settings.pixKeyType ?? null;

  const lines: string[] = [];
  lines.push(`Ola, ${name}!`);
  lines.push("");
  lines.push(`Segue a cobranca referente a: ${invoice.description}`);
  lines.push(`Valor: ${formatCurrency(invoice.amount)}`);
  lines.push(`Vencimento: ${formatDate(invoice.dueDate)}`);

  if (key) {
    lines.push("");
    lines.push("Formas de pagamento — PIX:");
    if (settings.pixHolder) lines.push(`Titular: ${settings.pixHolder}`);
    if (settings.bankName) lines.push(`Banco: ${settings.bankName}`);
    lines.push(
      `Chave (${PIX_KEY_TYPE_LABELS[keyType ?? ""] ?? "PIX"}): ${formatPixKey(keyType, key)}`,
    );
  }

  if (invoice.boletoUrl) {
    lines.push("");
    lines.push(`Boleto: ${invoice.boletoUrl}`);
  }

  if (settings.paymentInstructions) {
    lines.push("");
    lines.push(settings.paymentInstructions);
  }

  lines.push("");
  lines.push(
    `Apos o pagamento, envie o comprovante para ${
      settings.contactEmail ?? settings.contactPhone ?? appName
    }.`,
  );
  lines.push("");
  lines.push(`Equipe ${appName}`);
  return lines.join("\n");
}

/** Link do WhatsApp (wa.me) com a mensagem codificada. Adiciona o DDI 55 se preciso. */
export function whatsappLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/** Link mailto com assunto e corpo codificados. */
export function mailtoLink(
  email: string | null | undefined,
  subject: string,
  body: string,
): string | null {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

/** Subject padrao de e-mail de cobranca. */
export function billingSubject(description: string, appName = "Financy Pro"): string {
  return `${appName} — Cobranca: ${description}`;
}
