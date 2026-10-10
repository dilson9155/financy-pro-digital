import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listSettlements } from "@/services/settlements";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.TRANSACTIONS_VIEW);
  const data = await listSettlements(ctx.companyId, searchParams(req));
  return jsonOk(data);
});
