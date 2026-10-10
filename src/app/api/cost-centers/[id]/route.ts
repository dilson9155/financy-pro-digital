import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { costCenterSchema } from "@/lib/validation";
import { deleteCostCenter, updateCostCenter } from "@/services/structure";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.COST_CENTERS_MANAGE);
  const { id } = await ctx.params;
  const body = costCenterSchema.partial().parse(await req.json());
  return jsonOk(await updateCostCenter(auth.companyId, auth.user.id, id, body));
});

export const DELETE = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.COST_CENTERS_MANAGE);
  const { id } = await ctx.params;
  await deleteCostCenter(auth.companyId, auth.user.id, id);
  return jsonOk({ deleted: true });
});
