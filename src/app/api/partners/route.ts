import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { partnerSchema } from "@/lib/validation";
import { createPartner, listPartners } from "@/services/structure";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.PARTNERS_MANAGE);
  const data = await listPartners(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.PARTNERS_MANAGE);
  const body = partnerSchema.parse(await req.json());
  const created = await createPartner(ctx.companyId, ctx.user.id, body);
  return jsonOk(created, 201);
});
