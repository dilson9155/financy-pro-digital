import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { TitleDetailView } from "@/components/views/title-detail-view";

export const dynamic = "force-dynamic";

export default async function ContaAReceberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.RECEIVABLES_VIEW);
  const { id } = await params;
  return <TitleDetailView direction="RECEIVABLE" titleId={id} />;
}