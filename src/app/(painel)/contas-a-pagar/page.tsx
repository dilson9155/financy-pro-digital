import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { TitlesView } from "@/components/views/titles-view";

export const dynamic = "force-dynamic";

export default async function ContasAPagarPage() {
  await requirePermission(PERMISSIONS.PAYABLES_VIEW);
  return <TitlesView direction="PAYABLE" />;
}