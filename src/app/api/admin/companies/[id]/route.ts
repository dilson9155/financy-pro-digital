import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireSuperAdminApi } from "@/lib/api";
import { adminCompanyUpdateSchema } from "@/lib/validation";
import {
  deleteCompanyAdmin,
  getCompanyAdmin,
  updateCompanyAdmin,
} from "@/services/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  await requireSuperAdminApi();
  return jsonOk(await getCompanyAdmin((await ctx.params).id));
});

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const actor = await requireSuperAdminApi();
  const body = adminCompanyUpdateSchema.parse(await req.json());
  const id = (await ctx.params).id;
  return jsonOk(await updateCompanyAdmin(id, actor.user.id, body));
});

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const actor = await requireSuperAdminApi();
  const id = (await ctx.params).id;
  return jsonOk(await deleteCompanyAdmin(id, actor.user.id));
});
