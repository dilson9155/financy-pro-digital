import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { reverseSettlementSchema } from "@/lib/validation";
import { reverseTransfer } from "@/services/transfers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.TRANSFERS_REVERSE);
  const { id } = await ctx.params;
  const body = reverseSettlementSchema.parse(await req.json());
  const transfer = await reverseTransfer(
    auth.companyId,
    auth.user.id,
    id,
    body.reason,
  );
  return jsonOk(transfer);
});
