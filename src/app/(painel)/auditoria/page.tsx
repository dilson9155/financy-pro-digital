import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { AuditView } from "@/components/views/audit-view";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  await requirePermission(PERMISSIONS.AUDIT_VIEW);
  return <AuditView />;
}