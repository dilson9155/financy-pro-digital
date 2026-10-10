import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { agingReport } from "@/services/titles";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const auth = await requireApiAuth(PERMISSIONS.REPORTS_VIEW);
  const sp = searchParams(req);
  const direction = sp.direction === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
  const data = await agingReport(auth.companyId, direction);
  return jsonOk(data);
});
