import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { categorySchema } from "@/lib/validation";
import { createCategory, listCategories } from "@/services/structure";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.CATEGORIES_MANAGE);
  const data = await listCategories(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.CATEGORIES_MANAGE);
  const body = categorySchema.parse(await req.json());
  const created = await createCategory(ctx.companyId, ctx.user.id, body);
  return jsonOk(created, 201);
});
