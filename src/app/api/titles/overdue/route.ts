import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { scanOverdueTitles, type OverdueDirection } from "@/services/overdue";

export const dynamic = "force-dynamic";

/** Varredura de titulos vencidos (em aberto/parcial e vencimento < hoje). */
export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth();
  const sp = searchParams(req);
  const raw = String(sp.direction ?? "ALL").toUpperCase();
  const direction: OverdueDirection =
    raw === "RECEIVABLE" || raw === "PAYABLE" ? raw : "ALL";
  return jsonOk(await scanOverdueTitles(ctx.companyId, direction));
});
