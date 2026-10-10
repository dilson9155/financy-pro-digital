import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { accountPlanSchema } from "@/lib/validation";
import { deleteAccountPlan, updateAccountPlan } from "@/services/structure";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.ACCOUNT_PLAN_MANAGE);
  const { id } = await ctx.params;
  const body = accountPlanSchema.partial().parse(await req.json());
  return jsonOk(await updateAccountPlan(auth.companyId, auth.user.id, id, body));
});

export const DELETE = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.ACCOUNT_PLAN_MANAGE);
  const { id } = await ctx.params;
  await deleteAccountPlan(auth.companyId, auth.user.id, id);
  return jsonOk({ deleted: true });
});
