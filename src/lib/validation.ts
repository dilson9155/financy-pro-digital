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

export const titleDirectionEnum = z.enum(["PAYABLE", "RECEIVABLE"]);

export const installmentInput = z.object({
  dueDate: dateInput,
  amount: money.optional(),
});

export const createTitleSchema = z.object({
  direction: titleDirectionEnum,
  partnerId: uuid.optional().nullable(),
  documentNumber: z.string().max(120).optional().nullable(),
  description: z.string().trim().min(1, "Informe a descricao").max(500),
  issueDate: dateInput,
  totalAmount: money,
  categoryId: uuid.optional().nullable(),
  costCenterId: uuid.optional().nullable(),
  accountPlanId: uuid.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  installments: z.array(installmentInput).min(1).max(360).optional(),
});

export type CreateTitleInput = z.infer<typeof createTitleSchema>;

export const updateTitleSchema = z.object({
  partnerId: uuid.optional().nullable(),
  documentNumber: z.string().max(120).optional().nullable(),
  description: z.string().min(1).max(500).optional(),
  issueDate: dateInput.optional(),
  categoryId: uuid.optional().nullable(),
  costCenterId: uuid.optional().nullable(),
  accountPlanId: uuid.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

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
  method: z.enum([
    "CASH",
    "PIX",
    "BANK_TRANSFER",
    "BOLETO",
    "CARD",
    "CHECK",
    "OTHER",
  ]),
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
