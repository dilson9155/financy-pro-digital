import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/http";
import type { z } from "zod";
import type { roleSchema } from "@/lib/validation";

type RoleInput = z.infer<typeof roleSchema>;

/** Cria os papeis de sistema de uma empresa (idempotente). */
export async function ensureSystemRoles(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    const existing = await tx.role.findFirst({
      where: { companyId, name: role.name },
    });
    if (existing) continue;
    await tx.role.create({
      data: {
        companyId,
        name: role.name,
        description: role.description,
        isSystem: true,
        permissions: {
          create: role.permissions.map((p) => ({ permission: p })),
        },
      },
    });
  }
}

export async function listRoles(companyId: string) {
  return prisma.role.findMany({
    where: { companyId },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      permissions: true,
      _count: { select: { memberships: true } },
    },
  });
}

export async function createRole(
  companyId: string,
  userId: string | null,
  input: RoleInput,
) {
  const exists = await prisma.role.findFirst({
    where: { companyId, name: input.name },
  });
  if (exists) throw conflict("Ja existe um papel com este nome.");

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        companyId,
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
        permissions: {
          create: input.permissions.map((p) => ({ permission: p })),
        },
      },
      include: { permissions: true },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Role",
      entityId: role.id,
      after: role,
    });
    return role;
  });
}

export async function updateRole(
  companyId: string,
  userId: string | null,
  roleId: string,
  input: RoleInput,
) {
  const role = await prisma.role.findFirst({ where: { id: roleId, companyId } });
  if (!role) throw notFound("Papel nao encontrado.");
  if (role.isSystem && role.name !== input.name) {
    throw badRequest("Nao e possivel renomear um papel de sistema.");
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.role.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });

    await tx.rolePermission.deleteMany({ where: { roleId } });
    const updated = await tx.role.update({
      where: { id: roleId },
      data: {
        name: role.isSystem ? role.name : input.name,
        description: input.description ?? null,
        permissions: {
          create: input.permissions.map((p) => ({ permission: p })),
        },
      },
      include: { permissions: true },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      entity: "Role",
      entityId: roleId,
      before,
      after: updated,
    });

    return updated;
  });
}

export async function deleteRole(
  companyId: string,
  userId: string | null,
  roleId: string,
) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, companyId },
    include: { _count: { select: { memberships: true } } },
  });
  if (!role) throw notFound("Papel nao encontrado.");
  if (role.isSystem) throw conflict("Papeis de sistema nao podem ser excluidos.");
  if (role._count.memberships > 0) {
    throw conflict("Existem usuarios vinculados a este papel.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.role.delete({ where: { id: roleId } });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Role",
      entityId: roleId,
      before: role,
    });
  });
}
