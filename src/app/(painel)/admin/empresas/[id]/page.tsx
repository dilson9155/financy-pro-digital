import { requireSuperAdmin } from "@/lib/auth";
import { AdminCompanyDetailView } from "@/components/views/admin-company-detail-view";

export const dynamic = "force-dynamic";

export default async function AdminEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  return <AdminCompanyDetailView companyId={id} />;
}
