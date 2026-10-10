import { requireSuperAdmin } from "@/lib/auth";
import { AdminCompaniesView } from "@/components/views/admin-companies-view";

export const dynamic = "force-dynamic";

export default async function AdminEmpresasPage() {
  await requireSuperAdmin();
  return <AdminCompaniesView />;
}
