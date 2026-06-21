"use server";

import { db } from "@/db";
import {
  aiEmployees,
  employeeSkills,
  employeeKnowledgeBases,
  skills,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { CRAFT_CORE_SKILLS, type CraftType } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
async function requireOrg(): Promise<{ userId: string; organizationId: string }> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return { userId: user.id, organizationId: orgId };
}

// ---------------------------------------------------------------------------
// Ownership check: employee must belong to org and be custom (is_preset = 0)
// ---------------------------------------------------------------------------

async function assertCustomEmployeeOwnership(orgId: string, employeeId: string) {
  const emp = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.id, employeeId),
      eq(aiEmployees.organizationId, orgId),
    ),
  });
  if (!emp) throw new Error("员工不存在或无权操作");
  if (emp.isPreset !== 0) throw new Error("预设员工不可修改");
  return emp;
}

// ---------------------------------------------------------------------------
// Create custom employee
// ---------------------------------------------------------------------------

export async function createCustomEmployee(input: {
  baseTemplateSlug: string; // 工种 craft slug(roleType),如 reporter / editor
  name: string;
  description: string;
  instructions?: string;
  skillIds?: string[];
  knowledgeBaseIds?: string[];
  visibility?: "private" | "org";
  // 四层重构:层级(authority)+ 领域/形态(instanceConfig)
  authorityLevel?: "observer" | "advisor" | "executor" | "coordinator";
  // P2 领域一等维度:domain_id 字典外键(硬切 instanceConfig.domainTags)。
  domainId?: string | null;
  instanceConfig?: {
    mediaForm?: "news" | "newmedia" | "convergence";
    platformSpecs?: { channels?: string[]; formatRules?: Record<string, unknown> };
  };
}) {
  const { organizationId } = await requireOrg();

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("员工名称不能为空");
  if (trimmedName.length > 50) throw new Error("员工名称过长");

  const slug = `custom_${crypto.randomUUID().slice(0, 8)}`;

  // Store custom instructions in workPreferences JSON field
  const workPreferences = input.instructions
    ? {
        proactivity: "medium",
        reportingFrequency: "on_completion",
        autonomyLevel: 5,
        communicationStyle: "professional",
        workingHours: "24/7",
        customInstructions: input.instructions,
        visibility: input.visibility || "org",
      }
    : undefined;

  const [created] = await db
    .insert(aiEmployees)
    .values({
      organizationId,
      slug,
      name: trimmedName,
      nickname: trimmedName,
      title: trimmedName,
      motto: input.description?.trim() || null,
      roleType: input.baseTemplateSlug,
      authorityLevel: input.authorityLevel ?? "executor",
      domainId: input.domainId ?? null,
      instanceConfig: input.instanceConfig ?? {},
      status: "idle",
      isPreset: 0,
      workPreferences: workPreferences as typeof aiEmployees.$inferInsert.workPreferences,
    })
    .returning({ id: aiEmployees.id, slug: aiEmployees.slug });

  // Bind skills
  if (input.skillIds && input.skillIds.length > 0) {
    await db.insert(employeeSkills).values(
      input.skillIds.map((skillId) => ({
        employeeId: created.id,
        skillId,
        level: 50,
        bindingType: "extended" as const,
        learningSource: "assigned" as const,
      })),
    );
  }

  // 四层重构:按工种自动绑定核心技能(slug→id),保证实例具备该工种能力。
  // 客户端无法可靠地把 core skill slug 映射到 skillId(Skill 类型不带 slug),故服务端解析。
  const coreSlugs = CRAFT_CORE_SKILLS[input.baseTemplateSlug as CraftType];
  if (coreSlugs && coreSlugs.length > 0) {
    const coreRows = await db
      .select({ id: skills.id })
      .from(skills)
      .where(
        and(
          eq(skills.organizationId, organizationId),
          inArray(skills.slug, coreSlugs),
        ),
      );
    if (coreRows.length > 0) {
      await db
        .insert(employeeSkills)
        .values(
          coreRows.map((r) => ({
            employeeId: created.id,
            skillId: r.id,
            level: 80,
            bindingType: "core" as const,
            learningSource: "assigned" as const,
          })),
        )
        .onConflictDoNothing({
          target: [employeeSkills.employeeId, employeeSkills.skillId],
        });
    }
  }

  // Bind knowledge bases
  if (input.knowledgeBaseIds && input.knowledgeBaseIds.length > 0) {
    await db
      .insert(employeeKnowledgeBases)
      .values(
        input.knowledgeBaseIds.map((knowledgeBaseId) => ({
          employeeId: created.id,
          knowledgeBaseId,
        })),
      )
      .onConflictDoNothing({
        target: [
          employeeKnowledgeBases.employeeId,
          employeeKnowledgeBases.knowledgeBaseId,
        ],
      });
  }

  revalidatePath("/ai-employees");
  revalidatePath("/home");

  return { id: created.id, slug: created.slug };
}

// ---------------------------------------------------------------------------
// Update custom employee
// ---------------------------------------------------------------------------

export async function updateCustomEmployee(
  employeeId: string,
  input: {
    name?: string;
    description?: string;
    instructions?: string;
    skillIds?: string[];
    knowledgeBaseIds?: string[];
    visibility?: "private" | "org";
  },
) {
  const { organizationId } = await requireOrg();
  const existing = await assertCustomEmployeeOwnership(organizationId, employeeId);

  // Build updates object
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("员工名称不能为空");
    if (trimmed.length > 50) throw new Error("员工名称过长");
    updates.name = trimmed;
    updates.nickname = trimmed;
    updates.title = trimmed;
  }

  if (input.description !== undefined) {
    updates.motto = input.description.trim() || null;
  }

  if (input.instructions !== undefined || input.visibility !== undefined) {
    // Merge with existing workPreferences
    const currentPrefs = (existing.workPreferences as Record<string, unknown>) || {};
    const merged = {
      proactivity: "medium",
      reportingFrequency: "on_completion",
      autonomyLevel: 5,
      communicationStyle: "professional",
      workingHours: "24/7",
      ...currentPrefs,
      ...(input.instructions !== undefined ? { customInstructions: input.instructions } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    };
    updates.workPreferences = merged;
  }

  await db
    .update(aiEmployees)
    .set(updates)
    .where(eq(aiEmployees.id, employeeId));

  // Re-bind skills if provided (delete old, insert new)
  if (input.skillIds !== undefined) {
    await db
      .delete(employeeSkills)
      .where(eq(employeeSkills.employeeId, employeeId));

    if (input.skillIds.length > 0) {
      await db.insert(employeeSkills).values(
        input.skillIds.map((skillId) => ({
          employeeId,
          skillId,
          level: 50,
          bindingType: "extended" as const,
          learningSource: "assigned" as const,
        })),
      );
    }
  }

  // Re-bind knowledge bases if provided
  if (input.knowledgeBaseIds !== undefined) {
    await db
      .delete(employeeKnowledgeBases)
      .where(eq(employeeKnowledgeBases.employeeId, employeeId));

    if (input.knowledgeBaseIds.length > 0) {
      await db
        .insert(employeeKnowledgeBases)
        .values(
          input.knowledgeBaseIds.map((knowledgeBaseId) => ({
            employeeId,
            knowledgeBaseId,
          })),
        )
        .onConflictDoNothing({
          target: [
            employeeKnowledgeBases.employeeId,
            employeeKnowledgeBases.knowledgeBaseId,
          ],
        });
    }
  }

  revalidatePath("/ai-employees");
  revalidatePath("/home");

  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete custom employee
// ---------------------------------------------------------------------------

export async function deleteCustomEmployee(employeeId: string) {
  const { organizationId } = await requireOrg();
  await assertCustomEmployeeOwnership(organizationId, employeeId);

  // CASCADE on employeeSkills and employeeKnowledgeBases handles cleanup
  await db.delete(aiEmployees).where(eq(aiEmployees.id, employeeId));

  revalidatePath("/ai-employees");
  revalidatePath("/home");

  return { success: true };
}

// ---------------------------------------------------------------------------
// List custom employees for current org
// ---------------------------------------------------------------------------

export async function listCustomEmployees() {
  const { organizationId } = await requireOrg();

  const rows = await db.query.aiEmployees.findMany({
    where: and(
      eq(aiEmployees.organizationId, organizationId),
      eq(aiEmployees.isPreset, 0),
    ),
    orderBy: (emp, { desc }) => [desc(emp.createdAt)],
  });

  return rows.map((emp) => ({
    id: emp.id,
    slug: emp.slug,
    name: emp.name,
    nickname: emp.nickname,
    title: emp.title,
    motto: emp.motto,
    roleType: emp.roleType,
    authorityLevel: emp.authorityLevel,
    status: emp.status,
    workPreferences: emp.workPreferences,
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
  }));
}
