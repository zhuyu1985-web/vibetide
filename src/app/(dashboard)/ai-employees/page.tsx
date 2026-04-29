import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { AiEmployeesClient } from "./ai-employees-client";
import type { AIEmployee } from "@/lib/types";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function AiEmployeesPage() {
  const [employees, orgId] = await Promise.all([
    withTimeout(getEmployees(), []),
    withTimeout(getCurrentUserOrg(), null),
  ]);

  return <AiEmployeesClient employees={employees} organizationId={orgId || ""} />;
}
