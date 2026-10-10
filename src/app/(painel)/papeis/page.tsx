import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { RolesView } from "@/components/views/roles-view";

export const dynamic = "force-dynamic";

export default async function PapeisPage() {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  return <RolesView />;
}