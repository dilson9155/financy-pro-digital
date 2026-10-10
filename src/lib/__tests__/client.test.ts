import { describe, expect, it } from "vitest";
import { buildQuery, ApiRequestError } from "@/lib/client";

describe("client - buildQuery", () => {
  it("retorna string vazia para parametros vazios", () => {
    expect(buildQuery({})).toBe("");
    expect(buildQuery({ a: undefined, b: null, c: "" })).toBe("");
  });

  it("serializa valores simples", () => {
    const qs = buildQuery({ page: 2, status: "OPEN", q: "abc def" });
    expect(qs).toBe("?page=2&status=OPEN&q=abc+def");
  });

  it("adiciona arrays repetindo chave e ignora vazios", () => {
    const qs = buildQuery({ status: ["OPEN", "", "PAID"] });
    expect(qs).toBe("?status=OPEN&status=PAID");
  });

  it("serializa booleanos e numeros como string", () => {
    expect(buildQuery({ active: true, total: 0 })).toBe("?active=true&total=0");
  });
});

describe("client - ApiRequestError", () => {
  it("carrega status, code e details", () => {
    const err = new ApiRequestError("msg", 403, "FORBIDDEN", { x: 1 });
    expect(err.message).toBe("msg");
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.details).toEqual({ x: 1 });
    expect(err.name).toBe("ApiRequestError");
  });
});