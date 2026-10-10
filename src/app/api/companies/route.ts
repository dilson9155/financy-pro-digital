import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, route, unauthorized } from "@/lib/http";
import { getAuthContext } from "@/lib/auth";
import { createCompanyForUser, listCompaniesForUser } from "@/services/companies";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await getAuthContext();
  if (!ctx) throw unauthorized();
  const companies = await listCompaniesForUser(ctx.user.id);
  return jsonOk({ companies, activeCompanyId: ctx.companyId });
});

const createSchema = z.object({
  name: z.string().min(2).max(200),
  legalName: z.string().max(200).optional().nullable(),
  document: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await getAuthContext();
  if (!ctx) throw unauthorized();
  const body = createSchema.parse(await req.json());
  const company = await createCompanyForUser(ctx.user.id, body);
  return jsonOk(company);
});
