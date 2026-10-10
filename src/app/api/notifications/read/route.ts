import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { notificationReadSchema } from "@/lib/validation";
import { markNotificationsRead } from "@/services/notifications";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth();
  const body = notificationReadSchema.parse(await req.json().catch(() => ({})));
  return jsonOk(await markNotificationsRead(ctx.user.id, body));
});
