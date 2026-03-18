"use server";

import { db } from "@/db";
import { teams, teamMembers, teamMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createTeam(data: {
  organizationId: string;
  name: string;
  scenario: string;
  rules: {
    approvalRequired: boolean;
    reportFrequency: string;
    sensitiveTopics: string[];
  };
  aiMembers: { employeeId: string; displayName: string; teamRole: string }[];
  humanMembers: { displayName: string; teamRole: string }[];
}) {
  await requireAuth();

  const [team] = await db
    .insert(teams)
    .values({
      organizationId: data.organizationId,
      name: data.name,
      scenario: data.scenario,
      rules: data.rules,
    })
    .returning();

  // Add AI members
  for (const member of data.aiMembers) {
    await db.insert(teamMembers).values({
      teamId: team.id,
      memberType: "ai",
      aiEmployeeId: member.employeeId,
      displayName: member.displayName,
      teamRole: member.teamRole,
    });
  }

  // Add human members
  for (const member of data.humanMembers) {
    await db.insert(teamMembers).values({
      teamId: team.id,
      memberType: "human",
      displayName: member.displayName,
      teamRole: member.teamRole,
    });
  }

  revalidatePath("/team-builder");
  revalidatePath("/team-hub");
  return team;
}

export async function addTeamMember(
  teamId: string,
  member: {
    memberType: "ai" | "human";
    aiEmployeeId?: string;
    userId?: string;
    displayName: string;
    teamRole?: string;
  }
) {
  await requireAuth();

  await db.insert(teamMembers).values({
    teamId,
    ...member,
  });

  revalidatePath("/team-hub");
  revalidatePath("/team-builder");
}

export async function removeTeamMember(memberId: string) {
  await requireAuth();

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

  revalidatePath("/team-hub");
  revalidatePath("/team-builder");
}

export async function deleteTeam(teamId: string) {
  await requireAuth();

  await db.delete(teams).where(eq(teams.id, teamId));

  revalidatePath("/team-builder");
  revalidatePath("/team-hub");
}

export async function updateTeam(
  teamId: string,
  data: { name?: string; scenario?: string }
) {
  await requireAuth();

  await db.update(teams).set(data).where(eq(teams.id, teamId));

  revalidatePath("/team-builder");
  revalidatePath("/team-hub");
}

export async function updateTeamRules(
  teamId: string,
  rules: {
    approvalRequired: boolean;
    reportFrequency: string;
    sensitiveTopics: string[];
    approvalSteps?: string[];
  }
) {
  await requireAuth();

  await db.update(teams).set({ rules }).where(eq(teams.id, teamId));

  revalidatePath("/team-builder");
  revalidatePath("/team-hub");
}

export async function updateEscalationPolicy(
  teamId: string,
  policy: {
    sensitivityThreshold?: number;
    qualityThreshold?: number;
    timeoutAction?: "auto_approve" | "auto_reject" | "escalate";
    escalateToUserId?: string;
  }
) {
  await requireAuth();

  await db
    .update(teams)
    .set({ escalationPolicy: policy })
    .where(eq(teams.id, teamId));

  revalidatePath("/team-builder");
  revalidatePath("/team-hub");
}

export async function updateTeamMemberRole(
  memberId: string,
  teamRole: string
) {
  await requireAuth();

  await db
    .update(teamMembers)
    .set({ teamRole })
    .where(eq(teamMembers.id, memberId));

  revalidatePath("/team-hub");
  revalidatePath("/team-builder");
}

export async function sendTeamMessage(data: {
  teamId: string;
  content: string;
}) {
  const user = await requireAuth();

  await db.insert(teamMessages).values({
    teamId: data.teamId,
    senderType: "human",
    userId: user.id,
    type: "status_update",
    content: data.content,
  });

  revalidatePath("/team-hub");
}
