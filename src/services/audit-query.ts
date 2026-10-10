import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dateRange, pagination, RawSearchParams, sort, str, strList } from "@/lib/filters";

export async function listAuditLogs(companyId: string, sp: RawSearchParams) {
  const where: Prisma.AuditLogWhereInput = { companyId };

  const entity = str(sp, "entity");
  if (entity) where.entity = entity;

  const entityId = str(sp, "entityId");
  if (entityId) where.entityId = entityId;

  const userId = str(sp, "userId");
  if (userId) where.userId = userId;

  const actions = strList(sp, "action");
  if (actions.length > 0) where.action = { in: actions };

  const q = str(sp, "q");
  if (q) {
    where.OR = [
      { entity: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
    ];
  }

  const range = dateRange(sp, "from", "to");
  if (range) where.createdAt = range;

  const { skip, take, page, pageSize } = pagination(sp, { pageSize: 30 });
  const order = sort(sp, ["createdAt"], { field: "createdAt", direction: "desc" });

  const [items, total, actionsDistinct] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { [order.field]: order.direction },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where: { companyId },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    actions: actionsDistinct.map((a) => a.action),
  };
}
