import { prisma } from "@/lib/db";
import { notFound } from "@/lib/http";
import { formatCurrency, formatDate } from "@/lib/format";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** Lista as notificacoes do usuario (mais recentes) e o total de nao lidas. */
export async function listNotifications(userId: string, limit = 40) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unreadCount };
}

/** Marca notificacoes como lidas (por ids ou todas as nao lidas do usuario). */
export async function markNotificationsRead(
  userId: string,
  input: { ids?: string[]; all?: boolean },
) {
  const where = input.all
    ? { userId, readAt: null }
    : { userId, readAt: null, id: { in: input.ids ?? [] } };

  const result = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

/**
 * Cria a mesma notificacao para todos os usuarios ativos da empresa.
 * Usado para avisar a empresa sobre uma cobranca/mensalidade.
 */
export async function createCompanyNotifications(
  companyId: string,
  data: {
    title: string;
    body?: string | null;
    link?: string | null;
    type?: "INVOICE" | "INFO";
  },
) {
  const members = await prisma.membership.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { userId: true },
  });
  if (members.length === 0) return { created: 0 };

  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      companyId,
      type: (data.type ?? "INFO") as never,
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
    })),
  });
  return { created: members.length };
}

/**
 * Notifica os usuarios da empresa sobre uma cobranca.
 * Se `message` for enviada (texto do admin), ela vira o corpo da notificacao.
 */
export async function notifyInvoice(invoiceId: string, message?: string | null) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      companyId: true,
      description: true,
      amount: true,
      dueDate: true,
    },
  });
  if (!invoice) throw notFound("Fatura nao encontrada.");

  const body =
    message?.trim() ||
    `Valor ${formatCurrency(Number(invoice.amount))} · vencimento ${formatDate(
      invoice.dueDate,
    )}. Confira em "Minhas cobrancas".`;

  return createCompanyNotifications(invoice.companyId, {
    title: `Nova cobrança: ${invoice.description}`,
    body,
    link: "/minhas-cobrancas",
    type: "INVOICE",
  });
}
