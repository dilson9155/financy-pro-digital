import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { conflict, notFound } from "@/lib/http";
import type { z } from "zod";
import type { createUserSchema } from "@/lib/validation";
import { pagination, RawSearchParams, str } from "@/lib/filters";

type CreateUserInput = z.infer<typeof createUserSchema>;

export async function listUsers(companyId: string, sp: RawSearchParams) {
  const { skip, take, page, pageSize } = pagination(sp, { pageSize: 50 });
  const q = str(sp, "q");
  const status = str(sp, "status");

  const where = {
    companyId,
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [memberships, total] = await Promise.all([
    prisma.membership.findMany({
      where,
      skip,
      take,
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
    }),
    prisma.membership.count({ where }),
  ]);

  return {
    items: memberships.map((m) => ({
      membershipId: m.id,
      membershipStatus: m.status,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      userStatus: m.user.status,
      lastLoginAt: m.user.lastLoginAt,
      isSuperAdmin: m.user.isSuperAdmin,
      roleId: m.role.id,
      roleName: m.role.name,
    })),
    total,
    page,
    pageSize,
  };
}

export async function createUserForCompany(
  companyId: string,
  actorId: string | null,
  input: CreateUserInput,
) {
  const email = input.email.toLowerCase();
  const role = await prisma.role.findFirst({
    where: { id: input.roleId, companyId },
  });
  if (!role) throw notFound("Papel nao encontrado para esta empresa.");

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email } });
    if (user) {
      const existingMembership = await tx.membership.findUnique({
        where: { userId_companyId: { userId: user.id, companyId } },
      });
      if (existingMembership) {
        throw conflict("Este usuario ja possui vinculo com a empresa.");
      }
    } else {
      const passwordHash = await hashPassword(input.password);
      user = await tx.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
          status: input.status,
        },
      });
    }

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        companyId,
        roleId: input.roleId,
        status: "ACTIVE",
      },
    });

    await recordAudit(tx, {
      companyId,
      userId: actorId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Membership",
      entityId: membership.id,
      after: {
        userId: user.id,
        email: user.email,
        roleId: input.roleId,
      },
    });

    return { membership, userId: user.id };
  });
}

export async function updateMembership(
  companyId: string,
  actorId: string | null,
  membershipId: string,
  data: { roleId?: string; status?: "ACTIVE" | "INVITED" | "SUSPENDED" },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.membership.findFirst({
      where: { id: membershipId, companyId },
    });
    if (!before) throw notFound("Vinculo nao encontrado.");

    if (data.roleId) {
      const role = await tx.role.findFirst({
        where: { id: data.roleId, companyId },
      });
      if (!role) throw notFound("Papel nao encontrado.");
    }

    const updated = await tx.membership.update({
      where: { id: membershipId },
      data: {
        roleId: data.roleId ?? before.roleId,
        status: data.status ?? before.status,
      },
    });

    await recordAudit(tx, {
      companyId,
      userId: actorId,
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      entity: "Membership",
      entityId: membershipId,
      before,
      after: updated,
    });

    return updated;
  });
}

export async function resetUserPassword(
  actorId: string | null,
  targetUserId: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw notFound("Usuario nao encontrado.");
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    // Revoga sessoes ativas por seguranca.
    await tx.userSession.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit(tx, {
      userId: actorId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "User",
      entityId: targetUserId,
      after: { passwordReset: true },
    });
  });
}

export async function updateUserProfile(
  actorId: string | null,
  targetUserId: string,
  data: { name?: string; email?: string; status?: "ACTIVE" | "INACTIVE" | "LOCKED" },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!before) throw notFound("Usuario nao encontrado.");

    if (data.email && data.email.toLowerCase() !== before.email) {
      const dup = await tx.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (dup) throw conflict("E-mail ja cadastrado.");
    }

    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: {
        name: data.name ?? before.name,
        email: data.email ? data.email.toLowerCase() : before.email,
        status: data.status ?? before.status,
      },
    });

    await recordAudit(tx, {
      userId: actorId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "User",
      entityId: targetUserId,
      before: { name: before.name, email: before.email, status: before.status },
      after: { name: updated.name, email: updated.email, status: updated.status },
    });

    return updated;
  });
}
