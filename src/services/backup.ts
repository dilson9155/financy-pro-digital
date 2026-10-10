import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { notFound } from "@/lib/http";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { pagination, RawSearchParams, str } from "@/lib/filters";

/**
 * Backup logico por empresa: exporta os dados operacionais para um arquivo JSON
 * versionado por timestamp. Nao inclui segredos. Registra a operacao (auditoria)
 * e o resultado na tabela backups.
 */
export async function createBackup(
  companyId: string,
  userId: string | null,
) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw notFound("Empresa nao encontrada.");

  const backup = await prisma.backup.create({
    data: {
      companyId,
      fileName: "",
      status: "RUNNING",
      requestedById: userId,
    },
  });

  try {
    const [
      accountPlans,
      categories,
      costCenters,
      partners,
      bankAccounts,
      titles,
      installments,
      settlements,
      reversals,
      transactions,
      transfers,
      settings,
    ] = await Promise.all([
      prisma.accountPlan.findMany({ where: { companyId } }),
      prisma.category.findMany({ where: { companyId } }),
      prisma.costCenter.findMany({ where: { companyId } }),
      prisma.partner.findMany({ where: { companyId } }),
      prisma.bankAccount.findMany({ where: { companyId } }),
      prisma.financialTitle.findMany({ where: { companyId } }),
      prisma.titleInstallment.findMany({ where: { companyId } }),
      prisma.settlement.findMany({ where: { companyId } }),
      prisma.settlementReversal.findMany({ where: { companyId } }),
      prisma.transaction.findMany({ where: { companyId } }),
      prisma.transfer.findMany({ where: { companyId } }),
      prisma.setting.findMany({ where: { companyId } }),
    ]);

    const payload = {
      meta: {
        company: {
          id: company.id,
          name: company.name,
          document: company.document,
          currency: company.currency,
        },
        generatedAt: new Date().toISOString(),
        generator: "Financy Pro Digital",
        version: 1,
      },
      accountPlans,
      categories,
      costCenters,
      partners,
      bankAccounts,
      titles,
      installments,
      settlements,
      reversals,
      transactions,
      transfers,
      settings,
    };

    const recordCount =
      accountPlans.length +
      categories.length +
      costCenters.length +
      partners.length +
      bankAccounts.length +
      titles.length +
      installments.length +
      settlements.length +
      reversals.length +
      transactions.length +
      transfers.length +
      settings.length;

    const env = getEnv();
    const dir = path.isAbsolute(env.BACKUP_DIR)
      ? env.BACKUP_DIR
      : path.join(process.cwd(), env.BACKUP_DIR);
    await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup_${company.id.slice(0, 8)}_${stamp}.json`;
    const filePath = path.join(dir, fileName);
    const json = JSON.stringify(payload, null, 2);
    await writeFile(filePath, json, "utf8");

    const updated = await prisma.backup.update({
      where: { id: backup.id },
      data: {
        fileName,
        storagePath: filePath,
        sizeBytes: Buffer.byteLength(json, "utf8"),
        recordCount,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await recordAudit(prisma, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.BACKUP,
      entity: "Backup",
      entityId: backup.id,
      after: { fileName, recordCount },
    });

    return updated;
  } catch (error) {
    await prisma.backup.update({
      where: { id: backup.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function listBackups(companyId: string, sp: RawSearchParams) {
  const where = { companyId };
  const status = str(sp, "status");
  const { skip, take, page, pageSize } = pagination(sp);
  const [items, total] = await Promise.all([
    prisma.backup.findMany({
      where: status ? { ...where, status: status as never } : where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.backup.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
