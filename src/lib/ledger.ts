import { Prisma } from "@prisma/client";
import type {
  Transaction,
  TransactionOrigin,
  TransactionType,
} from "@prisma/client";
import { D, MoneyValue, isGreaterThan, round2 } from "./money";
import { badRequest, conflict, notFound } from "./http";

export interface PostTransactionInput {
  companyId: string;
  bankAccountId: string;
  type: TransactionType;
  origin: TransactionOrigin;
  amount: MoneyValue;
  date: Date;
  competenceDate?: Date | null;
  description: string;
  categoryId?: string | null;
  costCenterId?: string | null;
  accountPlanId?: string | null;
  partnerId?: string | null;
  titleId?: string | null;
  installmentId?: string | null;
  settlementId?: string | null;
  transferId?: string | null;
  reversalOfId?: string | null;
  createdById?: string | null;
  /** Se informado, valida concorrencia otimista contra a versao da conta. */
  expectedAccountVersion?: number;
}

interface LockedAccountRow {
  id: string;
  currentBalance: Prisma.Decimal;
  version: number;
}

/**
 * Bloqueia a conta/caixa (SELECT ... FOR UPDATE) dentro da transacao atual.
 * Serializa movimentos concorrentes sobre a mesma conta, garantindo que o
 * saldo nunca seja corrompido por duas operacoes simultaneas.
 */
export async function lockBankAccount(
  tx: Prisma.TransactionClient,
  companyId: string,
  bankAccountId: string,
  expectedVersion?: number,
): Promise<LockedAccountRow> {
  const rows = await tx.$queryRaw<LockedAccountRow[]>`
    SELECT id, "currentBalance", "version"
    FROM "bank_accounts"
    WHERE id = ${bankAccountId}::uuid AND "companyId" = ${companyId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw notFound("Conta/caixa nao encontrada.");
  if (expectedVersion !== undefined && row.version !== expectedVersion) {
    throw conflict(
      "A conta foi alterada por outra operacao. Recarregue e tente novamente.",
      { currentVersion: row.version },
    );
  }
  return row;
}

/**
 * Registra um movimento no ledger e atualiza o saldo da conta de forma atomica.
 * DEVE ser executado dentro de uma transacao interativa (prisma.$transaction).
 */
export async function postTransaction(
  tx: Prisma.TransactionClient,
  input: PostTransactionInput,
): Promise<Transaction> {
  const amount = round2(input.amount);
  if (!isGreaterThan(amount, 0)) {
    throw badRequest("O valor da movimentacao deve ser maior que zero.");
  }

  const account = await lockBankAccount(
    tx,
    input.companyId,
    input.bankAccountId,
    input.expectedAccountVersion,
  );

  const currentBalance = D(account.currentBalance);
  const newBalance =
    input.type === "INFLOW"
      ? currentBalance.plus(amount)
      : currentBalance.minus(amount);

  const created = await tx.transaction.create({
    data: {
      companyId: input.companyId,
      type: input.type,
      origin: input.origin,
      amount,
      balanceAfter: newBalance,
      date: input.date,
      competenceDate: input.competenceDate ?? input.date,
      description: input.description,
      bankAccountId: input.bankAccountId,
      categoryId: input.categoryId ?? null,
      costCenterId: input.costCenterId ?? null,
      accountPlanId: input.accountPlanId ?? null,
      partnerId: input.partnerId ?? null,
      titleId: input.titleId ?? null,
      installmentId: input.installmentId ?? null,
      settlementId: input.settlementId ?? null,
      transferId: input.transferId ?? null,
      reversalOfId: input.reversalOfId ?? null,
      createdById: input.createdById ?? null,
    },
  });

  await tx.bankAccount.update({
    where: { id: input.bankAccountId },
    data: {
      currentBalance: newBalance,
      version: { increment: 1 },
    },
  });

  return created;
}

export interface ReverseTransactionInput {
  companyId: string;
  transactionId: string;
  description?: string;
  createdById?: string | null;
}

/**
 * Estorna um lancamento gerando a contrapartida no ledger (partida dobrada) e
 * marcando o original como REVERSED. Nunca apaga o historico.
 */
export async function reverseTransaction(
  tx: Prisma.TransactionClient,
  input: ReverseTransactionInput,
): Promise<Transaction> {
  const original = await tx.transaction.findFirst({
    where: { id: input.transactionId, companyId: input.companyId },
  });
  if (!original) throw notFound("Lancamento nao encontrado.");
  if (original.status === "REVERSED") {
    throw conflict("Este lancamento ja foi estornado.");
  }

  const counterType: TransactionType =
    original.type === "INFLOW" ? "OUTFLOW" : "INFLOW";

  const counter = await postTransaction(tx, {
    companyId: original.companyId,
    bankAccountId: original.bankAccountId,
    type: counterType,
    origin: "REVERSAL",
    amount: original.amount,
    date: new Date(),
    competenceDate: original.competenceDate,
    description:
      input.description ?? `Estorno do lancamento ${original.id.slice(0, 8)}`,
    categoryId: original.categoryId,
    costCenterId: original.costCenterId,
    accountPlanId: original.accountPlanId,
    partnerId: original.partnerId,
    titleId: original.titleId,
    installmentId: original.installmentId,
    settlementId: original.settlementId,
    transferId: original.transferId,
    reversalOfId: original.id,
    createdById: input.createdById ?? null,
  });

  await tx.transaction.update({
    where: { id: original.id },
    data: { status: "REVERSED", version: { increment: 1 } },
  });

  return counter;
}
