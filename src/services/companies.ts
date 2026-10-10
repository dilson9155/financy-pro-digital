import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notFound } from "@/lib/http";
import { ensureSystemRoles } from "./roles";

export interface CompanyInput {
  name: string;
  legalName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

/**
 * Cria uma empresa e vincula o usuario informado como Administrador.
 * Tambem provisiona os papeis de sistema. Tudo em uma transacao.
 */
export async function createCompanyForUser(
  userId: string,
  input: CompanyInput,
  ownerRoleName = "Administrador",
) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.name,
        legalName: input.legalName ?? null,
        document: input.document ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
      },
    });

    await ensureSystemRoles(tx, company.id);

    const role = await tx.role.findFirst({
      where: { companyId: company.id, name: ownerRoleName },
    });
    if (!role) throw notFound("Papel de proprietario nao encontrado.");

    await tx.membership.create({
      data: {
        userId,
        companyId: company.id,
        roleId: role.id,
        status: "ACTIVE",
      },
    });

    await recordAudit(tx, {
      companyId: company.id,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Company",
      entityId: company.id,
      after: company,
    });

    return company;
  });
}

export async function listCompaniesForUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      company: true,
      role: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    companyId: m.companyId,
    name: m.company.name,
    role: m.role.name,
    status: m.company.status,
  }));
}

export async function getCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw notFound("Empresa nao encontrada.");
  return company;
}

export async function updateCompany(
  companyId: string,
  userId: string | null,
  input: Partial<CompanyInput> & { currency?: string; timezone?: string },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({ where: { id: companyId } });
    if (!before) throw notFound("Empresa nao encontrada.");

    const updated = await tx.company.update({
      where: { id: companyId },
      data: {
        name: input.name ?? before.name,
        legalName:
          input.legalName === undefined ? before.legalName : input.legalName,
        document: input.document === undefined ? before.document : input.document,
        email: input.email === undefined ? before.email : input.email,
        phone: input.phone === undefined ? before.phone : input.phone,
        address: input.address === undefined ? before.address : input.address,
        currency: input.currency ?? before.currency,
        timezone: input.timezone ?? before.timezone,
      },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Company",
      entityId: companyId,
      before,
      after: updated,
    });

    return updated;
  });
}
