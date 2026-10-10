import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ReconciliationView } from "@/components/views/reconciliation-view";

export const dynamic = "force-dynamic";

export default async function ConciliacaoPage() {
  await requirePermission(PERMISSIONS.RECONCILIATION_VIEW);
  return <ReconciliationView />;
}