import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { clientMeta } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { register } from "@/services/authentication";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const body = registerSchema.parse(await req.json());
  const { user, company } = await register(body, clientMeta(req));
  return jsonOk({
    id: user.id,
    name: user.name,
    email: user.email,
    company: { id: company.id, name: company.name },
  });
});
