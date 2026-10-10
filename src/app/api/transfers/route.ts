import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { transferSchema } from "@/lib/validation";
import { createTransfer, listTransfers } from "@/services/transfers";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.TRANSFERS_VIEW);
  const data = await listTransfers(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.TRANSFERS_CREATE);
  const body = transferSchema.parse(await req.json());
  const transfer = await createTransfer(ctx.companyId, ctx.user.id, body);
  return jsonOk(transfer, 201);
});
