export const dynamic = "force-dynamic";

import { getEmployees } from "@/lib/dal/employees";
import { getWorkflows } from "@/lib/dal/workflows";
import { getTeamMessages } from "@/lib/dal/messages";
import { getTeams, getWorkflowTemplates } from "@/lib/dal/teams";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { TeamHubClient } from "./team-hub-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function TeamHubPage() {
  const [employees, workflows, messages, teams, templates, orgId] =
    await Promise.all([
      withTimeout(getEmployees(), []),
      withTimeout(getWorkflows(), []),
      withTimeout(getTeamMessages(), []),
      withTimeout(getTeams(), []),
      withTimeout(getWorkflowTemplates(), []),
      withTimeout(getCurrentUserOrg(), null),
    ] as const);

  return (
    <TeamHubClient
      employees={employees}
      workflows={workflows}
      messages={messages}
      teams={teams}
      templates={templates}
      organizationId={orgId || ""}
    />
  );
}
