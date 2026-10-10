import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { accountPlanSchema } from "@/lib/validation";
import { createAccountPlan, listAccountPlans } from "@/services/structure";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.ACCOUNT_PLAN_MANAGE);
  const data = await listAccountPlans(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.ACCOUNT_PLAN_MANAGE);
  const body = accountPlanSchema.parse(await req.json());
  const created = await createAccountPlan(ctx.companyId, ctx.user.id, body);
  return jsonOk(created, 201);
});
