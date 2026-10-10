import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createAccountSchema } from "@/lib/validation";
import { deleteBankAccount, updateBankAccount } from "@/services/structure";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.BANK_ACCOUNTS_MANAGE);
  const { id } = await ctx.params;
  const body = createAccountSchema.partial().parse(await req.json());
  const updated = await updateBankAccount(auth.companyId, auth.user.id, id, body);
  return jsonOk(updated);
});

export const DELETE = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.BANK_ACCOUNTS_MANAGE);
  const { id } = await ctx.params;
  await deleteBankAccount(auth.companyId, auth.user.id, id);
  return jsonOk({ deleted: true });
});
