import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notFound } from "@/lib/http";
import {
  enumValue,
  pagination,
  RawSearchParams,
  str,
} from "@/lib/filters";
import type { z } from "zod";
import type {
  adminCompanyUpdateSchema,
  invoiceCreateSchema,
  invoiceUpdateSchema,
  platformBillingSchema,
} from "@/lib/validation";

const COMPANY_STATUSES = ["ACTIVE", "SUSPENDED", "CANCELED"] as const;
const INVOICE_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELED"] as const;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Status efetivo: uma fatura PENDENTE vencida e exibida como VENCIDA. */
export function effectiveInvoiceStatus(inv: {
  status: string;
  dueDate: Date;
}): string {
  if (inv.status === "PENDING" && inv.dueDate.getTime() < startOfToday().getTime()) {
    return "OVERDUE";
  }
  return inv.status;
}

// -----------------------------------------------------------------------------
// Empresas (tenants)
// -----------------------------------------------------------------------------

export async function listCompaniesAdmin(sp: RawSearchParams) {
  const { skip, take, page, pageSize } = pagination(sp, { pageSize: 20 });
  const q = str(sp, "q");
  const status = enumValue(sp, "status", COMPANY_STATUSES);

  const where: Prisma.CompanyWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { legalName: { contains: q, mode: "insensitive" } },
            { document: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const today = startOfToday();
  const [companies, total, byStatus, openAgg, overdueCount] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { memberships: true, titles: true } },
        invoices: {
          where: { status: { in: ["PENDING", "OVERDUE"] } },
          orderBy: { dueDate: "asc" },
          select: { id: true, status: true, dueDate: true, amount: true },
        },
      },
    }),
    prisma.company.count({ where }),
    prisma.company.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.invoice.aggregate({
      where: { status: { in: ["PENDING", "OVERDUE"] } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.invoice.count({
      where: {
        OR: [{ status: "OVERDUE" }, { status: "PENDING", dueDate: { lt: today } }],
      },
    }),
  ]);

  const countOf = (s: string) =>
    byStatus.find((b) => b.status === s)?._count._all ?? 0;

  const items = companies.map((c) => {
    const open = c.invoices;
    const overdue = open.filter(
      (i) => effectiveInvoiceStatus(i) === "OVERDUE",
    );
    const next = open[0] ?? null;
    return {
      id: c.id,
      name: c.name,
      legalName: c.legalName,
      document: c.document,
      email: c.email,
      billingEmail: c.billingEmail,
      phone: c.phone,
      status: c.status,
      suspendedReason: c.suspendedReason,
      suspendedAt: c.suspendedAt,
      createdAt: c.createdAt,
      usersCount: c._count.memberships,
      titlesCount: c._count.titles,
      openInvoices: open.length,
      overdueInvoices: overdue.length,
      openAmount: open.reduce(
        (sum, i) => sum + Number(i.amount),
        0,
      ),
      nextDueDate: next?.dueDate ?? null,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    summary: {
      companiesTotal: byStatus.reduce((acc, b) => acc + b._count._all, 0),
      active: countOf("ACTIVE"),
      suspended: countOf("SUSPENDED"),
      canceled: countOf("CANCELED"),
      openInvoices: openAgg._count._all,
      openAmount: Number(openAgg._sum.amount ?? 0),
      overdueInvoices: overdueCount,
    },
  };
}

export async function getCompanyAdmin(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              lastLoginAt: true,
              isSuperAdmin: true,
            },
          },
          role: { select: { id: true, name: true } },
        },
      },
      invoices: { orderBy: { dueDate: "desc" } },
      _count: {
        select: { titles: true, bankAccounts: true, transactions: true },
      },
    },
  });
  if (!company) throw notFound("Empresa nao encontrada.");
  return company;
}

export async function updateCompanyAdmin(
  companyId: string,
  actorId: string | null,
  input: z.infer<typeof adminCompanyUpdateSchema>,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({ where: { id: companyId } });
    if (!before) throw notFound("Empresa nao encontrada.");

    const updated = await tx.company.update({
      where: { id: companyId },
      data: {
        name: input.name ?? before.name,
        legalName: input.legalName === undefined ? before.legalName : input.legalName,
        document: input.document === undefined ? before.document : input.document,
        email: input.email === undefined ? before.email : input.email,
        billingEmail:
          input.billingEmail === undefined ? before.billingEmail : input.billingEmail,
        phone: input.phone === undefined ? before.phone : input.phone,
        address: input.address === undefined ? before.address : input.address,
        currency: input.currency ?? before.currency,
        timezone: input.timezone ?? before.timezone,
      },
    });

    await recordAudit(tx, {
      companyId,
      userId: actorId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Company",
      entityId: companyId,
      before,
      after: updated,
    });

    return updated;
  });
}

/** Ativa/inativa uma empresa; ao inativar, derruba as sessoes dos usuarios. */
export async function setCompanyStatus(
  companyId: string,
  actorId: string | null,
  status: "ACTIVE" | "SUSPENDED" | "CANCELED",
  reason?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({ where: { id: companyId } });
    if (!before) throw notFound("Empresa nao encontrada.");

    const blocked = status !== "ACTIVE";
    const updated = await tx.company.update({
      where: { id: companyId },
      data: {
        status,
        suspendedReason: blocked ? reason ?? before.suspendedReason : null,
        suspendedAt: blocked ? before.suspendedAt ?? new Date() : null,
      },
    });

    if (blocked) {
      const members = await tx.membership.findMany({
        where: { companyId },
        select: { userId: true },
      });
      const userIds = members.map((m) => m.userId);
      if (userIds.length > 0) {
        await tx.userSession.updateMany({
          where: { userId: { in: userIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    await recordAudit(tx, {
      companyId,
      userId: actorId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "CompanyStatus",
      entityId: companyId,
      before: { status: before.status },
      after: { status, reason: reason ?? null },
    });

    return updated;
  });
}

/** Exclui definitivamente a empresa e todos os dados vinculados (cascata). */
export async function deleteCompanyAdmin(companyId: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId } });
    if (!company) throw notFound("Empresa nao encontrada.");

    await recordAudit(tx, {
      companyId,
      userId: actorId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Company",
      entityId: companyId,
      before: { name: company.name, document: company.document },
    });

    await tx.company.delete({ where: { id: companyId } });
    return { id: companyId };
  });
}

// -----------------------------------------------------------------------------
// Faturas / cobrancas
// -----------------------------------------------------------------------------

export async function listInvoicesAdmin(sp: RawSearchParams) {
  const { skip, take, page, pageSize } = pagination(sp, { pageSize: 20 });
  const companyId = str(sp, "companyId");
  const status = enumValue(sp, "status", INVOICE_STATUSES);
  const q = str(sp, "q");
  const today = startOfToday();

  let statusFilter: Prisma.InvoiceWhereInput | undefined;
  if (status === "OVERDUE") {
    statusFilter = {
      OR: [
        { status: "OVERDUE" },
        { status: "PENDING", dueDate: { lt: today } },
      ],
    };
  } else if (status === "PENDING") {
    statusFilter = { status: "PENDING", dueDate: { gte: today } };
  } else if (status) {
    statusFilter = { status: status as never };
  }

  const where: Prisma.InvoiceWhereInput = {
    ...(companyId ? { companyId } : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" } } : {}),
    ...(statusFilter ?? {}),
  };

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy: [{ dueDate: "desc" }],
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            billingEmail: true,
            phone: true,
          },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const items = rows.map((i) => ({
    ...i,
    status: effectiveInvoiceStatus(i),
  }));

  return { items, total, page, pageSize };
}

export async function getInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!invoice) throw notFound("Fatura nao encontrada.");
  return invoice;
}

export async function createInvoice(
  actorId: string | null,
  input: z.infer<typeof invoiceCreateSchema>,
) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true },
  });
  if (!company) throw notFound("Empresa nao encontrada.");

  let method = input.method ?? null;
  let pixKeyType: string | null = input.pixKeyType ?? null;
  let pixKey: string | null = input.pixKey ?? null;

  // Se marcar PIX sem informar chave, usa a chave padrao da plataforma.
  if (method === "PIX" && !pixKey) {
    const billing = await getBillingSettings();
    pixKey = billing.pixKey ?? null;
    pixKeyType = pixKeyType ?? billing.pixKeyType ?? null;
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        companyId: input.companyId,
        description: input.description,
        amount: input.amount as unknown as Prisma.Decimal,
        dueDate: input.dueDate,
        method: method as never,
        pixKeyType: pixKeyType as never,
        pixKey,
        boletoUrl: input.boletoUrl ?? null,
        notes: input.notes ?? null,
        createdById: actorId,
      },
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: actorId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Invoice",
      entityId: invoice.id,
      after: invoice,
    });

    return invoice;
  });
}

/**
 * Gera uma serie de cobrancas (parcelas/recorrencia) para a mesma empresa.
 * Cada parcela vence em `dueDate + i * intervalMonths`, com o mesmo valor.
 */
export async function createInvoiceSeries(
  actorId: string | null,
  input: z.infer<typeof invoiceCreateSchema>,
  count: number,
  intervalMonths: number,
) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true },
  });
  if (!company) throw notFound("Empresa nao encontrada.");

  let method = input.method ?? null;
  let pixKeyType: string | null = input.pixKeyType ?? null;
  let pixKey: string | null = input.pixKey ?? null;

  if (method === "PIX" && !pixKey) {
    const billing = await getBillingSettings();
    pixKey = billing.pixKey ?? null;
    pixKeyType = pixKeyType ?? billing.pixKeyType ?? null;
  }

  const base = new Date(input.dueDate);

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const due = new Date(base);
      due.setMonth(due.getMonth() + i * intervalMonths);

      const invoice = await tx.invoice.create({
        data: {
          companyId: input.companyId,
          description: `${input.description} (${i + 1}/${count})`,
          amount: input.amount as unknown as Prisma.Decimal,
          dueDate: due,
          method: method as never,
          pixKeyType: pixKeyType as never,
          pixKey,
          boletoUrl: input.boletoUrl ?? null,
          notes: input.notes ?? null,
          createdById: actorId,
        },
      });

      await recordAudit(tx, {
        companyId: input.companyId,
        userId: actorId,
        action: AUDIT_ACTIONS.CREATE,
        entity: "Invoice",
        entityId: invoice.id,
        after: invoice,
      });

      created.push(invoice);
    }
    return created;
  });
}

export async function updateInvoice(
  id: string,
  actorId: string | null,
  input: z.infer<typeof invoiceUpdateSchema>,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.invoice.findUnique({ where: { id } });
    if (!before) throw notFound("Fatura nao encontrada.");

    const status = input.status ?? before.status;
    const updated = await tx.invoice.update({
      where: { id },
      data: {
        description: input.description ?? before.description,
        amount:
          input.amount === undefined
            ? before.amount
            : (input.amount as unknown as Prisma.Decimal),
        dueDate: input.dueDate ?? before.dueDate,
        status: status as never,
        method: input.method === undefined ? before.method : (input.method as never),
        pixKeyType:
          input.pixKeyType === undefined
            ? before.pixKeyType
            : (input.pixKeyType as never),
        pixKey: input.pixKey === undefined ? before.pixKey : input.pixKey,
        boletoUrl:
          input.boletoUrl === undefined ? before.boletoUrl : input.boletoUrl,
        notes: input.notes === undefined ? before.notes : input.notes,
        paidAt:
          status === "PAID"
            ? before.paidAt ?? new Date()
            : before.status === "PAID"
              ? null
              : before.paidAt,
      },
    });

    await recordAudit(tx, {
      companyId: before.companyId,
      userId: actorId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Invoice",
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  });
}

export async function deleteInvoice(id: string, actorId: string | null) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.invoice.findUnique({ where: { id } });
    if (!before) throw notFound("Fatura nao encontrada.");
    await tx.invoice.delete({ where: { id } });
    await recordAudit(tx, {
      companyId: before.companyId,
      userId: actorId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Invoice",
      entityId: id,
      before,
    });
    return { id };
  });
}

// -----------------------------------------------------------------------------
// Configuracao global de cobranca
// -----------------------------------------------------------------------------

const BILLING_KEY = "billing";

export interface BillingSettings {
  pixKeyType: string | null;
  pixKey: string | null;
  pixHolder: string | null;
  bankName: string | null;
  paymentInstructions: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  defaultAmount: number | null;
  defaultDueDays: number | null;
}

export async function getBillingSettings(): Promise<BillingSettings> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: BILLING_KEY },
  });
  return normalizeBilling((row?.value ?? {}) as Record<string, unknown>);
}

function normalizeBilling(v: Record<string, unknown>): BillingSettings {
  return {
    pixKeyType: (v.pixKeyType as string) ?? null,
    pixKey: (v.pixKey as string) ?? null,
    pixHolder: (v.pixHolder as string) ?? null,
    bankName: (v.bankName as string) ?? null,
    paymentInstructions: (v.paymentInstructions as string) ?? null,
    contactEmail: (v.contactEmail as string) ?? null,
    contactPhone: (v.contactPhone as string) ?? null,
    defaultAmount: (v.defaultAmount as number) ?? null,
    defaultDueDays: (v.defaultDueDays as number) ?? null,
  };
}

export async function saveBillingSettings(
  actorId: string | null,
  input: z.infer<typeof platformBillingSchema>,
): Promise<BillingSettings> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.platformSetting.findUnique({
      where: { key: BILLING_KEY },
    });
    const merged: Record<string, unknown> = {
      ...((before?.value ?? {}) as Record<string, unknown>),
    };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) merged[key] = value;
    }

    const saved = await tx.platformSetting.upsert({
      where: { key: BILLING_KEY },
      update: { value: merged as never },
      create: { key: BILLING_KEY, value: merged as never },
    });

    await recordAudit(tx, {
      userId: actorId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "PlatformSetting",
      entityId: saved.id,
      before: before ? { value: before.value } : null,
      after: { value: merged },
    });

    return normalizeBilling(merged);
  });
}
