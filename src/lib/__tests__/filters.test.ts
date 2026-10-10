import { describe, expect, it } from "vitest";
import {
  single,
  str,
  strList,
  num,
  bool,
  date,
  enumValue,
  enumList,
  pagination,
  sort,
  dateRange,
  type RawSearchParams,
} from "@/lib/filters";

const ALLOWED_STATUS = ["OPEN", "PAID", "CANCELED"] as const;

describe("filters - parse de query strings", () => {
  it("single", () => {
    expect(single("x")).toBe("x");
    expect(single(["a", "b"])).toBe("a");
    expect(single(undefined)).toBeUndefined();
  });

  it("str ignora vazio e espacos", () => {
    expect(str({ q: "  abc  " }, "q")).toBe("abc");
    expect(str({ q: "   " }, "q")).toBeUndefined();
    expect(str({}, "q")).toBeUndefined();
  });

  it("strList aceita array ou CSV", () => {
    expect(strList({ s: ["a", " b"] }, "s")).toEqual(["a", "b"]);
    expect(strList({ s: "a,b, c," }, "s")).toEqual(["a", "b", "c"]);
    expect(strList({}, "s")).toEqual([]);
  });

  it("num", () => {
    expect(num({ page: "3" }, "page")).toBe(3);
    expect(num({ page: "abc" }, "page")).toBeUndefined();
    expect(num({}, "page")).toBeUndefined();
  });

  it("bool", () => {
    expect(bool({ active: "true" }, "active")).toBe(true);
    expect(bool({ active: "1" }, "active")).toBe(true);
    expect(bool({ active: "sim" }, "active")).toBe(true);
    expect(bool({ active: "no" }, "active")).toBe(false);
    expect(bool({ active: "0" }, "active")).toBe(false);
    expect(bool({ active: "talvez" }, "active")).toBeUndefined();
    expect(bool({}, "active")).toBeUndefined();
  });

  it("date", () => {
    const d = date({ from: "2026-01-15" }, "from");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(0);
    expect(d?.getDate()).toBe(15);
    expect(d?.getHours()).toBe(0);
    expect(date({ from: "invalida" }, "from")).toBeUndefined();
    expect(date({}, "from")).toBeUndefined();
  });

  it("enumValue valida contra whitelist", () => {
    expect(enumValue({ status: "PAID" }, "status", ALLOWED_STATUS)).toBe("PAID");
    expect(enumValue({ status: "XXX" }, "status", ALLOWED_STATUS)).toBeUndefined();
    expect(enumValue({}, "status", ALLOWED_STATUS)).toBeUndefined();
  });

  it("enumList filtra e mantem ordem", () => {
    expect(enumList({ s: "OPEN,XXX,PAID" }, "s", ALLOWED_STATUS)).toEqual([
      "OPEN",
      "PAID",
    ]);
    expect(enumList({}, "s", ALLOWED_STATUS)).toEqual([]);
  });
});

describe("filters - pagination", () => {
  it("defaults", () => {
    expect(pagination({})).toEqual({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
    });
  });

  it("page/pageSize custom", () => {
    expect(pagination({ page: "2", pageSize: "10" })).toEqual({
      page: 2,
      pageSize: 10,
      skip: 10,
      take: 10,
    });
  });

  it("clampa valores invalidos", () => {
    expect(pagination({ page: "0", pageSize: "-5" }).page).toBe(1);
    expect(pagination({ page: "abc", pageSize: "9999" }).pageSize).toBe(100);
    expect(pagination({}, { pageSize: 50, maxPageSize: 25 }).pageSize).toBe(25);
  });
});

describe("filters - sort", () => {
  const allowed = ["name", "createdAt"] as const;

  it("fallback quando ausente", () => {
    expect(sort({}, allowed)).toEqual({ field: "createdAt", direction: "desc" });
  });

  it("campo permitido + direcao", () => {
    expect(sort({ sortBy: "name", sortDir: "asc" }, allowed)).toEqual({
      field: "name",
      direction: "asc",
    });
  });

  it("rejeita campo fora da whitelist", () => {
    expect(sort({ sortBy: "id;drop", sortDir: "asc" }, allowed).field).toBe(
      "createdAt",
    );
    expect(sort({ sortBy: "name", sortDir: "sideways" }, allowed).direction).toBe(
      "desc",
    );
  });
});

describe("filters - dateRange", () => {
  /** Extrai a data no FUSO LOCAL para nao depender do fuso da maquina. */
  function localDay(d?: Date): string | null {
    if (!d) return null;
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  it("undefined quando ausente", () => {
    expect(dateRange({})).toBeUndefined();
  });

  it("from aplica inicio do dia", () => {
    const r = dateRange({ from: "2026-01-10" });
    expect(localDay(r?.gte)).toBe("2026-01-10");
    expect(r?.gte?.getHours()).toBe(0);
    expect(r?.lte).toBeUndefined();
  });

  it("to aplica fim do dia", () => {
    const r = dateRange({ to: "2026-01-20" });
    expect(localDay(r?.lte)).toBe("2026-01-20");
    expect(r?.lte?.getHours()).toBe(23);
    expect(r?.gte).toBeUndefined();
  });

  it("from + to", () => {
    const r = dateRange({ from: "2026-01-01", to: "2026-01-31" });
    expect(localDay(r?.gte)).toBe("2026-01-01");
    expect(localDay(r?.lte)).toBe("2026-01-31");
    expect(r?.gte!.getTime()).toBeLessThan(r!.lte!.getTime());
  });

  it("aceita datetime completo (ISO)", () => {
    const r = dateRange({ from: "2026-01-10T12:00:00.000Z" });
    expect(r?.gte).toBeDefined();
  });
});

describe("filters - tipos de entrada", () => {
  it("aceita array como valor de str", () => {
    const sp: RawSearchParams = { q: ["a", "b"] };
    expect(str(sp, "q")).toBe("a");
  });
});