export const dynamic = "force-dynamic";

import { getEmployees } from "@/lib/dal/employees";
import { getTeams } from "@/lib/dal/teams";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { TEAM_SCENARIOS } from "@/lib/constants";
import { TeamBuilderClient } from "./team-builder-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function TeamBuilderPage() {
  const [employees, teams, orgId] = await Promise.all([
    withTimeout(getEmployees(), []),
    withTimeout(getTeams(), []),
    withTimeout(getCurrentUserOrg(), null),
  ]);

  return (
    <TeamBuilderClient
      employees={employees}
      scenarios={TEAM_SCENARIOS}
      existingTeams={teams}
      organizationId={orgId || ""}
    />
  );
}
