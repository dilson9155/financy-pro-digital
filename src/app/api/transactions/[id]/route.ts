import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { updateTransactionSchema } from "@/lib/validation";
import {
  deleteManualTransaction,
  updateManualTransaction,
} from "@/services/transactions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.TRANSACTIONS_UPDATE);
  const { id } = await ctx.params;
  const body = updateTransactionSchema.parse(await req.json());
  const updated = await updateManualTransaction(
    auth.companyId,
    auth.user.id,
    id,
    body,
  );
  return jsonOk(updated);
});

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.TRANSACTIONS_DELETE);
  const { id } = await ctx.params;
  const result = await deleteManualTransaction(
    auth.companyId,
    auth.user.id,
    id,
  );
  return jsonOk(result);
});
