import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { listAuditLogs } from "@/services/audit-query";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.AUDIT_VIEW);
  const data = await listAuditLogs(ctx.companyId, searchParams(req));
  return jsonOk(data);
});
