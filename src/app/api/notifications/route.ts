import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { listNotifications } from "@/services/notifications";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireApiAuth();
  return jsonOk(await listNotifications(ctx.user.id));
});
