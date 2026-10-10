import { jsonOk, route, unauthorized } from "@/lib/http";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await getAuthContext();
  if (!ctx) throw unauthorized();
  return jsonOk({
    user: ctx.user,
    companyId: ctx.companyId,
    memberships: ctx.memberships,
    permissions: Array.from(ctx.permissions),
  });
});
