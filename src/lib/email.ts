import "server-only";

import { BRAND } from "@/lib/branding";
import { getEnv } from "@/lib/env";

export interface PasswordResetEmailInput {
  to: string;
  name: string;
  resetUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Envia o e-mail de recuperacao de senha via Resend.
 *
 * Sem `RESEND_API_KEY` configurada, o link e apenas registrado no console
 * (util em desenvolvimento) e a funcao devolve `false`.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: PasswordResetEmailInput): Promise<boolean> {
  const env = getEnv();
  const apiKey = env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.info(
      `[recuperar-senha] RESEND_API_KEY nao configurada. Link para ${to}: ${resetUrl}`,
    );
    return false;
  }

  const appUrl = env.APP_URL.replace(/\/$/, "");
  const logoUrl = env.EMAIL_LOGO_URL?.trim() || `${appUrl}${BRAND.logo ?? ""}`;
  const safeName = escapeHtml(name);
  const subject = `Recuperacao de senha - ${BRAND.name}`;

  const logoHtml = logoUrl
    ? `<div style="text-align: center; margin: 0 0 20px;">
        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(BRAND.name)}" width="88" height="88" style="display: inline-block; width: 88px; height: 88px; border: 0; outline: none; text-decoration: none; border-radius: 12px;" />
      </div>`
    : "";

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; color: #0f172a;">
      ${logoHtml}
      <h2 style="margin: 0 0 16px; text-align: center;">${escapeHtml(BRAND.name)}</h2>
      <p>Ola, ${safeName}!</p>
      <p>Recebemos uma solicitacao para redefinir a senha da sua conta no ${escapeHtml(BRAND.name)}.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Redefinir minha senha
        </a>
      </p>
      <p>Este link expira em <strong>30 minutos</strong> e so pode ser usado uma vez.</p>
      <p>Se voce nao solicitou a recuperacao, ignore este e-mail. Sua senha permanece a mesma.</p>
      <p style="margin-top: 28px; font-size: 12px; color: #64748b;">
        Se o botao nao funcionar, copie e cole este endereco no navegador:<br />
        <span style="word-break: break-all;">${resetUrl}</span>
      </p>
    </div>
  `;

  const text = [
    `Ola, ${name}!`,
    "",
    `Recebemos uma solicitacao para redefinir a senha da sua conta no ${BRAND.name}.`,
    "",
    `Acesse o link para criar uma nova senha: ${resetUrl}`,
    "",
    "Este link expira em 30 minutos e so pode ser usado uma vez.",
    "Se voce nao solicitou a recuperacao, ignore este e-mail.",
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(
        `[recuperar-senha] Falha ao enviar e-mail (${response.status}): ${detail}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[recuperar-senha] Erro ao enviar e-mail:", error);
    return false;
  }
}
