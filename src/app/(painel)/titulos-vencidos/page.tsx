import { requireCompany } from "@/lib/auth";
import { OverdueTitlesView } from "@/components/views/overdue-titles-view";

export const dynamic = "force-dynamic";

export default async function TitulosVencidosPage() {
  await requireCompany();
  return <OverdueTitlesView />;
}
