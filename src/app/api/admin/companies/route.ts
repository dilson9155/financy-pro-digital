import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireSuperAdminApi, searchParams } from "@/lib/api";
import { listCompaniesAdmin } from "@/services/admin";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  await requireSuperAdminApi();
  const data = await listCompaniesAdmin(searchParams(req));
  return jsonOk(data);
});
