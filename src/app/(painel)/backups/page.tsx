import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { BackupsView } from "@/components/views/backups-view";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  await requirePermission(PERMISSIONS.BACKUPS_VIEW);
  return <BackupsView />;
}