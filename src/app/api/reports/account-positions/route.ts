import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { accountPositions } from "@/services/reports";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireApiAuth(PERMISSIONS.REPORTS_VIEW);
  const data = await accountPositions(ctx.companyId);
  return jsonOk(data);
});
