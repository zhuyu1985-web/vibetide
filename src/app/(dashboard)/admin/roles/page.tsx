import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { getAllRoles } from "@/lib/dal/admin";
import RolesClient from "./roles-client";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const ctx = await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ROLES);
  const roles = await getAllRoles();
  return <RolesClient roles={roles} organizationId={ctx.organizationId} />;
}
