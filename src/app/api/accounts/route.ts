import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createAccountSchema } from "@/lib/validation";
import {
  createBankAccount,
  listBankAccounts,
} from "@/services/structure";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.BANK_ACCOUNTS_MANAGE);
  const data = await listBankAccounts(ctx.companyId, searchParams(req));
  return jsonOk(data);
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.BANK_ACCOUNTS_MANAGE);
  const body = createAccountSchema.parse(await req.json());
  const account = await createBankAccount(ctx.companyId, ctx.user.id, body);
  return jsonOk(account, 201);
});
