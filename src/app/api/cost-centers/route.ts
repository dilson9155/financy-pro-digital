import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { costCenterSchema } from "@/lib/validation";
import { createCostCenter, listCostCenters } from "@/services/structure";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.COST_CENTERS_MANAGE);
  const data = await listCostCenters(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.COST_CENTERS_MANAGE);
  const body = costCenterSchema.parse(await req.json());
  const created = await createCostCenter(ctx.companyId, ctx.user.id, body);
  return jsonOk(created, 201);
});
