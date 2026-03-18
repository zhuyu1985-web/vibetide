import { db } from "@/db";
import { teamMessages, teams } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import type { TeamMessage, MessageType } from "@/lib/types";
import type { EmployeeId } from "@/lib/constants";
import { getCurrentUserOrg } from "@/lib/dal/auth";

export async function getTeamMessages(
  teamId?: string
): Promise<TeamMessage[]> {
  const orgId = await getCurrentUserOrg();

  // If teamId is provided, filter by team; also scope by org
  let whereClause;
  if (teamId && orgId) {
    // Verify the team belongs to the org
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, teamId), eq(teams.organizationId, orgId)),
      columns: { id: true },
    });
    if (!team) return [];
    whereClause = eq(teamMessages.teamId, teamId);
  } else if (teamId) {
    whereClause = eq(teamMessages.teamId, teamId);
  } else if (orgId) {
    // No teamId: get messages from all org teams
    const orgTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.organizationId, orgId));
    const orgTeamIds = orgTeams.map((t) => t.id);
    if (orgTeamIds.length === 0) return [];
    whereClause = inArray(teamMessages.teamId, orgTeamIds);
  }

  const rows = await db.query.teamMessages.findMany({
    ...(whereClause ? { where: whereClause } : {}),
    with: {
      aiEmployee: true,
    },
    orderBy: [desc(teamMessages.createdAt)],
  });

  return rows.map((msg) => ({
    id: msg.id,
    employeeId: (msg.aiEmployee?.slug || "") as EmployeeId,
    type: msg.type as MessageType,
    content: msg.content,
    timestamp: msg.createdAt.toISOString(),
    actions: msg.actions || undefined,
    attachments: msg.attachments || undefined,
    workflowInstanceId: msg.workflowInstanceId || undefined,
    workflowStepId: msg.workflowStepKey || undefined,
  }));
}
