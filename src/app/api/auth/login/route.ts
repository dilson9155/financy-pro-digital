import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { clientMeta } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { login } from "@/services/authentication";
import { listCompaniesForUser } from "@/services/companies";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const body = loginSchema.parse(await req.json());
  const user = await login(body, clientMeta(req));
  const companies = await listCompaniesForUser(user.id);
  return jsonOk({
    id: user.id,
    name: user.name,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    companies,
  });
});
