import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { getEnv } from "./env";
import type { Permission } from "./permissions";

export const COMPANY_COOKIE = "financy_company";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface MembershipInfo {
  companyId: string;
  companyName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

export interface AuthContext {
  user: {
    id: string;
    name: string;
    email: string;
    isSuperAdmin: boolean;
  };
  sessionId: string;
  companyId: string | null;
  memberships: MembershipInfo[];
  permissions: Set<string>;
}

/** Cria uma sessao persistida e grava o cookie httpOnly correspondente. */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const env = getEnv();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + env.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000,
  );

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

/** Le o contexto autenticado a partir do cookie, validando a sessao no banco. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const env = getEnv();
  const store = await cookies();
  const token = store.get(env.AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              company: true,
              role: { include: { permissions: true } },
            },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;

  const memberships: MembershipInfo[] = session.user.memberships
    .filter((m) => m.status === "ACTIVE")
    .map((m) => ({
      companyId: m.companyId,
      companyName: m.company.name,
      roleId: m.roleId,
      roleName: m.role.name,
      permissions: m.role.permissions.map((p) => p.permission),
    }));

  const requested = store.get(COMPANY_COOKIE)?.value;
  const activeId =
    requested && memberships.some((m) => m.companyId === requested)
      ? requested
      : memberships[0]?.companyId ?? null;

  const permissions = new Set<string>(
    memberships.find((m) => m.companyId === activeId)?.permissions ?? [],
  );

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      isSuperAdmin: session.user.isSuperAdmin,
    },
    sessionId: session.id,
    companyId: activeId,
    memberships,
    permissions,
  };
}

/** Verifica se o contexto possui a permissao informada. */
export function can(ctx: AuthContext, permission: Permission | string): boolean {
  if (ctx.user.isSuperAdmin) return true;
  return ctx.permissions.has(permission);
}

/** Garante autenticacao em paginas (redireciona para /login). */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Garante uma empresa ativa; redireciona para selecao se necessario. */
export async function requireCompany(): Promise<AuthContext & { companyId: string }> {
  const ctx = await requireAuth();
  if (!ctx.companyId) redirect("/selecionar-empresa");
  return ctx as AuthContext & { companyId: string };
}

/** Garante permissao em paginas; redireciona se negado. */
export async function requirePermission(
  permission: Permission | string,
): Promise<AuthContext & { companyId: string }> {
  const ctx = await requireCompany();
  if (!can(ctx, permission)) redirect("/sem-permissao");
  return ctx;
}

/** Encerra a sessao atual. */
export async function destroySession(): Promise<void> {
  const env = getEnv();
  const store = await cookies();
  const token = store.get(env.AUTH_COOKIE_NAME)?.value;
  if (token) {
    await prisma.userSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(env.AUTH_COOKIE_NAME);
}

/** Troca a empresa ativa do usuario. */
export async function setActiveCompany(companyId: string): Promise<void> {
  const store = await cookies();
  store.set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
