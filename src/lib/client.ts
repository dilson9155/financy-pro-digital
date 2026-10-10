"use client";

/** Cliente HTTP para as rotas /api. Normaliza { ok, data, error }. */
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  code?: string;
  details?: unknown;
  status: number;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* resposta sem corpo */
  }
  const data = payload as
    | { ok: boolean; data?: T; error?: ApiError }
    | null;

  if (!res.ok || !data?.ok) {
    throw new ApiRequestError(
      data?.error?.message ?? `Erro ${res.status}`,
      res.status,
      data?.error?.code,
      data?.error?.details,
    );
  }
  return data.data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};

/** Monta uma query string ignorando valores vazios. */
export function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) if (v !== "" && v != null) sp.append(key, String(v));
    } else {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
