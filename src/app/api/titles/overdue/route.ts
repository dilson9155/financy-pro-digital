import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { scanOverdueTitles } from "@/services/overdue";

export const dynamic = "force-dynamic";

/**
 * Varredura de titulos vencidos (em aberto/parcial e vencimento < hoje),
 * incluindo contas a pagar e a receber, com breakdown por direcao e por
 * faixa de atraso.
 */
export const GET = route(async () => {
  const ctx = await requireApiAuth();
  return jsonOk(await scanOverdueTitles(ctx.companyId));
});
