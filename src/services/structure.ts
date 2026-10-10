import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { conflict, notFound } from "@/lib/http";
import { isGreaterThan, round2 } from "@/lib/money";
import { postTransaction } from "@/lib/ledger";
import type { z } from "zod";
import type {
  accountPlanSchema,
  categorySchema,
  costCenterSchema,
  partnerSchema,
  createAccountSchema,
} from "@/lib/validation";
import { RawSearchParams, str } from "@/lib/filters";

// -----------------------------------------------------------------------------
// Plano de contas
// -----------------------------------------------------------------------------

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

export async function listAccountPlans(companyId: string, sp: RawSearchParams = {}) {
  const active = str(sp, "active");
  return prisma.accountPlan.findMany({
    where: {
      companyId,
      ...(active === "true" ? { active: true } : {}),
      ...(active === "false" ? { active: false } : {}),
    },
    orderBy: { code: "asc" },
  });
}

export async function createAccountPlan(
  companyId: string,
  userId: string | null,
  input: z.infer<typeof accountPlanSchema>,
) {
  return prisma.$transaction(async (tx) => {
    const dup = await tx.accountPlan.findFirst({
      where: { companyId, code: input.code },
    });
    if (dup) throw conflict("Ja existe uma conta com este codigo.");
    const created = await tx.accountPlan.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        type: input.type as (typeof ACCOUNT_TYPES)[number],
        parentId: input.parentId ?? null,
        isAnalytical: input.isAnalytical,
        allowManual: input.allowManual,
        active: input.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "AccountPlan",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updateAccountPlan(
  companyId: string,
  userId: string | null,
  id: string,
  input: Partial<z.infer<typeof accountPlanSchema>>,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.accountPlan.findFirst({ where: { id, companyId } });
    if (!before) throw notFound("Conta nao encontrada.");
    const updated = await tx.accountPlan.update({
      where: { id },
      data: {
        code: input.code ?? before.code,
        name: input.name ?? before.name,
        type: (input.type as (typeof ACCOUNT_TYPES)[number]) ?? before.type,
        parentId: input.parentId === undefined ? before.parentId : input.parentId,
        isAnalytical: input.isAnalytical ?? before.isAnalytical,
        allowManual: input.allowManual ?? before.allowManual,
        active: input.active ?? before.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "AccountPlan",
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  });
}

export async function deleteAccountPlan(companyId: string, userId: string | null, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.accountPlan.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: { children: true, categories: true, titles: true, transactions: true, bankAccounts: true },
        },
      },
    });
    if (!before) throw notFound("Conta nao encontrada.");
    const c = before._count;
    if (c.children + c.categories + c.titles + c.transactions + c.bankAccounts > 0) {
      throw conflict("Conta em uso. Desative-a em vez de excluir.");
    }
    await tx.accountPlan.delete({ where: { id } });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "AccountPlan",
      entityId: id,
      before,
    });
  });
}

// -----------------------------------------------------------------------------
// Categorias
// -----------------------------------------------------------------------------

export async function listCategories(companyId: string, sp: RawSearchParams = {}) {
  const type = str(sp, "type");
  const q = str(sp, "q");
  const active = str(sp, "active");
  return prisma.category.findMany({
    where: {
      companyId,
      ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}),
      ...(active === "true" ? { active: true } : {}),
      ...(active === "false" ? { active: false } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(
  companyId: string,
  userId: string | null,
  input: z.infer<typeof categorySchema>,
) {
  return prisma.$transaction(async (tx) => {
    const dup = await tx.category.findFirst({
      where: { companyId, name: input.name, type: input.type },
    });
    if (dup) throw conflict("Ja existe uma categoria com este nome e tipo.");
    const created = await tx.category.create({
      data: {
        companyId,
        name: input.name,
        type: input.type,
        parentId: input.parentId ?? null,
        accountPlanId: input.accountPlanId ?? null,
        active: input.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Category",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updateCategory(
  companyId: string,
  userId: string | null,
  id: string,
  input: Partial<z.infer<typeof categorySchema>>,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.category.findFirst({ where: { id, companyId } });
    if (!before) throw notFound("Categoria nao encontrada.");
    const updated = await tx.category.update({
      where: { id },
      data: {
        name: input.name ?? before.name,
        type: input.type ?? before.type,
        parentId: input.parentId === undefined ? before.parentId : input.parentId,
        accountPlanId:
          input.accountPlanId === undefined ? before.accountPlanId : input.accountPlanId,
        active: input.active ?? before.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Category",
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  });
}

export async function deleteCategory(companyId: string, userId: string | null, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.category.findFirst({
      where: { id, companyId },
      include: { _count: { select: { children: true, titles: true, transactions: true } } },
    });
    if (!before) throw notFound("Categoria nao encontrada.");
    const c = before._count;
    if (c.children + c.titles + c.transactions > 0) {
      throw conflict("Categoria em uso. Desative-a em vez de excluir.");
    }
    await tx.category.delete({ where: { id } });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Category",
      entityId: id,
      before,
    });
  });
}

// -----------------------------------------------------------------------------
// Centros de custo
// -----------------------------------------------------------------------------

export async function listCostCenters(companyId: string, sp: RawSearchParams = {}) {
  const q = str(sp, "q");
  const active = str(sp, "active");
  return prisma.costCenter.findMany({
    where: {
      companyId,
      ...(active === "true" ? { active: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { code: "asc" },
  });
}

export async function createCostCenter(
  companyId: string,
  userId: string | null,
  input: z.infer<typeof costCenterSchema>,
) {
  return prisma.$transaction(async (tx) => {
    const dup = await tx.costCenter.findFirst({ where: { companyId, code: input.code } });
    if (dup) throw conflict("Ja existe um centro de custo com este codigo.");
    const created = await tx.costCenter.create({
      data: {
        companyId,
        code: input.code,
        name: input.name,
        parentId: input.parentId ?? null,
        active: input.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "CostCenter",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updateCostCenter(
  companyId: string,
  userId: string | null,
  id: string,
  input: Partial<z.infer<typeof costCenterSchema>>,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.costCenter.findFirst({ where: { id, companyId } });
    if (!before) throw notFound("Centro de custo nao encontrado.");
    const updated = await tx.costCenter.update({
      where: { id },
      data: {
        code: input.code ?? before.code,
        name: input.name ?? before.name,
        parentId: input.parentId === undefined ? before.parentId : input.parentId,
        active: input.active ?? before.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "CostCenter",
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  });
}

export async function deleteCostCenter(companyId: string, userId: string | null, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.costCenter.findFirst({
      where: { id, companyId },
      include: { _count: { select: { children: true, titles: true, transactions: true } } },
    });
    if (!before) throw notFound("Centro de custo nao encontrado.");
    const c = before._count;
    if (c.children + c.titles + c.transactions > 0) {
      throw conflict("Centro de custo em uso. Desative-o em vez de excluir.");
    }
    await tx.costCenter.delete({ where: { id } });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "CostCenter",
      entityId: id,
      before,
    });
  });
}

// -----------------------------------------------------------------------------
// Fornecedores / clientes
// -----------------------------------------------------------------------------

export async function listPartners(companyId: string, sp: RawSearchParams = {}) {
  const type = str(sp, "type");
  const q = str(sp, "q");
  const active = str(sp, "active");
  return prisma.partner.findMany({
    where: {
      companyId,
      ...(type === "CUSTOMER" || type === "SUPPLIER" || type === "BOTH" ? { type } : {}),
      ...(active === "true" ? { active: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { document: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function createPartner(
  companyId: string,
  userId: string | null,
  input: z.infer<typeof partnerSchema>,
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.partner.create({
      data: {
        companyId,
        type: input.type,
        name: input.name,
        document: input.document ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        active: input.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Partner",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updatePartner(
  companyId: string,
  userId: string | null,
  id: string,
  input: Partial<z.infer<typeof partnerSchema>>,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.partner.findFirst({ where: { id, companyId } });
    if (!before) throw notFound("Parceiro nao encontrado.");
    const updated = await tx.partner.update({
      where: { id },
      data: {
        type: input.type ?? before.type,
        name: input.name ?? before.name,
        document: input.document === undefined ? before.document : input.document,
        email: input.email === undefined ? before.email : input.email,
        phone: input.phone === undefined ? before.phone : input.phone,
        notes: input.notes === undefined ? before.notes : input.notes,
        active: input.active ?? before.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Partner",
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  });
}

export async function deletePartner(companyId: string, userId: string | null, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.partner.findFirst({
      where: { id, companyId },
      include: { _count: { select: { titles: true, transactions: true } } },
    });
    if (!before) throw notFound("Parceiro nao encontrado.");
    if (before._count.titles + before._count.transactions > 0) {
      throw conflict("Parceiro possui movimentacoes. Desative-o em vez de excluir.");
    }
    await tx.partner.delete({ where: { id } });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Partner",
      entityId: id,
      before,
    });
  });
}

// -----------------------------------------------------------------------------
// Contas bancarias e caixas
// -----------------------------------------------------------------------------

export async function listBankAccounts(companyId: string, sp: RawSearchParams = {}) {
  const type = str(sp, "type");
  const active = str(sp, "active");
  return prisma.bankAccount.findMany({
    where: {
      companyId,
      ...(type === "BANK" || type === "CASH" || type === "INVESTMENT" || type === "OTHER"
        ? { type }
        : {}),
      ...(active === "true" ? { active: true } : {}),
      ...(active === "false" ? { active: false } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function createBankAccount(
  companyId: string,
  userId: string | null,
  input: z.infer<typeof createAccountSchema>,
) {
  const initial = round2(input.initialBalance);

  return prisma.$transaction(async (tx) => {
    const account = await tx.bankAccount.create({
      data: {
        companyId,
        name: input.name,
        type: input.type,
        bankName: input.bankName ?? null,
        bankCode: input.bankCode ?? null,
        agency: input.agency ?? null,
        accountNumber: input.accountNumber ?? null,
        accountPlanId: input.accountPlanId ?? null,
        currency: input.currency,
        initialBalance: initial,
        // O saldo atual e sempre derivado do ledger; comeca zerado.
        currentBalance: 0,
        active: input.active,
      },
    });

    // Saldo inicial entra no ledger como lancamento, mantendo consistencia.
    if (isGreaterThan(initial, 0)) {
      await postTransaction(tx, {
        companyId,
        bankAccountId: account.id,
        type: "INFLOW",
        origin: "OPENING_BALANCE",
        amount: initial,
        date: new Date(),
        description: "Saldo inicial da conta",
        accountPlanId: input.accountPlanId ?? null,
        createdById: userId,
      });
    }

    const refreshed = await tx.bankAccount.findUnique({ where: { id: account.id } });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "BankAccount",
      entityId: account.id,
      after: refreshed,
    });

    return refreshed!;
  });
}

export async function updateBankAccount(
  companyId: string,
  userId: string | null,
  id: string,
  input: Partial<z.infer<typeof createAccountSchema>>,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.bankAccount.findFirst({ where: { id, companyId } });
    if (!before) throw notFound("Conta/caixa nao encontrada.");
    const updated = await tx.bankAccount.update({
      where: { id },
      data: {
        name: input.name ?? before.name,
        type: input.type ?? before.type,
        bankName: input.bankName === undefined ? before.bankName : input.bankName,
        bankCode: input.bankCode === undefined ? before.bankCode : input.bankCode,
        agency: input.agency === undefined ? before.agency : input.agency,
        accountNumber:
          input.accountNumber === undefined ? before.accountNumber : input.accountNumber,
        accountPlanId:
          input.accountPlanId === undefined ? before.accountPlanId : input.accountPlanId,
        currency: input.currency ?? before.currency,
        active: input.active ?? before.active,
      },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "BankAccount",
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  });
}

export async function deleteBankAccount(companyId: string, userId: string | null, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.bankAccount.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: {
            transactions: true,
            settlements: true,
            installments: true,
            statements: true,
            transfersOut: true,
            transfersIn: true,
          },
        },
      },
    });
    if (!before) throw notFound("Conta/caixa nao encontrada.");
    const c = before._count;
    const total =
      c.transactions +
      c.settlements +
      c.installments +
      c.statements +
      c.transfersOut +
      c.transfersIn;
    if (total > 0) {
      throw conflict("Conta possui movimentacoes. Desative-a em vez de excluir.");
    }
    await tx.bankAccount.delete({ where: { id } });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "BankAccount",
      entityId: id,
      before,
    });
  });
}
