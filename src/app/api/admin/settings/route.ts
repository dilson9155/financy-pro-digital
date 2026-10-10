import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireSuperAdminApi } from "@/lib/api";
import { platformBillingSchema } from "@/lib/validation";
import { getBillingSettings, saveBillingSettings } from "@/services/admin";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireSuperAdminApi();
  return jsonOk(await getBillingSettings());
});

export const PUT = route(async (req: NextRequest) => {
  const actor = await requireSuperAdminApi();
  const body = platformBillingSchema.parse(await req.json());
  return jsonOk(await saveBillingSettings(actor.user.id, body));
});
