import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { getAllUsers, getOrgMembers } from "@/lib/dal/admin";
import { getOrganizations } from "@/lib/dal/admin";
import { getAllRoles } from "@/lib/dal/admin";
import { isSuperAdmin } from "@/lib/rbac";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import UsersClient from "./users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const ctx = await requirePermission(PERMISSIONS.SYSTEM_MANAGE_USERS);
  const superAdmin = await isSuperAdmin(ctx.userId);

  const users = superAdmin
    ? await getAllUsers()
    : await getOrgMembers(ctx.organizationId);

  const organizations = superAdmin ? await getOrganizations() : [];
  const roles = await getAllRoles();

  return (
    <UsersClient
      users={users}
      organizations={organizations}
      roles={roles}
      isSuperAdmin={superAdmin}
      currentOrgId={ctx.organizationId}
    />
  );
}
