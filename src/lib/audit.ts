import type { Prisma, PrismaClient } from "@prisma/client";

/** Cliente Prisma ou transacao interativa. */
export type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  // Decimal, Date, BigInt nao sao aceitos diretamente: normalizamos por JSON.
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  ) as Prisma.InputJsonValue;
}

/**
 * Registra um evento na trilha de auditoria.
 * Deve ser chamado DENTRO da mesma transacao da operacao auditada para que a
 * trilha seja consistente (rollback conjunto em caso de falha).
 */
export async function recordAudit(
  client: PrismaLike,
  entry: AuditEntry,
): Promise<void> {
  await client.auditLog.create({
    data: {
      companyId: entry.companyId ?? null,
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: toJson(entry.before),
      after: toJson(entry.after),
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

export const AUDIT_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  SETTLE: "SETTLE",
  REVERSE: "REVERSE",
  CANCEL: "CANCEL",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  LOGIN_FAILED: "LOGIN_FAILED",
  TRANSFER: "TRANSFER",
  RECONCILE: "RECONCILE",
  UNRECONCILE: "UNRECONCILE",
  BACKUP: "BACKUP",
  ROLE_CHANGE: "ROLE_CHANGE",
} as const;
