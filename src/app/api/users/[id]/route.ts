import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { updateUserProfile } from "@/services/users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(2).max(160).optional(),
  email: z.string().email().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).optional(),
});

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireApiAuth(PERMISSIONS.USERS_MANAGE);
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());
  const updated = await updateUserProfile(auth.user.id, id, body);
  return jsonOk(updated);
});
