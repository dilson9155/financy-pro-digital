import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { incomeStatement } from "@/services/reports";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const auth = await requireApiAuth(PERMISSIONS.REPORTS_VIEW);
  const data = await incomeStatement(auth.companyId, searchParams(req));
  return jsonOk(data);
});
