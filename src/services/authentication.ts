import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  createSession,
  hashPassword,
  setActiveCompany,
  verifyPassword,
} from "@/lib/auth";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { AppError, conflict, unauthorized } from "@/lib/http";
import type { z } from "zod";
import type { loginSchema, registerSchema } from "@/lib/validation";
import { createCompanyForUser } from "./companies";

type LoginInput = z.infer<typeof loginSchema>;
type RegisterInput = z.infer<typeof registerSchema>;

export interface AuthMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/** Autentica um usuario com protecao a forca bruta (bloqueio temporario). */
export async function login(input: LoginInput, meta: AuthMeta = {}) {
  const env = getEnv();
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Mensagem generica: nao revela existencia de conta.
    throw unauthorized("E-mail ou senha invalidos.");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(
      "Conta temporariamente bloqueada por tentativas invalidas. Tente novamente mais tarde.",
      423,
      "LOCKED",
    );
  }

  const valid = await verifyPassword(input.password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= env.AUTH_MAX_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + env.AUTH_LOCK_MINUTES * 60 * 1000)
          : null,
      },
    });
    await recordAudit(prisma, {
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entity: "User",
      entityId: user.id,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
    throw unauthorized("E-mail ou senha invalidos.");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("Usuario inativo. Procure o administrador.", 403, "INACTIVE");
  }

  // Empresas suspensas/canceladas nao liberam acesso (exceto super-admin).
  if (!user.isSuperAdmin) {
    const activeMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
        company: { status: "ACTIVE" },
      },
      select: { id: true },
    });
    if (!activeMembership) {
      throw new AppError(
        "Acesso suspenso: a empresa esta inativa. Entre em contato com o suporte.",
        403,
        "COMPANY_SUSPENDED",
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await createSession(user.id, meta);
  await recordAudit(prisma, {
    userId: user.id,
    action: AUDIT_ACTIONS.LOGIN,
    entity: "User",
    entityId: user.id,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });

  return user;
}

/** Registra um novo usuario e cria a empresa inicial com papeis de sistema. */
export async function register(input: RegisterInput, meta: AuthMeta = {}) {
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict("E-mail ja cadastrado.");

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: { name: input.name, email, passwordHash },
  });

  const company = await createCompanyForUser(user.id, {
    name: input.companyName,
    document: input.companyDocument ?? null,
  });

  await createSession(user.id, meta);
  await setActiveCompany(company.id);
  await recordAudit(prisma, {
    companyId: company.id,
    userId: user.id,
    action: AUDIT_ACTIONS.CREATE,
    entity: "User",
    entityId: user.id,
    after: { email, company: company.name },
  });

  return { user, company };
}
