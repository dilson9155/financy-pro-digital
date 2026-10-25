import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { hashPassword, hashToken } from "@/lib/auth";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { sendPasswordResetEmail } from "@/lib/email";

const TOKEN_TTL_MINUTES = 30;
const RATE_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_USER = 3;
const MAX_REQUESTS_PER_IP = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GENERIC_RESET_MESSAGE =
  "Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Verifique sua caixa de entrada e o spam.";

export type PasswordResetRequestResult =
  | { ok: true; message: string; devUrl: string | null }
  | { ok: false; error: string };

export type PasswordResetResult = { ok: true } | { ok: false; error: string };

function buildResetUrl(token: string): string {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  return `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

function genericSuccess(
  devUrl: string | null = null,
): PasswordResetRequestResult {
  return { ok: true, message: GENERIC_RESET_MESSAGE, devUrl };
}

/**
 * Solicita a recuperacao de senha.
 * A resposta e sempre generica para nao revelar se o e-mail existe.
 */
export async function requestPasswordReset(
  emailRaw: string,
  requestedIp: string | null,
): Promise<PasswordResetRequestResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Informe um e-mail valido." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return genericSuccess();
  }

  const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000);
  const [recentByUser, recentByIp] = await Promise.all([
    prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: windowStart } },
    }),
    requestedIp
      ? prisma.passwordResetToken.count({
          where: { requestedIp, createdAt: { gte: windowStart } },
        })
      : Promise.resolve(0),
  ]);

  // Mantem a resposta generica tambem quando o limite e atingido.
  if (
    recentByUser >= MAX_REQUESTS_PER_USER ||
    recentByIp >= MAX_REQUESTS_PER_IP
  ) {
    return genericSuccess();
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000);
  const cleanupBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    // Invalida links anteriores ainda nao usados.
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        requestedIp,
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: cleanupBefore } },
    }),
  ]);

  const resetUrl = buildResetUrl(token);
  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
  });

  const showDevLink = getEnv().PASSWORD_RESET_DEV_LINK === "true";
  return genericSuccess(showDevLink ? resetUrl : null);
}

/** Valida a forca minima da senha. Devolve a mensagem de erro ou null. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "A senha deve ter no minimo 8 caracteres.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "A senha deve conter letras e numeros.";
  }
  return null;
}

/**
 * Redefine a senha usando um token de uso unico.
 */
export async function resetPasswordWithToken(
  tokenRaw: string,
  password: string,
  confirmPassword: string,
): Promise<PasswordResetResult> {
  const token = tokenRaw.trim();
  if (token.length < 32) {
    return {
      ok: false,
      error: "Link invalido ou expirado. Solicite uma nova recuperacao.",
    };
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) return { ok: false, error: strengthError };

  if (password !== confirmPassword) {
    return { ok: false, error: "As senhas informadas nao coincidem." };
  }

  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { status: true } },
    },
  });

  if (
    !record ||
    record.usedAt ||
    record.expiresAt <= new Date() ||
    record.user.status !== "ACTIVE"
  ) {
    return {
      ok: false,
      error: "Link invalido ou expirado. Solicite uma nova recuperacao.",
    };
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // Update condicional garante uso unico mesmo com requisicoes concorrentes.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count === 0) {
        throw new Error("TOKEN_ALREADY_USED");
      }

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          // Um reset de senha tambem libera bloqueio por tentativas invalidas.
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Encerra sessoes antigas: quem tinha o cookie perde o acesso.
      await tx.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, id: { not: record.id }, usedAt: null },
        data: { usedAt: now },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TOKEN_ALREADY_USED") {
      return {
        ok: false,
        error: "Link invalido ou expirado. Solicite uma nova recuperacao.",
      };
    }
    throw error;
  }

  try {
    await recordAudit(prisma, {
      userId: record.userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "User",
      entityId: record.userId,
      after: { event: "PASSWORD_RESET" },
    });
  } catch (error) {
    console.error("[recuperar-senha] Falha ao registrar auditoria:", error);
  }

  return { ok: true };
}
