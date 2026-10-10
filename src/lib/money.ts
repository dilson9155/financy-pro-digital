import { Prisma } from "@prisma/client";

/**
 * Utilitarios de dinheiro.
 * Todos os calculos financeiros usam Prisma.Decimal (Decimal.js) para evitar
 * erros de arredondamento de ponto flutuante.
 */
export type MoneyValue = Prisma.Decimal | string | number;

export function D(value: MoneyValue): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

export const ZERO = (): Prisma.Decimal => new Prisma.Decimal(0);

export function add(...values: MoneyValue[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (acc, v) => acc.plus(D(v)),
    new Prisma.Decimal(0),
  );
}

export function sub(a: MoneyValue, b: MoneyValue): Prisma.Decimal {
  return D(a).minus(D(b));
}

export function mul(a: MoneyValue, b: MoneyValue): Prisma.Decimal {
  return D(a).times(D(b));
}

export function isZero(v: MoneyValue): boolean {
  return D(v).isZero();
}

/** Estritamente positivo (zero NAO conta). */
export function isPositive(v: MoneyValue): boolean {
  return D(v).greaterThan(0);
}

/** Estritamente negativo (zero NAO conta). */
export function isNegative(v: MoneyValue): boolean {
  return D(v).lessThan(0);
}

export function isGreaterThan(a: MoneyValue, b: MoneyValue): boolean {
  return D(a).greaterThan(D(b));
}

export function isGreaterThanOrEqual(a: MoneyValue, b: MoneyValue): boolean {
  return D(a).greaterThanOrEqualTo(D(b));
}

export function isLessThan(a: MoneyValue, b: MoneyValue): boolean {
  return D(a).lessThan(D(b));
}

export function equals(a: MoneyValue, b: MoneyValue): boolean {
  return D(a).equals(D(b));
}

export function compare(a: MoneyValue, b: MoneyValue): number {
  return D(a).comparedTo(D(b));
}

/** Arredonda para 2 casas decimais (meio para cima), padrao monetario BR. */
export function round2(v: MoneyValue): Prisma.Decimal {
  return D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function toNumber(v: MoneyValue): number {
  return D(v).toNumber();
}

export function toFixed2(v: MoneyValue): string {
  return D(v).toFixed(2);
}

/** Converte para centavos inteiros (BigInt) — usado no rateio de parcelas. */
export function toCents(v: MoneyValue): bigint {
  const scaled = D(v).times(100);
  const rounded = scaled.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  return BigInt(rounded.toFixed(0));
}

export function fromCents(cents: bigint | number | string): Prisma.Decimal {
  const n = typeof cents === "bigint" ? cents.toString() : String(cents);
  return new Prisma.Decimal(n).dividedBy(100);
}

/**
 * Divide um valor total em N parcelas iguais, distribuindo os centavos
 * restantes nas primeiras parcelas. A soma das parcelas e EXATAMENTE o total.
 */
export function splitInstallments(
  total: MoneyValue,
  count: number,
): Prisma.Decimal[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Numero de parcelas deve ser um inteiro positivo.");
  }
  const totalCents = toCents(total);
  if (totalCents < 0n) {
    throw new Error("Valor do titulo nao pode ser negativo.");
  }
  const base = totalCents / BigInt(count);
  const remainder = totalCents - base * BigInt(count);
  const parts: Prisma.Decimal[] = [];
  for (let i = 0; i < count; i += 1) {
    const cents = base + (BigInt(i) < remainder ? 1n : 0n);
    parts.push(fromCents(cents));
  }
  return parts;
}

/** Soma de uma lista de Decimal/number/string. */
export function sum(values: MoneyValue[]): Prisma.Decimal {
  return add(...values);
}

/** Garante que o valor seja serializavel em JSON (string com 2 casas). */
export function toJSON(v: MoneyValue): string {
  return toFixed2(v);
}
