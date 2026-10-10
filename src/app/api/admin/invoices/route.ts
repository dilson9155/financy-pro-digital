import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireSuperAdminApi, searchParams } from "@/lib/api";
import { invoiceCreateSchema } from "@/lib/validation";
import { createInvoice, listInvoicesAdmin } from "@/services/admin";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  await requireSuperAdminApi();
  return jsonOk(await listInvoicesAdmin(searchParams(req)));
});

export const POST = route(async (req: NextRequest) => {
  const actor = await requireSuperAdminApi();
  const body = invoiceCreateSchema.parse(await req.json());
  return jsonOk(await createInvoice(actor.user.id, body));
});
