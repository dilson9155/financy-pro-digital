import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { TitleDetailView } from "@/components/views/title-detail-view";

export const dynamic = "force-dynamic";

export default async function ContaAPagarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PAYABLES_VIEW);
  const { id } = await params;
  return <TitleDetailView direction="PAYABLE" titleId={id} />;
}