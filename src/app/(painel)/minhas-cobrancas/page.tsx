import { requireCompany } from "@/lib/auth";
import { MyInvoicesView } from "@/components/views/my-invoices-view";

export const dynamic = "force-dynamic";

export default async function MinhasCobrancasPage() {
  await requireCompany();
  return <MyInvoicesView />;
}
