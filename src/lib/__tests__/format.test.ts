import { describe, expect, it } from "vitest";
import { formatPixKey, maskCpfCnpj, maskPhone, onlyDigits } from "@/lib/format";

describe("format - mascaras de chave Pix", () => {
  it("remove caracteres nao numericos", () => {
    expect(onlyDigits("(11) 98765-4321")).toBe("11987654321");
  });

  it("mascara CPF", () => {
    expect(maskCpfCnpj("52998224725")).toBe("529.982.247-25");
  });

  it("mascara CNPJ", () => {
    expect(maskCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("mascara telefone fixo e celular", () => {
    expect(maskPhone("1132654321")).toBe("(11) 3265-4321");
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("formata a chave conforme o tipo", () => {
    expect(formatPixKey("CPF_CNPJ", "52998224725")).toBe("529.982.247-25");
    expect(formatPixKey("PHONE", "11987654321")).toBe("(11) 98765-4321");
    expect(formatPixKey("EMAIL", "  A@B.COM ")).toBe("a@b.com");
    expect(formatPixKey("RANDOM", "abc-123")).toBe("abc-123");
    expect(formatPixKey("RANDOM", "")).toBe("");
  });
});
