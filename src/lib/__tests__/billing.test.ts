import { describe, expect, it } from "vitest";
import {
  billingSubject,
  buildBillingMessage,
  mailtoLink,
  rawPixKey,
  whatsappLink,
} from "@/lib/billing";
import { formatCurrency } from "@/lib/format";

describe("billing - chave Pix crua", () => {
  it("remove a mascara de CPF/CNPJ e telefone", () => {
    expect(rawPixKey("CPF_CNPJ", "529.982.247-25")).toBe("52998224725");
    expect(rawPixKey("PHONE", "(11) 98765-4321")).toBe("11987654321");
  });

  it("mantem e-mail (sem espacos) e chave aleatoria", () => {
    expect(rawPixKey("EMAIL", "  a@b.com ")).toBe("a@b.com");
    expect(rawPixKey("RANDOM", " abc-123 ")).toBe("abc-123");
  });

  it("devolve vazio quando nao ha chave", () => {
    expect(rawPixKey("EMAIL", null)).toBe("");
    expect(rawPixKey(null, undefined)).toBe("");
  });
});

describe("billing - links de envio", () => {
  it("monta link do WhatsApp com DDI 55", () => {
    expect(whatsappLink("(11) 98765-4321", "oi")).toBe(
      "https://wa.me/5511987654321?text=oi",
    );
  });

  it("nao altera numero que ja tem DDI", () => {
    expect(whatsappLink("5511987654321", "oi")).toContain(
      "https://wa.me/5511987654321",
    );
  });

  it("devolve null sem telefone", () => {
    expect(whatsappLink(null, "oi")).toBeNull();
    expect(whatsappLink("", "oi")).toBeNull();
  });

  it("monta link mailto com assunto e corpo", () => {
    const link = mailtoLink("a@b.com", "Assunto", "Corpo do e-mail");
    expect(link).toBe(
      "mailto:a@b.com?subject=Assunto&body=Corpo%20do%20e-mail",
    );
    expect(mailtoLink(null, "x", "y")).toBeNull();
  });

  it("assunto de cobranca inclui a descricao", () => {
    expect(billingSubject("Mensalidade")).toContain("Mensalidade");
  });
});

describe("billing - mensagem de cobranca", () => {
  const settings = {
    pixKey: "financeiro@empresa.com",
    pixKeyType: "EMAIL",
    pixHolder: "Financy Pro Digital LTDA",
    bankName: "Nubank",
    paymentInstructions: "Envie o comprovante apos pagar.",
    contactEmail: "cobranca@financy.com",
    contactPhone: "(11) 98765-4321",
  };

  it("inclui valor, vencimento, Pix e instrucoes", () => {
    const msg = buildBillingMessage({
      companyName: "Empresa Teste",
      invoice: {
        description: "Mensalidade — Outubro",
        amount: "99.90",
        dueDate: "2026-10-15",
      },
      settings,
    });

    expect(msg).toContain("Ola, Empresa Teste!");
    expect(msg).toContain("Mensalidade — Outubro");
    expect(msg).toContain(`Valor: ${formatCurrency("99.90")}`);
    expect(msg).toContain("Vencimento: 15/10/2026");
    expect(msg).toContain("financeiro@empresa.com");
    expect(msg).toContain("Envie o comprovante apos pagar.");
    expect(msg).toContain("Equipe Financy Pro Digital");
  });

  it("usa a saudacao informada quando houver contato", () => {
    const msg = buildBillingMessage({
      companyName: "Empresa Teste",
      greetingName: "Dilson",
      invoice: { description: "Mensalidade", amount: "10", dueDate: "2026-10-15" },
      settings,
    });
    expect(msg).toContain("Ola, Dilson!");
  });

  it("inclui o link do boleto quando informado", () => {
    const msg = buildBillingMessage({
      companyName: "Empresa Teste",
      invoice: {
        description: "Mensalidade",
        amount: "10",
        dueDate: "2026-10-15",
        boletoUrl: "https://banco.com/boleto/123",
      },
      settings,
    });
    expect(msg).toContain("https://banco.com/boleto/123");
  });

  it("usa a chave Pix da fatura quando presente (sobrepoe a da plataforma)", () => {
    const msg = buildBillingMessage({
      companyName: "Empresa Teste",
      invoice: {
        description: "Mensalidade",
        amount: "10",
        dueDate: "2026-10-15",
        pixKey: "11999998888",
        pixKeyType: "PHONE",
      },
      settings,
    });
    expect(msg).toContain("(11) 99999-8888");
  });
});
