"use server";

import { db } from "@/db";
import { aiEmployees, employeeSkills, employeeKnowledgeBases, skills, teamMembers, teamMessages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import type { NewAIEmployee, NewSkill, NewEmployeeSkill } from "@/db/types";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function updateEmployeeStatus(
  employeeId: string,
  status: "working" | "idle" | "learning" | "reviewing",
  currentTask?: string
) {
  await requireAuth();

  const statusLabels: Record<string, string> = {
    working: "工作中",
    idle: "空闲",
    learning: "学习中",
    reviewing: "审核中",
  };

  await db
    .update(aiEmployees)
    .set({ status, currentTask: currentTask || null, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  // Notify all teams this employee belongs to
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.aiEmployeeId, employeeId));

  for (const { teamId } of memberships) {
    await db.insert(teamMessages).values({
      teamId,
      senderType: "ai",
      aiEmployeeId: employeeId,
      type: "status_update",
      content: currentTask
        ? `状态变更为「${statusLabels[status]}」：${currentTask}`
        : `状态变更为「${statusLabels[status]}」`,
    });
  }

  revalidatePath("/team-hub");
}

export async function createEmployee(data: {
  organizationId?: string;
  slug: string;
  name: string;
  nickname: string;
  title: string;
  motto?: string;
  roleType: string;
  authorityLevel?: "observer" | "advisor" | "executor" | "coordinator";
}) {
  await requireAuth();

  // Resolve org: prefer client-provided, fallback to server-side lookup
  let orgId = data.organizationId;
  if (!orgId) {
    orgId = (await getCurrentUserOrg()) ?? undefined;
  }
  if (!orgId) {
    throw new Error("未找到所属组织，请重新登录后再试");
  }

  const { organizationId: _, ...rest } = data;

  const [employee] = await db
    .insert(aiEmployees)
    .values({
      ...rest,
      organizationId: orgId,
      motto: rest.motto || null,
      isPreset: 0,
    })
    .returning();

  revalidatePath("/team-hub");
  revalidatePath("/employee-marketplace");
  return employee;
}

export async function bindSkillToEmployee(
  employeeId: string,
  skillId: string,
  level: number = 50,
  bindingType: "core" | "extended" | "knowledge" = "extended"
) {
  await requireAuth();

  // Compatibility check: verify skill is compatible with employee's role
  const employee = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
  });
  if (!employee) throw new Error("Employee not found");

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
  });
  if (!skill) throw new Error("Skill not found");

  const compatibleRoles = (skill.compatibleRoles as string[]) || [];
  if (compatibleRoles.length > 0 && !compatibleRoles.includes(employee.roleType)) {
    throw new Error(
      `技能「${skill.name}」不兼容角色「${employee.roleType}」。兼容角色：${compatibleRoles.join("、")}`
    );
  }

  await db.insert(employeeSkills).values({
    employeeId,
    skillId,
    level,
    bindingType,
  });

  revalidatePath("/team-hub");
  revalidatePath("/employee");
}

export async function unbindSkillFromEmployee(
  employeeId: string,
  skillId: string
) {
  await requireAuth();

  // Check if binding is core — core skills cannot be unbound
  const binding = await db.query.employeeSkills.findFirst({
    where: and(
      eq(employeeSkills.employeeId, employeeId),
      eq(employeeSkills.skillId, skillId)
    ),
  });

  if (binding?.bindingType === "core") {
    throw new Error("核心技能不可解绑");
  }

  await db
    .delete(employeeSkills)
    .where(
      and(
        eq(employeeSkills.employeeId, employeeId),
        eq(employeeSkills.skillId, skillId)
      )
    );

  revalidatePath("/team-hub");
  revalidatePath("/employee");
}

export async function updateEmployeeProfile(
  employeeId: string,
  data: {
    name?: string;
    nickname?: string;
    title?: string;
    motto?: string;
    authorityLevel?: "observer" | "advisor" | "executor" | "coordinator";
  }
) {
  await requireAuth();

  await db
    .update(aiEmployees)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  revalidatePath("/team-hub");
  revalidatePath("/employee");
}

export async function updateWorkPreferences(
  employeeId: string,
  prefs: {
    proactivity: string;
    reportingFrequency: string;
    autonomyLevel: number;
    communicationStyle: string;
    workingHours: string;
  }
) {
  await requireAuth();

  await db
    .update(aiEmployees)
    .set({ workPreferences: prefs, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  import("@/app/actions/employee-advanced")
    .then((m) => m.saveEmployeeConfigVersion(employeeId, ["workPreferences"], "工作偏好更新"))
    .catch(() => {});
  revalidatePath("/employee");
}

export async function updateAuthorityLevel(
  employeeId: string,
  level: "observer" | "advisor" | "executor" | "coordinator"
) {
  await requireAuth();

  await db
    .update(aiEmployees)
    .set({ authorityLevel: level, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  import("@/app/actions/employee-advanced")
    .then((m) => m.saveEmployeeConfigVersion(employeeId, ["authorityLevel"], `权限等级变更为 ${level}`))
    .catch(() => {});
  revalidatePath("/employee");
}

export async function updateAutoActions(
  employeeId: string,
  autoActions: string[],
  needApprovalActions: string[]
) {
  await requireAuth();

  await db
    .update(aiEmployees)
    .set({ autoActions, needApprovalActions, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  import("@/app/actions/employee-advanced")
    .then((m) => m.saveEmployeeConfigVersion(employeeId, ["autoActions", "needApprovalActions"], "操作权限更新"))
    .catch(() => {});
  revalidatePath("/employee");
}

export async function updateSkillLevel(
  employeeId: string,
  skillId: string,
  level: number
) {
  await requireAuth();

  await db
    .update(employeeSkills)
    .set({ level })
    .where(
      and(
        eq(employeeSkills.employeeId, employeeId),
        eq(employeeSkills.skillId, skillId)
      )
    );

  revalidatePath("/employee");
}

export async function cloneEmployee(
  sourceId: string,
  newSlug: string,
  newNickname: string
) {
  await requireAuth();

  const source = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, sourceId),
  });

  if (!source) throw new Error("Source employee not found");

  const [newEmployee] = await db
    .insert(aiEmployees)
    .values({
      organizationId: source.organizationId,
      slug: newSlug,
      name: source.name,
      nickname: newNickname,
      title: source.title,
      motto: source.motto,
      roleType: source.roleType,
      authorityLevel: source.authorityLevel,
      autoActions: source.autoActions,
      needApprovalActions: source.needApprovalActions,
      workPreferences: source.workPreferences,
      isPreset: 0,
    })
    .returning();

  // Clone skill bindings
  const sourceSkills = await db
    .select()
    .from(employeeSkills)
    .where(eq(employeeSkills.employeeId, sourceId));

  for (const sk of sourceSkills) {
    await db.insert(employeeSkills).values({
      employeeId: newEmployee.id,
      skillId: sk.skillId,
      level: sk.level,
    });
  }

  revalidatePath("/employee-marketplace");
  return newEmployee;
}

export async function deleteEmployee(employeeId: string) {
  await requireAuth();

  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
  });

  if (!emp) throw new Error("Employee not found");
  if (emp.isPreset === 1) throw new Error("Cannot delete preset employee");

  await db.delete(employeeSkills).where(eq(employeeSkills.employeeId, employeeId));
  await db.delete(aiEmployees).where(eq(aiEmployees.id, employeeId));

  revalidatePath("/employee-marketplace");
  revalidatePath("/team-hub");
}

export async function toggleEmployeeDisabled(
  employeeId: string,
  disabled: boolean
) {
  await requireAuth();

  await db
    .update(aiEmployees)
    .set({ disabled: disabled ? 1 : 0, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  revalidatePath("/employee-marketplace");
  revalidatePath("/team-hub");
  revalidatePath("/employee");
}

export async function exportEmployee(employeeId: string) {
  await requireAuth();

  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
  });
  if (!emp) throw new Error("Employee not found");

  const empSkills = await db
    .select({
      skillName: skills.name,
      level: employeeSkills.level,
    })
    .from(employeeSkills)
    .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
    .where(eq(employeeSkills.employeeId, employeeId));

  return {
    slug: emp.slug,
    name: emp.name,
    nickname: emp.nickname,
    title: emp.title,
    motto: emp.motto,
    roleType: emp.roleType,
    authorityLevel: emp.authorityLevel,
    autoActions: emp.autoActions,
    needApprovalActions: emp.needApprovalActions,
    workPreferences: emp.workPreferences,
    skills: empSkills.map((s) => ({ name: s.skillName, level: s.level })),
  };
}

export async function importEmployee(
  organizationId: string,
  data: {
    slug: string;
    name: string;
    nickname: string;
    title: string;
    motto?: string | null;
    roleType: string;
    authorityLevel?: "observer" | "advisor" | "executor" | "coordinator";
    autoActions?: string[];
    needApprovalActions?: string[];
    workPreferences?: {
      proactivity: string;
      reportingFrequency: string;
      autonomyLevel: number;
      communicationStyle: string;
      workingHours: string;
    } | null;
    skills?: { name: string; level: number }[];
  }
) {
  await requireAuth();

  const [employee] = await db
    .insert(aiEmployees)
    .values({
      organizationId,
      slug: data.slug,
      name: data.name,
      nickname: data.nickname,
      title: data.title,
      motto: data.motto,
      roleType: data.roleType,
      authorityLevel: data.authorityLevel || "advisor",
      autoActions: data.autoActions || [],
      needApprovalActions: data.needApprovalActions || [],
      workPreferences: data.workPreferences,
      isPreset: 0,
    })
    .returning();

  // Bind skills by name lookup
  if (data.skills && data.skills.length > 0) {
    for (const sk of data.skills) {
      const skill = await db.query.skills.findFirst({
        where: eq(skills.name, sk.name),
      });
      if (skill) {
        await db.insert(employeeSkills).values({
          employeeId: employee.id,
          skillId: skill.id,
          level: sk.level,
        });
      }
    }
  }

  revalidatePath("/employee-marketplace");
  revalidatePath("/team-hub");
  return employee;
}

// ---------------------------------------------------------------------------
// Knowledge Base bind/unbind
// ---------------------------------------------------------------------------

export async function bindKnowledgeBaseToEmployee(
  employeeId: string,
  knowledgeBaseId: string
) {
  await requireAuth();

  // Check if already bound
  const existing = await db.query.employeeKnowledgeBases.findFirst({
    where: and(
      eq(employeeKnowledgeBases.employeeId, employeeId),
      eq(employeeKnowledgeBases.knowledgeBaseId, knowledgeBaseId)
    ),
  });

  if (existing) {
    throw new Error("该知识库已绑定");
  }

  await db.insert(employeeKnowledgeBases).values({
    employeeId,
    knowledgeBaseId,
  });

  revalidatePath("/employee");
}

export async function unbindKnowledgeBaseFromEmployee(
  employeeId: string,
  knowledgeBaseId: string
) {
  await requireAuth();

  await db
    .delete(employeeKnowledgeBases)
    .where(
      and(
        eq(employeeKnowledgeBases.employeeId, employeeId),
        eq(employeeKnowledgeBases.knowledgeBaseId, knowledgeBaseId)
      )
    );

  revalidatePath("/employee");
}
