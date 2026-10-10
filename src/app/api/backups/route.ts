import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createBackup, listBackups } from "@/services/backup";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.BACKUPS_VIEW);
  const data = await listBackups(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async () => {
  const ctx = await requireApiAuth(PERMISSIONS.BACKUPS_MANAGE);
  const backup = await createBackup(ctx.companyId, ctx.user.id);
  return jsonOk(backup, 201);
});
