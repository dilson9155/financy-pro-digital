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

export const PIX_KEY_TYPE_LABELS: Record<string, string> = {
  CPF_CNPJ: "CPF/CNPJ",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  RANDOM: "Chave aleatoria",
};

/** Mantem apenas os digitos do valor informado. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Aplica a mascara de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00). */
export function maskCpfCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    const p1 = d.slice(0, 3);
    const p2 = d.slice(3, 6);
    const p3 = d.slice(6, 9);
    const p4 = d.slice(9, 11);
    let out = p1;
    if (p2) out += `.${p2}`;
    if (p3) out += `.${p3}`;
    if (p4) out += `-${p4}`;
    return out;
  }
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `/${p4}`;
  if (p5) out += `-${p5}`;
  return out;
}

/** Aplica a mascara de telefone: (00) 0000-0000 ou (00) 00000-0000. */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (!ddd) return "";
  if (!rest) return `(${ddd}`;
  const split = d.length > 10 ? 5 : 4;
  const a = rest.slice(0, split);
  const b = rest.slice(split, split + 4);
  return b ? `(${ddd}) ${a}-${b}` : `(${ddd}) ${a}`;
}

/**
 * Formata a chave Pix conforme o tipo escolhido.
 * Usada tanto no campo (enquanto digita) quanto na exibicao.
 */
export function formatPixKey(
  type: string | null | undefined,
  value: string | null | undefined,
): string {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";
  switch (type) {
    case "CPF_CNPJ":
      return maskCpfCnpj(v);
    case "PHONE":
      return maskPhone(v);
    case "EMAIL":
      return v.toLowerCase();
    default:
      return v;
  }
}

/** Rotulo composto para exibicao: "CPF/CNPJ: 000.000.000-00". */
export function formatPixLabel(
  type: string | null | undefined,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  const label = PIX_KEY_TYPE_LABELS[type ?? ""] ?? "Chave";
  return `${label}: ${formatPixKey(type, value)}`;
}

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
