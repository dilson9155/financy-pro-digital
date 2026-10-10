import { requireAuth } from "@/lib/auth";
import { CompanyPicker } from "./company-picker";

export const dynamic = "force-dynamic";

export default async function SelectCompanyPage() {
  const ctx = await requireAuth();
  return (
    <CompanyPicker
      companies={ctx.memberships.map((m) => ({
        companyId: m.companyId,
        name: m.companyName,
        role: m.roleName,
      }))}
      activeCompanyId={ctx.companyId}
      userName={ctx.user.name}
    />
  );
}
