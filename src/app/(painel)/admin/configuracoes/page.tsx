import { requireSuperAdmin } from "@/lib/auth";
import { AdminSettingsView } from "@/components/views/admin-settings-view";

export const dynamic = "force-dynamic";

export default async function AdminConfiguracoesPage() {
  await requireSuperAdmin();
  return <AdminSettingsView />;
}
