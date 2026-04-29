import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { getOrganizations } from "@/lib/dal/admin";
import OrganizationsClient from "./organizations-client";

export default async function OrganizationsPage() {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ORGS);
  const organizations = await getOrganizations();
  return <OrganizationsClient organizations={organizations} />;
}
