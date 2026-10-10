import { requireSuperAdmin } from "@/lib/auth";
import { AdminInvoicesView } from "@/components/views/admin-invoices-view";

export const dynamic = "force-dynamic";

export default async function AdminCobrancasPage() {
  await requireSuperAdmin();
  return <AdminInvoicesView />;
}
