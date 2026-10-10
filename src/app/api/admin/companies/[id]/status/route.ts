import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireSuperAdminApi } from "@/lib/api";
import { adminCompanyStatusSchema } from "@/lib/validation";
import { setCompanyStatus } from "@/services/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const actor = await requireSuperAdminApi();
  const body = adminCompanyStatusSchema.parse(await req.json());
  const id = (await ctx.params).id;
  return jsonOk(
    await setCompanyStatus(id, actor.user.id, body.status, body.reason),
  );
});
