import { jsonOk, route } from "@/lib/http";
import { destroySession, getAuthContext } from "@/lib/auth";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const ctx = await getAuthContext();
  if (ctx) {
    await recordAudit(prisma, {
      companyId: ctx.companyId,
      userId: ctx.user.id,
      action: AUDIT_ACTIONS.LOGOUT,
      entity: "User",
      entityId: ctx.user.id,
    });
  }
  await destroySession();
  return jsonOk({ ok: true });
});
