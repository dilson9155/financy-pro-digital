import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireSuperAdminApi } from "@/lib/api";
import { invoiceUpdateSchema } from "@/lib/validation";
import { deleteInvoice, updateInvoice } from "@/services/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const actor = await requireSuperAdminApi();
  const body = invoiceUpdateSchema.parse(await req.json());
  const id = (await ctx.params).id;
  return jsonOk(await updateInvoice(id, actor.user.id, body));
});

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const actor = await requireSuperAdminApi();
  const id = (await ctx.params).id;
  return jsonOk(await deleteInvoice(id, actor.user.id));
});
