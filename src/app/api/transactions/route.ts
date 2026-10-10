import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createTransactionSchema } from "@/lib/validation";
import {
  createManualTransaction,
  listTransactions,
} from "@/services/transactions";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.TRANSACTIONS_VIEW);
  const data = await listTransactions(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.TRANSACTIONS_CREATE);
  const body = createTransactionSchema.parse(await req.json());
  const created = await createManualTransaction(ctx.companyId, ctx.user.id, body);
  return jsonOk(created, 201);
});
