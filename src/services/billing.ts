import { prisma } from "@/lib/db";
import { effectiveInvoiceStatus, getBillingSettings } from "./admin";

/**
 * Lista as cobrancas/mensalidades da propria empresa (visao do tenant),
 * com resumo de valores em aberto/vencidos/pagos e os dados de pagamento
 * da plataforma (chave Pix, titular, banco, instrucoes).
 */
export async function listCompanyInvoices(companyId: string) {
  const [rows, settings] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId },
      orderBy: [{ dueDate: "desc" }],
    }),
    getBillingSettings(),
  ]);

  const items = rows.map((i) => ({
    ...i,
    status: effectiveInvoiceStatus(i),
  }));

  let openCount = 0;
  let overdueCount = 0;
  let paidCount = 0;
  let openAmount = 0;

  for (const i of items) {
    if (i.status === "PAID") {
      paidCount += 1;
    } else if (i.status === "CANCELED") {
      // ignora canceladas
    } else if (i.status === "OVERDUE") {
      overdueCount += 1;
      openCount += 1;
      openAmount += Number(i.amount);
    } else {
      openCount += 1;
      openAmount += Number(i.amount);
    }
  }

  return {
    items,
    summary: { openCount, overdueCount, paidCount, openAmount },
    payment: {
      pixKey: settings.pixKey,
      pixKeyType: settings.pixKeyType,
      pixHolder: settings.pixHolder,
      bankName: settings.bankName,
      paymentInstructions: settings.paymentInstructions,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
    },
  };
}
