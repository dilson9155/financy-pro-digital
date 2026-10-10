import { format as formatDateFns, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Formata um valor monetario em BRL. */
export function formatCurrency(
  value: number | string,
  currency = "BRL",
): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(n);
}

/** Formata data (Date | ISO string | null) no padrao dd/MM/yyyy. */
export function formatDate(
  value: Date | string | null | undefined,
  pattern = "dd/MM/yyyy",
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateFns(date, pattern, { locale: ptBR });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  return formatDate(value, "dd/MM/yyyy HH:mm");
}

/** Formata tamanho de bytes em unidade legivel. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Percentual com 1 casa. */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

export const TITLE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Em aberto",
  PARTIAL: "Parcial",
  PAID: "Liquidado",
  CANCELED: "Cancelado",
  REVERSED: "Estornado",
};

export const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Em aberto",
  PARTIAL: "Parcial",
  PAID: "Liquidada",
  CANCELED: "Cancelada",
};

export const SETTLEMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  BANK_TRANSFER: "Transferencia",
  BOLETO: "Boleto",
  CARD: "Cartao",
  CHECK: "Cheque",
  OTHER: "Outro",
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  INFLOW: "Entrada",
  OUTFLOW: "Saida",
};

export const TRANSACTION_ORIGIN_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  PAYABLE_SETTLEMENT: "Baixa a pagar",
  RECEIVABLE_SETTLEMENT: "Baixa a receber",
  TRANSFER: "Transferencia",
  ADJUSTMENT: "Ajuste",
  OPENING_BALANCE: "Saldo inicial",
  REVERSAL: "Estorno",
};

export const BANK_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BANK: "Conta bancaria",
  CASH: "Caixa",
  INVESTMENT: "Investimento",
  OTHER: "Outro",
};

export const ACCOUNT_PLAN_TYPE_LABELS: Record<string, string> = {
  ASSET: "Ativo",
  LIABILITY: "Passivo",
  EQUITY: "Patrimonio liquido",
  REVENUE: "Receita",
  EXPENSE: "Despesa",
};

export const CATEGORY_TYPE_LABELS: Record<string, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
};

export const PARTNER_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  SUPPLIER: "Fornecedor",
  BOTH: "Cliente/Fornecedor",
};

export const RECONCILIATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  MATCHED: "Conciliado",
  IGNORED: "Ignorado",
  ADJUSTED: "Ajustado",
};

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  COMPLETED: "Concluida",
  CANCELED: "Cancelada",
  REVERSED: "Estornada",
};

export const BACKUP_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  RUNNING: "Em andamento",
  COMPLETED: "Concluido",
  FAILED: "Falhou",
};
