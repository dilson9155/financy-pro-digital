import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { CashFlowView } from "@/components/views/cash-flow-view";

export const dynamic = "force-dynamic";

export default async function FluxoDeCaixaPage() {
  await requirePermission(PERMISSIONS.CASH_FLOW_VIEW);
  return <CashFlowView />;
}