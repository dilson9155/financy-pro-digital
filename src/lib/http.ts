import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Erro de aplicacao com status HTTP e mensagem segura para o cliente. */
export class AppError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    status = 400,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (m: string, d?: unknown) =>
  new AppError(m, 400, "BAD_REQUEST", d);
export const unauthorized = (m = "Nao autenticado") =>
  new AppError(m, 401, "UNAUTHORIZED");
export const forbidden = (m = "Acesso negado") =>
  new AppError(m, 403, "FORBIDDEN");
export const notFound = (m = "Registro nao encontrado") =>
  new AppError(m, 404, "NOT_FOUND");
export const conflict = (m: string, d?: unknown) =>
  new AppError(m, 409, "CONFLICT", d);
export const unprocessable = (m: string, d?: unknown) =>
  new AppError(m, 422, "UNPROCESSABLE", d);

/** Resposta de sucesso padronizada. */
export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/** Resposta de erro padronizada. */
export function jsonError(
  message: string,
  status = 400,
  code?: string,
  details?: unknown,
) {
  return NextResponse.json(
    { ok: false, error: { message, code, details } },
    { status },
  );
}

/** Converte qualquer erro em resposta HTTP, sem vazar stack em producao. */
export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return jsonError(error.message, error.status, error.code, error.details);
  }
  if (error instanceof ZodError) {
    return jsonError(
      "Dados invalidos.",
      422,
      "VALIDATION_ERROR",
      error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  // Erros conhecidos do Prisma.
  const code = (error as { code?: string })?.code;
  if (code === "P2002") {
    return jsonError("Registro duplicado.", 409, "DUPLICATE");
  }
  if (code === "P2003") {
    return jsonError("Registro relacionado inexistente.", 409, "FK_CONSTRAINT");
  }
  if (code === "P2025") {
    return jsonError("Registro nao encontrado.", 404, "NOT_FOUND");
  }
  console.error("[unhandled]", error);
  return jsonError("Erro interno do servidor.", 500, "INTERNAL");
}

/** Envolve um handler de rota com tratamento padronizado de erros. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
