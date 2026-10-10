import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { statementImportSchema } from "@/lib/validation";
import { importStatement, listStatements } from "@/services/reconciliation";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.RECONCILIATION_VIEW);
  const data = await listStatements(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.RECONCILIATION_MANAGE);
  const body = statementImportSchema.parse(await req.json());
  const statement = await importStatement(ctx.companyId, ctx.user.id, body);
  return jsonOk(statement, 201);
});
