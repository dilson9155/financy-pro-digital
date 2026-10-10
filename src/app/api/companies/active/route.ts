import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, route, forbidden } from "@/lib/http";
import { getAuthContext, setActiveCompany } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ companyId: z.string().uuid() });

export const POST = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  if (!ctx) throw forbidden("Nao autenticado.");
  const { companyId } = schema.parse(await req.json());
  if (!ctx.memberships.some((m) => m.companyId === companyId)) {
    throw forbidden("Voce nao tem acesso a esta empresa.");
  }
  await setActiveCompany(companyId);
  return jsonOk({ companyId });
});
