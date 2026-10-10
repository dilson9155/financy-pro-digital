import type { NextRequest } from "next/server";
import { AppError } from "./http";
import { can, getAuthContext, type AuthContext } from "./auth";
import type { Permission } from "./permissions";
import type { RawSearchParams } from "./filters";

/** Converte os search params preservando chaves repetidas (filtros multiplos). */
export function searchParams(req: NextRequest): RawSearchParams {
  const out: RawSearchParams = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  });
  return out;
}


/** Metadados do cliente para auditoria/login. */
export function clientMeta(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  return { ip, userAgent: req.headers.get("user-agent") };
}

export type CompanyAuthContext = AuthContext & { companyId: string };

/**
 * Autentica a requisicao e (opcionalmente) valida a permissao exigida.
 * Garante que exista uma empresa ativa.
 */
export async function requireApiAuth(
  permission?: Permission | string,
): Promise<CompanyAuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AppError("Nao autenticado.", 401, "UNAUTHORIZED");
  if (permission && !can(ctx, permission)) {
    throw new AppError("Acesso negado.", 403, "FORBIDDEN");
  }
  if (!ctx.companyId) {
    throw new AppError("Selecione uma empresa.", 400, "NO_COMPANY");
  }
  return ctx as CompanyAuthContext;
}
