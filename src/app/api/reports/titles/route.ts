import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { titlesReport } from "@/services/reports";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const auth = await requireApiAuth(PERMISSIONS.REPORTS_VIEW);
  const sp = searchParams(req);
  const direction = sp.direction === "RECEIVABLE" ? "RECEIVABLE" : "PAYABLE";
  const data = await titlesReport(auth.companyId, direction, sp);
  return jsonOk(data);
});
