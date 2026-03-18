import { db } from "@/db";
import { teams, teamMembers, aiEmployees, employeeSkills, skills, workflowTemplates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Team, TeamWithMembers, AIEmployee, SkillCategory } from "@/lib/types";
import type { EmployeeId } from "@/lib/constants";
import { getCurrentUserOrg } from "@/lib/dal/auth";

export async function getTeams(): Promise<Team[]> {
  const orgId = await getCurrentUserOrg();
  const rows = await db.query.teams.findMany({
    ...(orgId ? { where: eq(teams.organizationId, orgId) } : {}),
    with: {
      members: true,
    },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  return rows.map((team) => ({
    id: team.id,
    name: team.name,
    scenario: team.scenario,
    members: team.members
      .filter((m) => m.memberType === "ai")
      .map((m) => m.displayName as EmployeeId),
    humanMembers: team.members
      .filter((m) => m.memberType === "human")
      .map((m) => m.displayName),
    rules: team.rules,
    createdAt: team.createdAt.toISOString(),
  }));
}

export async function getTeam(id: string): Promise<Team | undefined> {
  const orgId = await getCurrentUserOrg();
  const team = await db.query.teams.findFirst({
    where: orgId ? and(eq(teams.id, id), eq(teams.organizationId, orgId)) : eq(teams.id, id),
    with: {
      members: true,
    },
  });

  if (!team) return undefined;

  return {
    id: team.id,
    name: team.name,
    scenario: team.scenario,
    members: team.members
      .filter((m) => m.memberType === "ai")
      .map((m) => m.displayName as EmployeeId),
    humanMembers: team.members
      .filter((m) => m.memberType === "human")
      .map((m) => m.displayName),
    rules: team.rules,
    createdAt: team.createdAt.toISOString(),
  };
}

export async function getTeamWithMembers(
  teamId: string
): Promise<TeamWithMembers | undefined> {
  const orgId = await getCurrentUserOrg();
  const team = await db.query.teams.findFirst({
    where: orgId ? and(eq(teams.id, teamId), eq(teams.organizationId, orgId)) : eq(teams.id, teamId),
    with: {
      members: {
        with: {
          aiEmployee: true,
        },
      },
    },
  });

  if (!team) return undefined;

  const memberDetails = [];
  for (const m of team.members) {
    let employee: AIEmployee | undefined;
    if (m.memberType === "ai" && m.aiEmployee) {
      const emp = m.aiEmployee;
      const empSkills = await db
        .select({
          id: skills.id,
          name: skills.name,
          category: skills.category,
          version: skills.version,
          type: skills.type,
          description: skills.description,
          level: employeeSkills.level,
        })
        .from(employeeSkills)
        .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
        .where(eq(employeeSkills.employeeId, emp.id));

      employee = {
        id: emp.slug as EmployeeId,
        dbId: emp.id,
        name: emp.name,
        nickname: emp.nickname,
        title: emp.title,
        motto: emp.motto || "",
        status: emp.status,
        currentTask: emp.currentTask || undefined,
        skills: empSkills.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category as SkillCategory,
          version: s.version,
          level: s.level,
          type: s.type as "builtin" | "custom" | "plugin",
          description: s.description,
        })),
        stats: {
          tasksCompleted: emp.tasksCompleted,
          accuracy: emp.accuracy,
          avgResponseTime: emp.avgResponseTime,
          satisfaction: emp.satisfaction,
        },
      };
    }

    memberDetails.push({
      id: m.id,
      memberType: m.memberType as "ai" | "human",
      aiEmployeeId: m.aiEmployeeId || undefined,
      displayName: m.displayName,
      teamRole: m.teamRole || "",
      employee,
    });
  }

  return {
    id: team.id,
    name: team.name,
    scenario: team.scenario,
    members: team.members
      .filter((m) => m.memberType === "ai")
      .map((m) => m.displayName as EmployeeId),
    humanMembers: team.members
      .filter((m) => m.memberType === "human")
      .map((m) => m.displayName),
    rules: team.rules,
    createdAt: team.createdAt.toISOString(),
    memberDetails,
  };
}

export async function getWorkflowTemplates() {
  const orgId = await getCurrentUserOrg();
  const rows = await db.query.workflowTemplates.findMany({
    ...(orgId ? { where: eq(workflowTemplates.organizationId, orgId) } : {}),
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description || "",
    steps: t.steps,
  }));
}
