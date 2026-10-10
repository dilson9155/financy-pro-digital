import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { roleSchema } from "@/lib/validation";
import { createRole, listRoles } from "@/services/roles";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireApiAuth(PERMISSIONS.USERS_VIEW);
  const data = await listRoles(ctx.companyId);
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.ROLES_MANAGE);
  const body = roleSchema.parse(await req.json());
  const role = await createRole(ctx.companyId, ctx.user.id, body);
  return jsonOk(role, 201);
});
