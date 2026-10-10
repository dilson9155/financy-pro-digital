import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { UsersView } from "@/components/views/users-view";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  await requirePermission(PERMISSIONS.USERS_VIEW);
  return <UsersView />;
}