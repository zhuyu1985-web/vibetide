"use server";

import { db } from "@/db";
import {
  aiEmployees,
  employeeSkills,
  employeeKnowledgeBases,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

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
  baseTemplateSlug: string;
  name: string;
  description: string;
  instructions?: string;
  skillIds?: string[];
  knowledgeBaseIds?: string[];
  visibility?: "private" | "org";
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
      authorityLevel: "executor",
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
