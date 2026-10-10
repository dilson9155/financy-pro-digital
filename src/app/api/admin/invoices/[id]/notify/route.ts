import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireSuperAdminApi } from "@/lib/api";
import { notifyInvoice } from "@/services/notifications";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Envia a cobranca para as notificacoes do sistema dos usuarios da empresa.
 * O corpo opcional `{ message }` vira o texto da notificacao.
 */
export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  await requireSuperAdminApi();
  const id = (await ctx.params).id;
  const payload = (await req.json().catch(() => ({}))) as {
    message?: string;
  };
  const message =
    typeof payload.message === "string" ? payload.message : null;
  return jsonOk(await notifyInvoice(id, message));
});
