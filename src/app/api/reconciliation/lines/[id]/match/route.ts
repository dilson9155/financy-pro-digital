import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { reconcileSchema } from "@/lib/validation";
import { reconcileLine } from "@/services/reconciliation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.RECONCILIATION_MANAGE);
  const { id } = await ctx.params;
  const body = reconcileSchema.parse(await req.json());
  const result = await reconcileLine(
    auth.companyId,
    auth.user.id,
    id,
    body.transactionId,
  );
  return jsonOk(result);
});
