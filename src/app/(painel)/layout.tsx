import { requireCompany } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import type { SessionValue } from "@/components/session-context";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireCompany();
  const session: SessionValue = {
    user: ctx.user,
    companyId: ctx.companyId,
    permissions: Array.from(ctx.permissions),
    memberships: ctx.memberships,
  };
  return <AppShell session={session}>{children}</AppShell>;
}
