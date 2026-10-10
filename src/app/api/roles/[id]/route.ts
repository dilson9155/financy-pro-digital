import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { roleSchema } from "@/lib/validation";
import { deleteRole, updateRole } from "@/services/roles";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.ROLES_MANAGE);
  const { id } = await ctx.params;
  const body = roleSchema.parse(await req.json());
  return jsonOk(await updateRole(auth.companyId, auth.user.id, id, body));
});

export const DELETE = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.ROLES_MANAGE);
  const { id } = await ctx.params;
  await deleteRole(auth.companyId, auth.user.id, id);
  return jsonOk({ deleted: true });
});
