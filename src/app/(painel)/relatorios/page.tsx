import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ReportsView } from "@/components/views/reports-view";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  await requirePermission(PERMISSIONS.REPORTS_VIEW);
  return <ReportsView />;
}