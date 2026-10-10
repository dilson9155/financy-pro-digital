import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";

export async function getSettings(companyId: string): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany({ where: { companyId } });
  const out: Record<string, unknown> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function setSetting(
  companyId: string,
  userId: string | null,
  key: string,
  value: unknown,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.setting.findUnique({
      where: { companyId_key: { companyId, key } },
    });
    const saved = await tx.setting.upsert({
      where: { companyId_key: { companyId, key } },
      update: { value: value as never },
      create: { companyId, key, value: value as never },
    });
    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Setting",
      entityId: saved.id,
      before: before ? { value: before.value } : null,
      after: { key, value },
    });
    return saved;
  });
}
