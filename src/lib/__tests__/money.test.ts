import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  D,
  ZERO,
  add,
  sub,
  mul,
  isZero,
  isPositive,
  isNegative,
  isGreaterThan,
  equals,
  compare,
  round2,
  toNumber,
  toFixed2,
  toCents,
  fromCents,
  splitInstallments,
  sum,
  toJSON,
} from "@/lib/money";

describe("money - construcao e conversao", () => {
  it("D aceita Decimal, string e number", () => {
    expect(D("10.50").equals(10.5)).toBe(true);
    expect(D(7).equals("7.00")).toBe(true);
    expect(D(new Prisma.Decimal(3)).equals(3)).toBe(true);
  });

  it("toNumber/toFixed2", () => {
    expect(toNumber("123.456")).toBeCloseTo(123.456, 5);
    expect(toFixed2("1.2")).toBe("1.20");
  });

  it("toCents/fromCents", () => {
    expect(toCents("10.50")).toBe(1050n);
    expect(toCents("0.1")).toBe(10n);
    expect(fromCents(1050n).toFixed(2)).toBe("10.50");
    expect(fromCents("100").toFixed(2)).toBe("1.00");
  });

  it("round2 arredonda meio para cima", () => {
    expect(round2("10.005").toFixed(2)).toBe("10.01");
    expect(round2("10.004").toFixed(2)).toBe("10.00");
    expect(round2("1.999").toFixed(2)).toBe("2.00");
  });

  it("toJSON serializa com 2 casas", () => {
    expect(toJSON("99.999")).toBe("100.00");
  });
});

describe("money - aritmetica", () => {
  it("add somar variados", () => {
    expect(add("1.10", 2.2, "0.70").toFixed(2)).toBe("4.00");
    expect(add().toFixed(2)).toBe("0.00");
  });

  it("sub/mul", () => {
    expect(sub("5.00", "1.50").toFixed(2)).toBe("3.50");
    expect(mul("1.50", 3).toFixed(2)).toBe("4.50");
  });

  it("sum", () => {
    expect(sum(["1", "2", "3.5"]).toFixed(2)).toBe("6.50");
  });

  it("ZERO", () => {
    expect(ZERO().isZero()).toBe(true);
  });
});

describe("money - comparacoes", () => {
  it("isZero/isPositive/isNegative", () => {
    expect(isZero("0.00")).toBe(true);
    expect(isZero(0.001)).toBe(false);
    expect(isPositive("0.01")).toBe(true);
    expect(isPositive("0")).toBe(false);
    expect(isNegative("-0.01")).toBe(true);
    expect(isNegative("0")).toBe(false);
  });

  it("isGreaterThan/equals/compare", () => {
    expect(isGreaterThan("2", "1.99")).toBe(true);
    expect(equals("2.00", 2)).toBe(true);
    expect(equals("2.01", 2)).toBe(false);
    expect(compare("2", "1")).toBe(1);
    expect(compare("1", "2")).toBe(-1);
    expect(compare("2", "2")).toBe(0);
  });
});

describe("money - splitInstallments", () => {
  it("divide valor sem resto", () => {
    const parts = splitInstallments("100.00", 4);
    expect(parts.map((p) => p.toFixed(2))).toEqual([
      "25.00",
      "25.00",
      "25.00",
      "25.00",
    ]);
    expect(sum(parts).equals("100.00")).toBe(true);
  });

  it("distribui centavos restantes nas primeiras parcelas", () => {
    const parts = splitInstallments("100.01", 3);
    expect(parts.map((p) => p.toFixed(2))).toEqual([
      "33.34",
      "33.34",
      "33.33",
    ]);
    expect(sum(parts).equals("100.01")).toBe(true);
  });

  it("1 parcela = total", () => {
    const parts = splitInstallments("1234.56", 1);
    expect(parts).toHaveLength(1);
    expect(parts[0].toFixed(2)).toBe("1234.56");
  });

  it("12 parcelas mantem soma exata", () => {
    const parts = splitInstallments("1000.00", 12);
    expect(parts).toHaveLength(12);
    expect(sum(parts).equals("1000.00")).toBe(true);
    const fmt = parts.map((p) => p.toFixed(2));
    expect(new Set(fmt).size).toBeLessThanOrEqual(2);
  });

  it("lanca erro para contagem invalida", () => {
    expect(() => splitInstallments("100", 0)).toThrow();
    expect(() => splitInstallments("100", -3)).toThrow();
    expect(() => splitInstallments("100", 2.5)).toThrow();
  });

  it("lanca erro para valor negativo", () => {
    expect(() => splitInstallments("-1", 2)).toThrow();
  });
});