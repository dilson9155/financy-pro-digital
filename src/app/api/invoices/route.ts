import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { listCompanyInvoices } from "@/services/billing";

export const dynamic = "force-dynamic";

/** Cobrancas/mensalidades da empresa ativa (visao do tenant). */
export const GET = route(async () => {
  const ctx = await requireApiAuth();
  return jsonOk(await listCompanyInvoices(ctx.companyId));
});
