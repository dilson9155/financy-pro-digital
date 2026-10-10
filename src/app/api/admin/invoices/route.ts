import type { NextRequest } from "next/server";
import { jsonOk, route } from "@/lib/http";
import { requireSuperAdminApi, searchParams } from "@/lib/api";
import { invoiceCreateSchema } from "@/lib/validation";
import {
  createInvoice,
  createInvoiceSeries,
  listInvoicesAdmin,
} from "@/services/admin";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  await requireSuperAdminApi();
  return jsonOk(await listInvoicesAdmin(searchParams(req)));
});

export const POST = route(async (req: NextRequest) => {
  const actor = await requireSuperAdminApi();
  const body = invoiceCreateSchema.parse(await req.json());
  const count = body.installments ?? 1;
  if (count > 1) {
    const invoices = await createInvoiceSeries(
      actor.user.id,
      body,
      count,
      body.intervalMonths ?? 1,
    );
    return jsonOk({ invoices, count: invoices.length }, 201);
  }
  return jsonOk(await createInvoice(actor.user.id, body), 201);
});
