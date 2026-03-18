export const dynamic = "force-dynamic";

import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { EmployeeMarketplaceClient } from "./employee-marketplace-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function EmployeeMarketplacePage() {
  const [employees, orgId] = await Promise.all([
    withTimeout(getEmployees(), []),
    withTimeout(getCurrentUserOrg(), null),
  ]);

  return (
    <EmployeeMarketplaceClient
      employees={employees}
      organizationId={orgId || ""}
    />
  );
}
