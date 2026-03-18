import { db } from "@/db";
import { aiEmployees, employeeSkills, skills, employeeKnowledgeBases, knowledgeBases } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type { AIEmployee, SkillCategory, EmployeeFullProfile, AuthorityLevel, WorkPreferences, KnowledgeBaseInfo, LearnedPatterns } from "@/lib/types";
import type { EmployeeId } from "@/lib/constants";

export async function getEmployees(): Promise<AIEmployee[]> {
  const t0 = Date.now();
  const orgId = await getCurrentUserOrg();
  const t1 = Date.now();
  const rows = await db.query.aiEmployees.findMany({
    ...(orgId ? { where: eq(aiEmployees.organizationId, orgId) } : {}),
    orderBy: (emp, { asc }) => [asc(emp.createdAt)],
  });
  const t2 = Date.now();
  console.log(`[dal/employees] auth=${t1 - t0}ms, query=${t2 - t1}ms, rows=${rows.length}`);

  if (rows.length === 0) return [];

  // Batch-load all skills in one query instead of N+1
  const empIds = rows.map((e) => e.id);
  const allSkillRows = await db
    .select({
      employeeId: employeeSkills.employeeId,
      id: skills.id,
      name: skills.name,
      category: skills.category,
      version: skills.version,
      type: skills.type,
      description: skills.description,
      level: employeeSkills.level,
      bindingType: employeeSkills.bindingType,
    })
    .from(employeeSkills)
    .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
    .where(inArray(employeeSkills.employeeId, empIds));
  const t3 = Date.now();
  console.log(`[dal/employees] skills=${t3 - t2}ms, total=${t3 - t0}ms`);

  const skillsByEmployee = new Map<string, typeof allSkillRows>();
  for (const row of allSkillRows) {
    const list = skillsByEmployee.get(row.employeeId) || [];
    list.push(row);
    skillsByEmployee.set(row.employeeId, list);
  }

  return rows.map((emp) => {
    const empSkills = skillsByEmployee.get(emp.id) || [];
    return {
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
        bindingType: s.bindingType as "core" | "extended" | "knowledge",
      })),
      stats: {
        tasksCompleted: emp.tasksCompleted,
        accuracy: emp.accuracy,
        avgResponseTime: emp.avgResponseTime,
        satisfaction: emp.satisfaction,
      },
    };
  });
}

export async function getEmployee(
  slug: string
): Promise<AIEmployee | undefined> {
  const orgId = await getCurrentUserOrg();
  const emp = await db.query.aiEmployees.findFirst({
    where: orgId
      ? and(eq(aiEmployees.slug, slug), eq(aiEmployees.organizationId, orgId))
      : eq(aiEmployees.slug, slug),
  });

  if (!emp) return undefined;

  const empSkills = await db
    .select({
      id: skills.id,
      name: skills.name,
      category: skills.category,
      version: skills.version,
      type: skills.type,
      description: skills.description,
      level: employeeSkills.level,
      bindingType: employeeSkills.bindingType,
    })
    .from(employeeSkills)
    .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
    .where(eq(employeeSkills.employeeId, emp.id));

  return {
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
      bindingType: s.bindingType as "core" | "extended" | "knowledge",
    })),
    stats: {
      tasksCompleted: emp.tasksCompleted,
      accuracy: emp.accuracy,
      avgResponseTime: emp.avgResponseTime,
      satisfaction: emp.satisfaction,
    },
  };
}

export async function getEmployeeFullProfile(
  slug: string
): Promise<EmployeeFullProfile | undefined> {
  const orgId = await getCurrentUserOrg();
  const emp = await db.query.aiEmployees.findFirst({
    where: orgId
      ? and(eq(aiEmployees.slug, slug), eq(aiEmployees.organizationId, orgId))
      : eq(aiEmployees.slug, slug),
  });

  if (!emp) return undefined;

  const empSkills = await db
    .select({
      id: skills.id,
      name: skills.name,
      category: skills.category,
      version: skills.version,
      type: skills.type,
      description: skills.description,
      level: employeeSkills.level,
      bindingType: employeeSkills.bindingType,
    })
    .from(employeeSkills)
    .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
    .where(eq(employeeSkills.employeeId, emp.id));

  const kbRows = await db.query.employeeKnowledgeBases.findMany({
    where: eq(employeeKnowledgeBases.employeeId, emp.id),
    with: {
      knowledgeBase: true,
    },
  });

  const knowledgeBasesList: KnowledgeBaseInfo[] = kbRows.map((ekb) => ({
    id: ekb.knowledgeBase.id,
    name: ekb.knowledgeBase.name,
    description: ekb.knowledgeBase.description || "",
    type: ekb.knowledgeBase.type,
    documentCount: ekb.knowledgeBase.documentCount || 0,
  }));

  return {
    id: emp.slug as EmployeeId,
    dbId: emp.id,
    name: emp.name,
    nickname: emp.nickname,
    title: emp.title,
    motto: emp.motto || "",
    status: emp.status,
    currentTask: emp.currentTask || undefined,
    roleType: emp.roleType,
    authorityLevel: emp.authorityLevel as AuthorityLevel,
    autoActions: (emp.autoActions as string[]) || [],
    needApprovalActions: (emp.needApprovalActions as string[]) || [],
    workPreferences: emp.workPreferences as WorkPreferences | null,
    learnedPatterns: (emp.learnedPatterns as LearnedPatterns) || {},
    isPreset: emp.isPreset === 1,
    disabled: emp.disabled === 1,
    knowledgeBases: knowledgeBasesList,
    skills: empSkills.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category as SkillCategory,
      version: s.version,
      level: s.level,
      type: s.type as "builtin" | "custom" | "plugin",
      description: s.description,
      bindingType: s.bindingType as "core" | "extended" | "knowledge",
    })),
    stats: {
      tasksCompleted: emp.tasksCompleted,
      accuracy: emp.accuracy,
      avgResponseTime: emp.avgResponseTime,
      satisfaction: emp.satisfaction,
    },
  };
}
