import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getStatement } from "@/services/reconciliation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.RECONCILIATION_VIEW);
  const { id } = await ctx.params;
  const data = await getStatement(auth.companyId, id);
  return jsonOk(data);
});
