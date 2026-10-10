import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { DashboardView } from "@/components/views/dashboard-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  return <DashboardView />;
}