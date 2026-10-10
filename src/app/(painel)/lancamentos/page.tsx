import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { TransactionsView } from "@/components/views/transactions-view";

export const dynamic = "force-dynamic";

export default async function LancamentosPage() {
  await requirePermission(PERMISSIONS.TRANSACTIONS_VIEW);
  return <TransactionsView />;
}