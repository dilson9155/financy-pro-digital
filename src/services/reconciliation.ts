import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { D, round2 } from "@/lib/money";
import { conflict, notFound, badRequest } from "@/lib/http";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import type { statementImportSchema } from "@/lib/validation";
import { pagination, RawSearchParams, str } from "@/lib/filters";

type StatementImport = z.infer<typeof statementImportSchema>;

/** Importa um extrato bancario (CSV/OFX ja parseado) e cria as linhas. */
export async function importStatement(
  companyId: string,
  userId: string | null,
  input: StatementImport,
) {
  const account = await prisma.bankAccount.findFirst({
    where: { id: input.bankAccountId, companyId },
  });
  if (!account) throw notFound("Conta/caixa nao encontrada.");

  return prisma.$transaction(async (tx) => {
    const statement = await tx.bankStatement.create({
      data: {
        companyId,
        bankAccountId: input.bankAccountId,
        fileName: input.fileName ?? null,
        format: input.format,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        openingBalance:
          input.openingBalance !== undefined && input.openingBalance !== null
            ? round2(input.openingBalance)
            : null,
        closingBalance:
          input.closingBalance !== undefined && input.closingBalance !== null
            ? round2(input.closingBalance)
            : null,
        importedById: userId,
        lines: {
          create: input.lines.map((line) => ({
            companyId,
            bankAccountId: input.bankAccountId,
            date: line.date,
            description: line.description,
            amount: round2(line.amount),
            type: line.type,
            externalId: line.externalId ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.CREATE,
      entity: "BankStatement",
      entityId: statement.id,
      after: {
        fileName: statement.fileName,
        lineCount: statement.lines.length,
      },
    });

    return statement;
  });
}

/** Concilia uma linha do extrato com um lancamento do ledger. */
export async function reconcileLine(
  companyId: string,
  userId: string | null,
  lineId: string,
  transactionId: string,
) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.bankStatementLine.findFirst({
      where: { id: lineId, companyId },
    });
    if (!line) throw notFound("Linha de extrato nao encontrada.");
    if (line.status === "MATCHED") {
      throw conflict("Esta linha ja esta conciliada.");
    }

    const transaction = await tx.transaction.findFirst({
      where: { id: transactionId, companyId },
    });
    if (!transaction) throw notFound("Lancamento nao encontrado.");
    if (transaction.status === "REVERSED") {
      throw badRequest("Nao e possivel conciliar com um lancamento estornado.");
    }
    if (transaction.bankAccountId !== line.bankAccountId) {
      throw badRequest("A conta do lancamento difere da conta do extrato.");
    }
    if (transaction.type !== line.type) {
      throw badRequest("O tipo (entrada/saida) do lancamento difere do extrato.");
    }

    const updated = await tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "MATCHED", matchedTransactionId: transactionId },
    });

    const reconciliation = await tx.reconciliation.create({
      data: { companyId, lineId, transactionId, matchedById: userId },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.RECONCILE,
      entity: "BankStatementLine",
      entityId: lineId,
      before: { status: line.status },
      after: { status: "MATCHED", transactionId },
    });

    return { line: updated, reconciliation };
  });
}

/** Desfaz a conciliacao de uma linha. */
export async function unmatchLine(
  companyId: string,
  userId: string | null,
  lineId: string,
) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.bankStatementLine.findFirst({
      where: { id: lineId, companyId },
    });
    if (!line) throw notFound("Linha de extrato nao encontrada.");

    const active = await tx.reconciliation.findFirst({
      where: { lineId, undoneAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!active) throw conflict("Nao ha conciliacao ativa para esta linha.");

    await tx.reconciliation.update({
      where: { id: active.id },
      data: { undoneAt: new Date(), undoneById: userId },
    });

    const updated = await tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "PENDING", matchedTransactionId: null },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UNRECONCILE,
      entity: "BankStatementLine",
      entityId: lineId,
      before: { status: line.status },
      after: { status: "PENDING" },
    });

    return updated;
  });
}

/** Marca uma linha como ignorada (ex: tarifa irrelevante ja conhecida). */
export async function ignoreLine(
  companyId: string,
  userId: string | null,
  lineId: string,
) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.bankStatementLine.findFirst({
      where: { id: lineId, companyId },
    });
    if (!line) throw notFound("Linha de extrato nao encontrada.");

    const updated = await tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "IGNORED" },
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "BankStatementLine",
      entityId: lineId,
      before: { status: line.status },
      after: { status: "IGNORED" },
    });

    return updated;
  });
}

export async function listStatements(
  companyId: string,
  sp: RawSearchParams,
) {
  const where: Prisma.BankStatementWhereInput = { companyId };
  const bankAccountId = str(sp, "bankAccountId");
  if (bankAccountId) where.bankAccountId = bankAccountId;

  const { skip, take, page, pageSize } = pagination(sp);
  const [items, total] = await Promise.all([
    prisma.bankStatement.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        bankAccount: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.bankStatement.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getStatement(companyId: string, statementId: string) {
  const statement = await prisma.bankStatement.findFirst({
    where: { id: statementId, companyId },
    include: {
      bankAccount: { select: { id: true, name: true, type: true } },
      lines: { orderBy: { date: "asc" } },
    },
  });
  if (!statement) throw notFound("Extrato nao encontrado.");

  // Candidatos a conciliacao: lancamentos da mesma conta e mesma direcao.
  const candidateTransactions = await prisma.transaction.findMany({
    where: {
      companyId,
      bankAccountId: statement.bankAccountId,
      status: "POSTED",
    },
    orderBy: { date: "desc" },
    take: 500,
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      type: true,
      origin: true,
    },
  });

  const reconciledIds = new Set(
    statement.lines
      .map((l) => l.matchedTransactionId)
      .filter((v): v is string => Boolean(v)),
  );

  const pending = statement.lines.filter((l) => l.status === "PENDING");

  // Sugestoes automaticas: mesmo tipo e mesmo valor (tolerancia 0,01).
  const suggestions = pending.map((line) => {
    const match = candidateTransactions
      .filter(
        (t) =>
          t.type === line.type &&
          !reconciledIds.has(t.id) &&
          D(t.amount).minus(line.amount).abs().lessThanOrEqualTo(0.01),
      )
      .sort(
        (a, b) =>
          Math.abs(new Date(a.date).getTime() - new Date(line.date).getTime()) -
          Math.abs(new Date(b.date).getTime() - new Date(line.date).getTime()),
      )[0];
    return {
      lineId: line.id,
      suggestedTransactionId: match?.id ?? null,
      confidence: match ? 90 : 0,
    };
  });

  return { statement, candidates: candidateTransactions, suggestions };
}
