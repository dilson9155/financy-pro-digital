import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { resetUserPassword } from "@/services/users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.USERS_MANAGE);
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());
  await resetUserPassword(auth.user.id, id, body.password);
  return jsonOk({ reset: true });
});
