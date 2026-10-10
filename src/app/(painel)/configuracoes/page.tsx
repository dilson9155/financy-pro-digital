import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { SettingsView } from "@/components/views/settings-view";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  return <SettingsView />;
}