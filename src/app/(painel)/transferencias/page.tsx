import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { TransfersView } from "@/components/views/transfers-view";

export const dynamic = "force-dynamic";

export default async function TransferenciasPage() {
  await requirePermission(PERMISSIONS.TRANSFERS_VIEW);
  return <TransfersView />;
}