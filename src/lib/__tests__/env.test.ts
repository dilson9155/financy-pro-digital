import { describe, it, expect } from "vitest";
import { normalizeDatabaseUrl } from "@/lib/env";

const URL_OK =
  "postgresql://neondb_owner:secret@ep-x-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require";

describe("normalizeDatabaseUrl", () => {
  it("mantem uma URL valida inalterada", () => {
    expect(normalizeDatabaseUrl(URL_OK)).toBe(URL_OK);
  });

  it("remove aspas ao redor", () => {
    expect(normalizeDatabaseUrl(`"${URL_OK}"`)).toBe(URL_OK);
    expect(normalizeDatabaseUrl(`'${URL_OK}'`)).toBe(URL_OK);
  });

  it("extrai a URL de um valor com prefixo", () => {
    expect(normalizeDatabaseUrl(`DATABASE_URL="${URL_OK}"`)).toBe(URL_OK);
  });

  it("extrai a URL quando o arquivo .env inteiro foi colado", () => {
    const blob = [
      `DATABASE_URL="${URL_OK}"`,
      'DIRECT_URL="postgresql://user:pw@host/db"',
      'AUTH_SECRET="abcdefghijklmnop"',
    ].join("\n");
    expect(normalizeDatabaseUrl(blob)).toBe(URL_OK);
  });

  it("devolve string vazia para valor ausente", () => {
    expect(normalizeDatabaseUrl(undefined)).toBe("");
    expect(normalizeDatabaseUrl("")).toBe("");
  });

  it("devolve o valor (sem espacos) quando nao ha URL", () => {
    expect(normalizeDatabaseUrl("  qualidade  ")).toBe("qualidade");
  });
});
