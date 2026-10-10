import { z } from "zod";

const money = z.union([
  z
    .string()
    .refine(
      (s) => {
        const t = s.trim();
        if (t === "" || t === "-" || t === "." || t === "-.") return false;
        return !Number.isNaN(Number(t));
      },
      "Valor monetario invalido",
    ),
  z.number(),
]);
const dateInput = z.coerce.date();
const uuid = z.string().uuid();

export const settlementMethodEnum = z.enum([
  "CASH",
  "PIX",
  "BANK_TRANSFER",
  "BOLETO",
  "CARD",
  "CHECK",
  "OTHER",
]);

export const pixKeyTypeEnum = z.enum(["CPF_CNPJ", "EMAIL", "PHONE", "RANDOM"]);

type PixFields = {
  paymentMethod?: string | null;
  pixKeyType?: string | null;
  pixKey?: string | null;
};

/** Exige o tipo e a chave quando a forma de pagamento informada for PIX. */
function refinePix(data: PixFields, ctx: z.RefinementCtx): void {
  if (data.paymentMethod !== "PIX") return;
  if (!data.pixKeyType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pixKeyType"],
      message: "Selecione o tipo da chave Pix.",
    });
  }
  if (!data.pixKey || data.pixKey.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pixKey"],
      message: "Informe a chave Pix.",
    });
  }
}

/** Variante para faturas, cujo campo de forma de pagamento se chama `method`. */
function refineInvoicePix(
  data: {
    method?: string | null;
    pixKeyType?: string | null;
    pixKey?: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.method !== "PIX") return;
  if (!data.pixKeyType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pixKeyType"],
      message: "Selecione o tipo da chave Pix.",
    });
  }
  if (!data.pixKey || data.pixKey.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pixKey"],
      message: "Informe a chave Pix.",
    });
  }
}

/** Campos de forma de pagamento/Pix compartilhados entre criar e editar titulos. */
const paymentFields = {
  paymentMethod: settlementMethodEnum.optional().nullable(),
  pixKeyType: pixKeyTypeEnum.optional().nullable(),
  pixKey: z.string().trim().max(200).optional().nullable(),
};

export const titleDirectionEnum = z.enum(["PAYABLE", "RECEIVABLE"]);

export const installmentInput = z.object({
  dueDate: dateInput,
  amount: money.optional(),
});

export const createTitleSchema = z
  .object({
    direction: titleDirectionEnum,
    partnerId: uuid.optional().nullable(),
    documentNumber: z.string().max(120).optional().nullable(),
    description: z.string().trim().min(1, "Informe a descricao").max(500),
    issueDate: dateInput,
    totalAmount: money,
    categoryId: uuid.optional().nullable(),
    costCenterId: uuid.optional().nullable(),
    accountPlanId: uuid.optional().nullable(),
    ...paymentFields,
    notes: z.string().max(2000).optional().nullable(),
    installments: z.array(installmentInput).min(1).max(360).optional(),
  })
  .superRefine(refinePix);

export type CreateTitleInput = z.infer<typeof createTitleSchema>;

export const updateTitleSchema = z
  .object({
    partnerId: uuid.optional().nullable(),
    documentNumber: z.string().max(120).optional().nullable(),
    description: z.string().min(1).max(500).optional(),
    issueDate: dateInput.optional(),
    categoryId: uuid.optional().nullable(),
    costCenterId: uuid.optional().nullable(),
    accountPlanId: uuid.optional().nullable(),
    ...paymentFields,
    notes: z.string().max(2000).optional().nullable(),
  })
  .superRefine(refinePix);

export const cancelTitleSchema = z.object({
  reason: z.string().min(3, "Informe o motivo").max(500),
});

export const settleSchema = z.object({
  installmentId: uuid,
  amount: money, // principal aplicado (permite baixa parcial)
  interest: money.default(0),
  fine: money.default(0),
  discount: money.default(0),
  date: dateInput,
  competenceDate: dateInput.optional(),
  bankAccountId: uuid,
  method: settlementMethodEnum,
  notes: z.string().max(1000).optional().nullable(),
});

export type SettleInput = z.infer<typeof settleSchema>;

export const reverseSettlementSchema = z.object({
  reason: z.string().min(3, "Informe o motivo do estorno").max(500),
});

export const createTransactionSchema = z.object({
  bankAccountId: uuid,
  type: z.enum(["INFLOW", "OUTFLOW"]),
  amount: money,
  date: dateInput,
  competenceDate: dateInput.optional(),
  description: z.string().min(1).max(500),
  categoryId: uuid.optional().nullable(),
  costCenterId: uuid.optional().nullable(),
  accountPlanId: uuid.optional().nullable(),
  partnerId: uuid.optional().nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/** Edicao de um lancamento manual (campos opcionais). */
export const updateTransactionSchema = z.object({
  bankAccountId: uuid.optional(),
  type: z.enum(["INFLOW", "OUTFLOW"]).optional(),
  amount: money.optional(),
  date: dateInput.optional(),
  competenceDate: dateInput.optional().nullable(),
  description: z.string().min(1).max(500).optional(),
  categoryId: uuid.optional().nullable(),
  costCenterId: uuid.optional().nullable(),
  accountPlanId: uuid.optional().nullable(),
  partnerId: uuid.optional().nullable(),
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const transferSchema = z.object({
  fromBankAccountId: uuid,
  toBankAccountId: uuid,
  amount: money,
  date: dateInput,
  description: z.string().max(500).optional().nullable(),
});

export type TransferInput = z.infer<typeof transferSchema>;

export const createAccountSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(["BANK", "CASH", "INVESTMENT", "OTHER"]),
  bankName: z.string().max(160).optional().nullable(),
  bankCode: z.string().max(20).optional().nullable(),
  agency: z.string().max(40).optional().nullable(),
  accountNumber: z.string().max(60).optional().nullable(),
  accountPlanId: uuid.optional().nullable(),
  currency: z.string().length(3).default("BRL"),
  initialBalance: money.default(0),
  active: z.boolean().default(true),
  /** Registra o saldo inicial como lancamento no ledger (opcional). */
  postOpeningBalance: z.boolean().default(false),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(["INCOME", "EXPENSE"]),
  parentId: uuid.optional().nullable(),
  accountPlanId: uuid.optional().nullable(),
  active: z.boolean().default(true),
});

export const accountPlanSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  parentId: uuid.optional().nullable(),
  isAnalytical: z.boolean().default(true),
  allowManual: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const costCenterSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  parentId: uuid.optional().nullable(),
  active: z.boolean().default(true),
});

export const partnerSchema = z.object({
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]).default("BOTH"),
  name: z.string().min(1).max(200),
  document: z.string().max(30).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  active: z.boolean().default(true),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(6, "Senha muito curta"),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email(),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
  companyName: z.string().min(2).max(200),
  companyDocument: z.string().max(30).optional().nullable(),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email(),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
  roleId: uuid,
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).default("ACTIVE"),
});

export const roleSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional().nullable(),
  permissions: z.array(z.string()).default([]),
});

export const statementImportSchema = z.object({
  bankAccountId: uuid,
  fileName: z.string().max(200).optional().nullable(),
  format: z.enum(["CSV", "OFX", "MANUAL"]).default("CSV"),
  periodStart: dateInput.optional().nullable(),
  periodEnd: dateInput.optional().nullable(),
  openingBalance: money.optional().nullable(),
  closingBalance: money.optional().nullable(),
  lines: z
    .array(
      z.object({
        date: dateInput,
        description: z.string().min(1).max(500),
        amount: money,
        type: z.enum(["INFLOW", "OUTFLOW"]),
        externalId: z.string().max(120).optional().nullable(),
      }),
    )
    .min(1),
});

export const reconcileSchema = z.object({
  lineId: uuid,
  transactionId: uuid,
});

export const settingsSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.unknown(),
});

/**
 * Imagem embutida como data URL (PNG ou JPEG). Usada para a logo da empresa
 * e a foto do usuario. Limite de ~1,5 MB para nao sobrecarregar o banco.
 */
export const imageDataUrl = z
  .string()
  .max(2_000_000, "Imagem muito grande (máximo ~1,5 MB).")
  .refine(
    (value) => /^data:image\/(png|jpe?g);base64,[a-z0-9+/=]+$/i.test(value),
    "Formato de imagem inválido (use PNG ou JPEG).",
  );

// -----------------------------------------------------------------------------
// Administracao da plataforma (super-admin) e cobranca
// -----------------------------------------------------------------------------

export const companyStatusEnum = z.enum(["ACTIVE", "SUSPENDED", "CANCELED"]);
export const invoiceStatusEnum = z.enum([
  "PENDING",
  "PAID",
  "OVERDUE",
  "CANCELED",
]);

/** Edicao de dados de uma empresa pelo super-admin. */
export const adminCompanyUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  legalName: z.string().max(200).optional().nullable(),
  document: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
  billingEmail: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(60).optional(),
});

/** Ativacao/inativacao de empresa (ex.: falta de pagamento). */
export const adminCompanyStatusSchema = z.object({
  status: companyStatusEnum,
  reason: z.string().trim().max(300).optional().nullable(),
});

/** Emissao de fatura/cobranca para uma empresa. */
export const invoiceCreateSchema = z
  .object({
    companyId: uuid,
    description: z.string().trim().min(1, "Informe a descricao").max(300),
    amount: money,
    dueDate: dateInput,
    method: settlementMethodEnum.optional().nullable(),
    pixKeyType: pixKeyTypeEnum.optional().nullable(),
    pixKey: z.string().trim().max(200).optional().nullable(),
    boletoUrl: z.string().url("Link do boleto invalido").max(600).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    /** Quantidade de parcelas a gerar (1 = cobranca unica). */
    installments: z.coerce.number().int().min(1).max(60).optional(),
    /** Intervalo entre parcelas, em meses (padrao 1). */
    intervalMonths: z.coerce.number().int().min(1).max(12).optional(),
  })
  .superRefine(refineInvoicePix);

/** Atualizacao de uma fatura (marcar paga, cancelar, editar). */
export const invoiceUpdateSchema = z.object({
  description: z.string().trim().min(1).max(300).optional(),
  amount: money.optional(),
  dueDate: dateInput.optional(),
  status: invoiceStatusEnum.optional(),
  method: settlementMethodEnum.optional().nullable(),
  pixKeyType: pixKeyTypeEnum.optional().nullable(),
  pixKey: z.string().trim().max(200).optional().nullable(),
  boletoUrl: z.string().url("Link do boleto invalido").max(600).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

/** Configuracao global de cobranca da plataforma (chave Pix, contato etc.). */
export const platformBillingSchema = z.object({
  pixKeyType: pixKeyTypeEnum.optional().nullable(),
  pixKey: z.string().trim().max(200).optional().nullable(),
  pixHolder: z.string().trim().max(200).optional().nullable(),
  bankName: z.string().trim().max(200).optional().nullable(),
  paymentInstructions: z.string().trim().max(2000).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  defaultAmount: money.optional(),
  defaultDueDays: z.coerce.number().int().min(0).max(365).optional(),
});

/** Marcar notificacoes como lidas (por ids ou todas). */
export const notificationReadSchema = z.object({
  ids: z.array(uuid).max(200).optional(),
  all: z.boolean().optional(),
});
