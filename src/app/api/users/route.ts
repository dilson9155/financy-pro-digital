import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createUserSchema } from "@/lib/validation";
import { createUserForCompany, listUsers } from "@/services/users";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.USERS_VIEW);
  const data = await listUsers(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.USERS_MANAGE);
  const body = createUserSchema.parse(await req.json());
  const result = await createUserForCompany(ctx.companyId, ctx.user.id, body);
  return jsonOk(result, 201);
});
