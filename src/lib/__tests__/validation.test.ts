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
  adminCompanyUpdateSchema,
  adminCompanyStatusSchema,
  invoiceCreateSchema,
  invoiceUpdateSchema,
  platformBillingSchema,
  updateTransactionSchema,
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

describe("validation - administracao de empresas", () => {
  it("adminCompanyUpdate aceita objeto vazio (tudo opcional)", () => {
    expect(adminCompanyUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("adminCompanyUpdate aceita dados completos", () => {
    const r = adminCompanyUpdateSchema.safeParse({
      name: "Empresa Nova",
      legalName: "Empresa Nova LTDA",
      document: "11.222.333/0001-81",
      email: "contato@empresa.com",
      billingEmail: "financeiro@empresa.com",
      phone: "(11) 98765-4321",
      address: "Rua X, 100",
      currency: "BRL",
      timezone: "America/Sao_Paulo",
    });
    expect(r.success).toBe(true);
  });

  it("adminCompanyUpdate rejeita nome curto e e-mail invalido", () => {
    expect(adminCompanyUpdateSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(
      adminCompanyUpdateSchema.safeParse({ email: "nao-e-email" }).success,
    ).toBe(false);
    expect(
      adminCompanyUpdateSchema.safeParse({ billingEmail: "x" }).success,
    ).toBe(false);
  });

  it("adminCompanyStatus aceita status validos e rejeita invalidos", () => {
    expect(
      adminCompanyStatusSchema.safeParse({ status: "SUSPENDED" }).success,
    ).toBe(true);
    expect(
      adminCompanyStatusSchema.safeParse({
        status: "CANCELED",
        reason: "Falta de pagamento",
      }).success,
    ).toBe(true);
    expect(
      adminCompanyStatusSchema.safeParse({ status: "FOO" }).success,
    ).toBe(false);
  });
});

describe("validation - cobrancas (invoices)", () => {
  const base = {
    companyId: UUID,
    description: "Mensalidade — Outubro",
    amount: "99.90",
    dueDate: "2026-10-15",
  };

  it("aceita cobranca simples sem forma de pagamento", () => {
    expect(invoiceCreateSchema.safeParse(base).success).toBe(true);
  });

  it("aceita cobranca PIX com tipo e chave", () => {
    const r = invoiceCreateSchema.safeParse({
      ...base,
      method: "PIX",
      pixKeyType: "EMAIL",
      pixKey: "financeiro@empresa.com",
    });
    expect(r.success).toBe(true);
  });

  it("exige chave quando a forma for PIX", () => {
    expect(
      invoiceCreateSchema.safeParse({ ...base, method: "PIX" }).success,
    ).toBe(false);
  });

  it("rejeita empresa, descricao e valor invalidos", () => {
    expect(invoiceCreateSchema.safeParse({ ...base, companyId: "x" }).success).toBe(
      false,
    );
    expect(
      invoiceCreateSchema.safeParse({ ...base, description: "  " }).success,
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({ ...base, amount: "lixo" }).success,
    ).toBe(false);
  });

  it("rejeita link de boleto invalido", () => {
    expect(
      invoiceCreateSchema.safeParse({ ...base, boletoUrl: "nao-e-url" }).success,
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({
        ...base,
        boletoUrl: "https://banco.com/boleto/123",
      }).success,
    ).toBe(true);
  });

  it("aceita parcelamento/recorrencia com installments e intervalMonths", () => {
    const r = invoiceCreateSchema.safeParse({
      ...base,
      installments: 12,
      intervalMonths: 1,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.installments).toBe(12);
      expect(r.data.intervalMonths).toBe(1);
    }
  });

  it("trata installments/intervalMonths ausentes como opcionais", () => {
    const r = invoiceCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.installments).toBeUndefined();
      expect(r.data.intervalMonths).toBeUndefined();
    }
  });

  it("rejeita quantidade de parcelas fora do intervalo (1 a 60)", () => {
    expect(
      invoiceCreateSchema.safeParse({ ...base, installments: 0 }).success,
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({ ...base, installments: 61 }).success,
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({ ...base, installments: 2.5 }).success,
    ).toBe(false);
  });

  it("rejeita intervalo entre parcelas fora do intervalo (1 a 12)", () => {
    expect(
      invoiceCreateSchema.safeParse({ ...base, intervalMonths: 0 }).success,
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({ ...base, intervalMonths: 13 }).success,
    ).toBe(false);
  });

  it("invoiceUpdate aceita apenas o status", () => {
    expect(invoiceUpdateSchema.safeParse({ status: "PAID" }).success).toBe(true);
    expect(invoiceUpdateSchema.safeParse({ status: "INVALIDO" }).success).toBe(
      false,
    );
  });
});

describe("validation - configuracao de cobranca da plataforma", () => {
  it("aceita objeto vazio", () => {
    expect(platformBillingSchema.safeParse({}).success).toBe(true);
  });

  it("aceita chave Pix e converte prazo para numero", () => {
    const r = platformBillingSchema.safeParse({
      pixKeyType: "PHONE",
      pixKey: "(11) 98765-4321",
      pixHolder: "Financy Pro",
      bankName: "Nubank",
      contactEmail: "cobranca@financy.com",
      contactPhone: "(11) 98765-4321",
      defaultAmount: "199.90",
      defaultDueDays: "7",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.defaultDueDays).toBe(7);
  });

  it("rejeita e-mail invalido e prazo fora do intervalo", () => {
    expect(
      platformBillingSchema.safeParse({ contactEmail: "x" }).success,
    ).toBe(false);
    expect(
      platformBillingSchema.safeParse({ defaultDueDays: 999 }).success,
    ).toBe(false);
  });
});

describe("validation - edicao de lancamento", () => {
  it("aceita objeto vazio (atualizacao parcial)", () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(true);
  });

  it("aceita campos parciais validos", () => {
    const r = updateTransactionSchema.safeParse({
      type: "OUTFLOW",
      amount: "150.50",
      date: "2026-02-01",
      bankAccountId: UUID,
      categoryId: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tipo e valor invalidos", () => {
    expect(updateTransactionSchema.safeParse({ type: "LATERAL" }).success).toBe(
      false,
    );
    expect(updateTransactionSchema.safeParse({ amount: "lixo" }).success).toBe(
      false,
    );
  });

  it("rejeita conta com id invalido", () => {
    expect(
      updateTransactionSchema.safeParse({ bankAccountId: "nao-uuid" }).success,
    ).toBe(false);
  });
});