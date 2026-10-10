import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { reverseSettlementSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { forbidden } from "@/lib/http";
import { reverseSettlement } from "@/services/settlements";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: { title: { select: { direction: true } } },
  });
  if (!settlement) {
    throw forbidden("Baixa nao encontrada.");
  }
  const permission =
    settlement.title.direction === "PAYABLE"
      ? PERMISSIONS.PAYABLES_REVERSE
      : PERMISSIONS.RECEIVABLES_REVERSE;
  const auth = await requireApiAuth(permission);
  const body = reverseSettlementSchema.parse(await req.json());
  const result = await reverseSettlement(
    auth.companyId,
    auth.user.id,
    id,
    body.reason,
  );
  return jsonOk(result);
});
