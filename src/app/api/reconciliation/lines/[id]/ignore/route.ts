import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { ignoreLine } from "@/services/reconciliation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.RECONCILIATION_MANAGE);
  const { id } = await ctx.params;
  const line = await ignoreLine(auth.companyId, auth.user.id, id);
  return jsonOk(line);
});
