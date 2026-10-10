/**
 * Utilitarios para filtros dinamicos e combinaveis a partir de query strings.
 * Cada funcao ignora valores vazios, permitindo que os filtros sejam aplicados
 * de forma independente e acumulativa.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function single(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function str(sp: RawSearchParams, key: string): string | undefined {
  const v = single(sp[key]);
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function strList(sp: RawSearchParams, key: string): string[] {
  const v = sp[key];
  if (v === undefined) return [];
  const arr = Array.isArray(v) ? v : v.split(",");
  return arr.map((s) => s.trim()).filter(Boolean);
}

export function num(sp: RawSearchParams, key: string): number | undefined {
  const v = str(sp, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function bool(sp: RawSearchParams, key: string): boolean | undefined {
  const v = str(sp, key)?.toLowerCase();
  if (v === undefined) return undefined;
  if (["true", "1", "yes", "sim"].includes(v)) return true;
  if (["false", "0", "no", "nao"].includes(v)) return false;
  return undefined;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function date(sp: RawSearchParams, key: string): Date | undefined {
  const v = str(sp, key);
  if (!v) return undefined;
  // Datas puras (YYYY-MM-DD) sao interpretadas como meia-noite LOCAL,
  // evitando que o deslocamento de fuso desloque o dia.
  const m = DATE_ONLY.exec(v);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function enumValue<T extends string>(
  sp: RawSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const v = str(sp, key) as T | undefined;
  if (!v) return undefined;
  return allowed.includes(v) ? v : undefined;
}

export function enumList<T extends string>(
  sp: RawSearchParams,
  key: string,
  allowed: readonly T[],
): T[] {
  return strList(sp, key).filter((v): v is T =>
    (allowed as readonly string[]).includes(v),
  );
}

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function pagination(
  sp: RawSearchParams,
  defaults: { pageSize?: number; maxPageSize?: number } = {},
): Pagination {
  const pageSizeDefault = defaults.pageSize ?? 20;
  const maxPageSize = defaults.maxPageSize ?? 100;
  const rawPage = num(sp, "page") ?? 1;
  const rawSize = num(sp, "pageSize") ?? pageSizeDefault;
  const page = Math.max(1, Math.floor(rawPage));
  const pageSize = Math.min(maxPageSize, Math.max(1, Math.floor(rawSize)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export interface SortSpec {
  field: string;
  direction: "asc" | "desc";
}

export function sort(
  sp: RawSearchParams,
  allowed: readonly string[],
  fallback: SortSpec = { field: "createdAt", direction: "desc" },
): SortSpec {
  const field = str(sp, "sortBy");
  const dir = str(sp, "sortDir")?.toLowerCase();
  const safeField = field && allowed.includes(field) ? field : fallback.field;
  const direction: "asc" | "desc" = dir === "asc" ? "asc" : dir === "desc" ? "desc" : fallback.direction;
  return { field: safeField, direction };
}

/** Datas de inicio/fim do dia (inclusive) para ranges. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Range de datas a partir de from/to (aplicando inicio/fim do dia). */
export function dateRange(
  sp: RawSearchParams,
  fromKey = "from",
  toKey = "to",
): { gte?: Date; lte?: Date } | undefined {
  const from = date(sp, fromKey);
  const to = date(sp, toKey);
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = startOfDay(from);
  if (to) range.lte = endOfDay(to);
  return range;
}
