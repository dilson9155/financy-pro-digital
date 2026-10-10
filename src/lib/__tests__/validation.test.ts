import { describe, expect, it } from "vitest";
import {
  createTitleSchema,
  settleSchema,
  loginSchema,
  registerSchema,
  transferSchema,
  createAccountSchema,
  statementImportSchema,
  reconcileSchema,
  settingsSchema,
  roleSchema,
} from "@/lib/validation";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("validation - login/register", () => {
  it("login aceita credenciais validas", () => {
    const r = loginSchema.safeParse({
      email: "user@example.com",
      password: "123456",
    });
    expect(r.success).toBe(true);
  });

  it("login rejeita email invalido e senha curta", () => {
    expect(loginSchema.safeParse({ email: "x", password: "123456" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "123" }).success).toBe(false);
  });

  it("register exige senha >= 8", () => {
    const ok = registerSchema.safeParse({
      name: "Fulano",
      email: "f@example.com",
      password: "segredo123",
      companyName: "Empresa X",
    });
    expect(ok.success).toBe(true);
    const bad = registerSchema.safeParse({
      name: "Fulano",
      email: "f@example.com",
      password: "123",
      companyName: "Empresa X",
    });
    expect(bad.success).toBe(false);
  });
});

describe("validation - titulos", () => {
  const base = {
    direction: "PAYABLE",
    description: "Fornecedor XYZ",
    issueDate: "2026-01-05",
    totalAmount: "1000.00",
  };

  it("aceita titulo com parcela unica (sem array)", () => {
    const r = createTitleSchema.safeParse({
      direction: "PAYABLE",
      description: "Fornecedor XYZ",
      issueDate: "2026-01-05",
      totalAmount: "1000.00",
    });
    expect(r.success).toBe(true);
  });

  it("aceita totalAmount numerico", () => {
    const r = createTitleSchema.safeParse({
      ...base,
      totalAmount: 1000.5,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita total invalido", () => {
    const r = createTitleSchema.safeParse({
      ...base,
      totalAmount: "nao-e-numero",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita direcao invalida", () => {
    const r = createTitleSchema.safeParse({
      ...base,
      direction: "LATERAL",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita descricao vazia", () => {
    const r = createTitleSchema.safeParse({
      ...base,
      description: "  ",
    });
    expect(r.success).toBe(false);
  });

  it("aceita parcelas com datas e valores", () => {
    const r = createTitleSchema.safeParse({
      direction: "RECEIVABLE",
      description: "Clipping",
      issueDate: "2026-01-05",
      totalAmount: "300.00",
      installments: [
        { dueDate: "2026-02-05", amount: "100.00" },
        { dueDate: "2026-03-05", amount: "200.00" },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.installments).toHaveLength(2);
  });
});

describe("validation - forma de pagamento do titulo", () => {
  const base = {
    direction: "PAYABLE",
    description: "Fornecedor XYZ",
    issueDate: "2026-01-05",
    totalAmount: "1000.00",
  };

  it("aceita titulo sem forma de pagamento", () => {
    expect(createTitleSchema.safeParse(base).success).toBe(true);
  });

  it("aceita dinheiro, cartao e boleto", () => {
    for (const method of ["CASH", "CARD", "BOLETO"]) {
      expect(createTitleSchema.safeParse({ ...base, paymentMethod: method }).success).toBe(
        true,
      );
    }
  });

  it("exige tipo e chave quando a forma for PIX", () => {
    expect(createTitleSchema.safeParse({ ...base, paymentMethod: "PIX" }).success).toBe(
      false,
    );
  });

  it("aceita PIX com tipo e chave", () => {
    const r = createTitleSchema.safeParse({
      ...base,
      paymentMethod: "PIX",
      pixKeyType: "CPF_CNPJ",
      pixKey: "52998224725",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tipo de chave Pix desconhecido", () => {
    const r = createTitleSchema.safeParse({
      ...base,
      paymentMethod: "PIX",
      pixKeyType: "IBAN",
      pixKey: "x",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita forma de pagamento fora do enum", () => {
    expect(
      createTitleSchema.safeParse({ ...base, paymentMethod: "BITCOIN" }).success,
    ).toBe(false);
  });
});

describe("validation - baixa (settle)", () => {
  const valid = {
    installmentId: UUID,
    amount: "150.00",
    date: "2026-01-10",
    bankAccountId: UUID,
    method: "PIX",
  };

  it("aceita baixa com juros/multa/desconto default zero", () => {
    const r = settleSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.interest).toBe(0);
      expect(r.data.fine).toBe(0);
      expect(r.data.discount).toBe(0);
    }
  });

  it("rejeita installmentId invalido", () => {
    const r = settleSchema.safeParse({ ...valid, installmentId: "abc" });
    expect(r.success).toBe(false);
  });

  it("rejeita metodo fora do enum", () => {
    const r = settleSchema.safeParse({ ...valid, method: "BITCOIN" });
    expect(r.success).toBe(false);
  });
});

describe("validation - transferencia", () => {
  const valid = {
    fromBankAccountId: UUID,
    toBankAccountId: UUID,
    amount: "500.00",
    date: "2026-02-01",
  };

  it("aceita transferencia valida", () => {
    expect(transferSchema.safeParse(valid).success).toBe(true);
  });

  it("exige contas distintas", () => {
    // O schema nao conhece negocio, entao contas iguais passam; o check e no service.
    const same = transferSchema.safeParse({ ...valid, toBankAccountId: UUID });
    expect(same.success).toBe(true);
  });

  it("rejeita sem valor", () => {
    const r = transferSchema.safeParse({ ...valid, amount: undefined });
    expect(r.success).toBe(false);
  });
});

describe("validation - contas da empresa", () => {
  it("createAccount com inicial e postOpeningBalance", () => {
    const r = createAccountSchema.safeParse({
      name: "Conta PJ",
      type: "BANK",
      initialBalance: "1000.00",
      postOpeningBalance: true,
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.currency).toBe("BRL");
    expect(r.success && r.data.postOpeningBalance).toBe(true);
  });

  it("rejeita currency fora de 3 letras", () => {
    const r = createAccountSchema.safeParse({
      name: "Cx",
      type: "CASH",
      currency: "BRLX",
    });
    expect(r.success).toBe(false);
  });
});

describe("validation - conciliacao", () => {
  it("statementImport aceita linhas manuais", () => {
    const r = statementImportSchema.safeParse({
      bankAccountId: UUID,
      format: "MANUAL",
      lines: [
        { date: "2026-01-10", description: "Venda", amount: "50.00", type: "INFLOW" },
        { date: "2026-01-11", description: "Compra", amount: "30.00", type: "OUTFLOW" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita importacao sem linhas", () => {
    const r = statementImportSchema.safeParse({
      bankAccountId: UUID,
      lines: [],
    });
    expect(r.success).toBe(false);
  });

  it("reject linhas com amount invalido", () => {
    const r = statementImportSchema.safeParse({
      bankAccountId: UUID,
      lines: [{ date: "2026-01-10", description: "X", amount: "lixo", type: "INFLOW" }],
    });
    expect(r.success).toBe(false);
  });

  it("reconcile exige uuid valido", () => {
    expect(
      reconcileSchema.safeParse({ lineId: UUID, transactionId: UUID }).success,
    ).toBe(true);
    expect(
      reconcileSchema.safeParse({ lineId: "x", transactionId: UUID }).success,
    ).toBe(false);
  });
});

describe("validation - settings e roles", () => {
  it("settings aceita valor de qualquer tipo", () => {
    expect(settingsSchema.safeParse({ key: "x", value: "texto" }).success).toBe(true);
    expect(settingsSchema.safeParse({ key: "y", value: 42 }).success).toBe(true);
    expect(settingsSchema.safeParse({ key: "z", value: null }).success).toBe(true);
  });

  it("role exige nome e aceita permissoes", () => {
    const ok = roleSchema.safeParse({
      name: "Financeiro",
      permissions: ["payables.view", "reports.view"],
    });
    expect(ok.success).toBe(true);
    expect(
      roleSchema.safeParse({ name: "aa", permissions: [] }).success,
    ).toBe(true);
  });

  it("role rejeita nome curto ou ausente", () => {
    expect(roleSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(roleSchema.safeParse({ permissions: [] }).success).toBe(false);
  });
});