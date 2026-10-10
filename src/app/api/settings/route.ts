import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { getSettings, setSetting } from "@/services/settings";
import { updateCompany } from "@/services/companies";
import { getCompany } from "@/services/companies";
import { imageDataUrl } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const ctx = await requireApiAuth(PERMISSIONS.SETTINGS_MANAGE);
  const [settings, company] = await Promise.all([
    getSettings(ctx.companyId),
    getCompany(ctx.companyId),
  ]);
  return jsonOk({ settings, company });
});

const schema = z.object({
  key: z.string().min(1).max(120),
  value: z.unknown(),
  company: z
    .object({
      name: z.string().min(2).max(200).optional(),
      legalName: z.string().max(200).optional().nullable(),
      document: z.string().max(30).optional().nullable(),
      email: z.string().email().optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      address: z.string().max(300).optional().nullable(),
      currency: z.string().length(3).optional(),
      timezone: z.string().max(60).optional(),
      logoUrl: imageDataUrl.nullable().optional(),
    })
    .optional(),
});

export const POST = route(async (req: NextRequest) => {
  const ctx = await requireApiAuth(PERMISSIONS.SETTINGS_MANAGE);
  const body = schema.parse(await req.json());
  if (body.company) {
    await updateCompany(ctx.companyId, ctx.user.id, body.company);
  }
  const saved = await setSetting(
    ctx.companyId,
    ctx.user.id,
    body.key,
    body.value,
  );
  return jsonOk(saved);
});
