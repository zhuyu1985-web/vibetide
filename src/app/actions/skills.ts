"use server";

import { db } from "@/db";
import { skills, skillFiles, skillVersions, skillUsageRecords, workflowTemplates } from "@/db/schema";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { revalidatePath } from "next/cache";
import type { SkillCategory } from "@/lib/types";
import { parseFrontmatter } from "@/lib/skill-package";
import { encrypt } from "@/lib/crypto";
import { validatePluginUrl } from "@/lib/plugin-security";
async function requireCurrentOrgId() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

function buildSkillAccessCondition(skillId: string, orgId: string) {
  return and(
    eq(skills.id, skillId),
    or(eq(skills.organizationId, orgId), isNull(skills.organizationId))
  );
}

function buildSkillVersionAccessCondition(versionId: string, orgId: string) {
  return and(
    eq(skillVersions.id, versionId),
    or(eq(skillVersions.organizationId, orgId), isNull(skillVersions.organizationId))
  );
}

function buildSkillVersionScopeCondition(skillId: string, orgId: string) {
  return and(
    eq(skillVersions.skillId, skillId),
    or(eq(skillVersions.organizationId, orgId), isNull(skillVersions.organizationId))
  );
}

function buildSkillFileAccessCondition(fileId: string, orgId: string) {
  return and(
    eq(skillFiles.id, fileId),
    or(eq(skillFiles.organizationId, orgId), isNull(skillFiles.organizationId))
  );
}

async function getSkillInOrg(skillId: string, orgId: string) {
  return db.query.skills.findFirst({
    where: buildSkillAccessCondition(skillId, orgId),
  });
}

async function getSkillVersionInOrg(versionId: string, orgId: string) {
  return db.query.skillVersions.findFirst({
    where: buildSkillVersionAccessCondition(versionId, orgId),
  });
}

async function getSkillFileInOrg(fileId: string, orgId: string) {
  return db.query.skillFiles.findFirst({
    where: buildSkillFileAccessCondition(fileId, orgId),
  });
}

export async function createSkill(data: {
  name: string;
  category: SkillCategory;
  description: string;
  version?: string;
  compatibleRoles?: string[];
  runtimeConfig?: {
    type: string;
    avgLatencyMs: number;
    maxConcurrency: number;
    modelDependency?: string;
  };
}) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  if (!data.name.trim()) throw new Error("技能名称不能为空");
  if (!data.description.trim()) throw new Error("技能描述不能为空");

  const [created] = await db
    .insert(skills)
    .values({
      organizationId: orgId,
      name: data.name.trim(),
      category: data.category,
      type: "custom",
      version: data.version?.trim() || "1.0",
      description: data.description.trim(),
      compatibleRoles: data.compatibleRoles ?? [],
      runtimeConfig: data.runtimeConfig ?? null,
    })
    .returning();

  revalidatePath("/skills");
  return created;
}

// ---------------------------------------------------------------------------
// S2.15: Third-party Plugin Skill Registration
// ---------------------------------------------------------------------------

export async function registerPluginSkill(data: {
  name: string;
  category: SkillCategory;
  description: string;
  version?: string;
  compatibleRoles?: string[];
  pluginConfig: {
    endpoint: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    authType?: "none" | "api_key" | "bearer";
    authKey?: string;
    requestTemplate?: string;
    responseMapping?: Record<string, string>;
    timeoutMs?: number;
  };
}) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  if (!data.name.trim()) throw new Error("技能名称不能为空");
  if (!data.description.trim()) throw new Error("技能描述不能为空");
  if (!data.pluginConfig.endpoint.trim()) throw new Error("API 端点不能为空");

  const urlCheck = validatePluginUrl(data.pluginConfig.endpoint);
  if (!urlCheck.valid) throw new Error(urlCheck.error!);

  // 加密 authKey
  const securedConfig = { ...data.pluginConfig };
  if (securedConfig.authKey) {
    securedConfig.authKey = encrypt(securedConfig.authKey);
  }

  const [newSkill] = await db
    .insert(skills)
    .values({
      organizationId: orgId,
      name: data.name.trim(),
      category: data.category,
      type: "plugin",
      version: data.version?.trim() || "1.0",
      description: data.description.trim(),
      compatibleRoles: data.compatibleRoles ?? [],
      pluginConfig: securedConfig,
    })
    .returning();

  revalidatePath("/skills");
  return newSkill;
}

export async function updatePluginConfig(
  skillId: string,
  pluginConfig: {
    endpoint: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    authType?: "none" | "api_key" | "bearer";
    authKey?: string;
    requestTemplate?: string;
    responseMapping?: Record<string, string>;
    timeoutMs?: number;
  }
) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  const existing = await getSkillInOrg(skillId, orgId);
  if (!existing) throw new Error("技能不存在");
  if (existing.type !== "plugin") throw new Error("只有插件技能才能更新插件配置");

  const urlCheck = validatePluginUrl(pluginConfig.endpoint);
  if (!urlCheck.valid) throw new Error(urlCheck.error!);

  // 加密 authKey
  const securedConfig = { ...pluginConfig };
  if (securedConfig.authKey) {
    securedConfig.authKey = encrypt(securedConfig.authKey);
  }

  await db
    .update(skills)
    .set({ pluginConfig: securedConfig, updatedAt: new Date() })
    .where(buildSkillAccessCondition(skillId, orgId));

  revalidatePath(`/skills/${skillId}`);
}

export async function updateSkill(
  id: string,
  data: {
    name?: string;
    category?: SkillCategory;
    description?: string;
    content?: string;
    version?: string;
    compatibleRoles?: string[];
    runtimeConfig?: {
      type: string;
      avgLatencyMs: number;
      maxConcurrency: number;
      modelDependency?: string;
    };
  }
) {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const [existing, latestVersion] = await Promise.all([
    getSkillInOrg(id, orgId),
    db.query.skillVersions.findFirst({
      where: buildSkillVersionScopeCondition(id, orgId),
      orderBy: [desc(skillVersions.versionNumber)],
    }),
  ]);
  if (!existing) throw new Error("技能不存在");

  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  const [updated] = await db.transaction(async (tx) => {
    await tx.insert(skillVersions).values({
      skillId: id,
      organizationId: existing.organizationId,
      version: existing.version,
      versionNumber: nextVersionNumber,
      snapshot: {
        name: existing.name,
        description: existing.description,
        content: existing.content ?? "",
        category: existing.category,
        inputSchema: (existing.inputSchema as Record<string, string>) ?? undefined,
        outputSchema: (existing.outputSchema as Record<string, string>) ?? undefined,
        runtimeConfig: (existing.runtimeConfig as Record<string, unknown>) ?? undefined,
        compatibleRoles: (existing.compatibleRoles as string[]) ?? undefined,
      },
      changedBy: user.id,
      changeDescription: buildChangeDescription(existing, data),
    });

    return tx
      .update(skills)
      .set({
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.category ? { category: data.category } : {}),
        ...(data.description ? { description: data.description.trim() } : {}),
        ...(data.content !== undefined ? { content: data.content.trim() } : {}),
        ...(data.version ? { version: data.version.trim() } : {}),
        compatibleRoles: data.compatibleRoles ?? existing.compatibleRoles,
        ...(data.runtimeConfig !== undefined
          ? { runtimeConfig: data.runtimeConfig }
          : {}),
        updatedAt: new Date(),
      })
      .where(buildSkillAccessCondition(id, orgId))
      .returning();
  });

  // Bidirectional sync: in dev, write content back to skills/<slug>/SKILL.md
  // so runtime skill-loader's filesystem reads stay consistent with UI edits.
  // No-op in production (read-only filesystem on Vercel).
  if (data.content !== undefined && existing.slug) {
    const { writeSkillMdBody } = await import("@/lib/skill-md-sync");
    writeSkillMdBody(existing.slug, data.content.trim());
  }

  revalidatePath(`/skills/${id}`);
  return updated;
}

function buildChangeDescription(
  existing: {
    name: string;
    description: string;
    version: string;
    category: string;
    content: string | null;
  },
  data: {
    name?: string;
    description?: string;
    version?: string;
    category?: string;
    content?: string;
  }
): string {
  const changes: string[] = [];
  if (data.name && data.name !== existing.name) changes.push("名称");
  if (data.description && data.description !== existing.description)
    changes.push("描述");
  if (data.version && data.version !== existing.version)
    changes.push(`版本 → ${data.version}`);
  if (data.category && data.category !== existing.category) changes.push("分类");
  if (data.content !== undefined && data.content !== (existing.content ?? ""))
    changes.push("内容");
  return changes.length > 0 ? `修改: ${changes.join("、")}` : "更新";
}

// ---------------------------------------------------------------------------
// Skill Version Rollback
// ---------------------------------------------------------------------------

export async function rollbackSkillVersion(skillId: string, versionId: string) {
  const user = await requireAuth();
  const orgId = await requireCurrentOrgId();

  const [version, existing, latestVersion] = await Promise.all([
    getSkillVersionInOrg(versionId, orgId),
    getSkillInOrg(skillId, orgId),
    db.query.skillVersions.findFirst({
      where: buildSkillVersionScopeCondition(skillId, orgId),
      orderBy: [desc(skillVersions.versionNumber)],
    }),
  ]);

  if (!version) throw new Error("版本不存在");
  if (version.skillId !== skillId) throw new Error("版本不属于此技能");
  if (!existing) throw new Error("技能不存在");

  const snapshot = version.snapshot as {
    name: string;
    description: string;
    content: string;
    category: string;
    inputSchema?: Record<string, string>;
    outputSchema?: Record<string, string>;
    runtimeConfig?: Record<string, unknown>;
    compatibleRoles?: string[];
  };

  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  await db.transaction(async (tx) => {
    await tx.insert(skillVersions).values({
      skillId,
      organizationId: existing.organizationId,
      version: existing.version,
      versionNumber: nextVersionNumber,
      snapshot: {
        name: existing.name,
        description: existing.description,
        content: existing.content ?? "",
        category: existing.category,
      },
      changedBy: user.id,
      changeDescription: `回滚到版本 #${version.versionNumber}`,
    });

    await tx
      .update(skills)
      .set({
        name: snapshot.name,
        description: snapshot.description,
        content: snapshot.content,
        category: snapshot.category as SkillCategory,
        version: version.version,
        ...(snapshot.inputSchema ? { inputSchema: snapshot.inputSchema } : {}),
        ...(snapshot.outputSchema
          ? { outputSchema: snapshot.outputSchema }
          : {}),
        ...(snapshot.runtimeConfig
          ? {
              runtimeConfig: snapshot.runtimeConfig as {
                type: string;
                avgLatencyMs: number;
                maxConcurrency: number;
                modelDependency?: string;
              },
            }
          : {}),
        ...(snapshot.compatibleRoles
          ? { compatibleRoles: snapshot.compatibleRoles }
          : {}),
        updatedAt: new Date(),
      })
      .where(buildSkillAccessCondition(skillId, orgId));
  });

  revalidatePath(`/skills/${skillId}`);
}

/**
 * 删除一个 skill。DB 外键 cascade 会自动清 employee_skills / skill_versions /
 * skill_usage_records / skill_files。但 workflow_templates.steps 是 jsonb，
 * 无外键约束 —— 若存在引用必须先让用户从 workflow 里移除，避免产生僵尸引用
 * 导致后续工作流执行时找不到 skill。
 *
 * @param force 跳过工作流引用校验（仅管理员维护场景使用）
 */
export async function deleteSkill(id: string, opts?: { force?: boolean }) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  const existing = await getSkillInOrg(id, orgId);
  if (!existing) throw new Error("技能不存在");
  if (existing.type === "builtin") throw new Error("内置技能不可删除");

  // 检查工作流引用（非 force 模式下阻止删除）
  if (!opts?.force && existing.slug) {
    const referencingWorkflows = await findWorkflowsReferencingSkill(
      existing.slug,
      orgId,
    );
    if (referencingWorkflows.length > 0) {
      const names = referencingWorkflows
        .map((w) => w.name)
        .slice(0, 5)
        .join("、");
      const more =
        referencingWorkflows.length > 5
          ? `等 ${referencingWorkflows.length} 个`
          : "";
      throw new Error(
        `无法删除：该技能被工作流「${names}${more}」引用，请先在这些工作流中移除相关步骤后再删除。`,
      );
    }
  }

  await db.delete(skills).where(buildSkillAccessCondition(id, orgId));

  revalidatePath("/skills");
  revalidatePath("/workflows");
}

/**
 * 查找引用了指定 skill slug 的工作流（在 steps jsonb 里扫 config.skillSlug）。
 * 仅在 organization_id 范围内搜索。
 */
async function findWorkflowsReferencingSkill(
  skillSlug: string,
  orgId: string,
): Promise<{ id: string; name: string }[]> {
  // 用 jsonb_path_exists 精准匹配 steps 数组里任一元素的 config.skillSlug
  const rows = await db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
    })
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.organizationId, orgId),
        sql`jsonb_path_exists(
          ${workflowTemplates.steps},
          ('$[*].config.skillSlug ? (@ == "' || ${skillSlug} || '")')::jsonpath
        )`,
      ),
    );
  return rows;
}

// --- Skill Package Import/Export ---

export interface SkillExportData {
  id: string;
  name: string;
  slug: string | null;
  category: SkillCategory;
  type: string;
  version: string;
  description: string;
  content: string;
  inputSchema: Record<string, string> | null;
  outputSchema: Record<string, string> | null;
  runtimeConfig: {
    type: string;
    avgLatencyMs: number;
    maxConcurrency: number;
    modelDependency?: string;
  } | null;
  compatibleRoles: string[];
}

export async function getSkillsForExport(
  ids: string[]
): Promise<SkillExportData[]> {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  if (ids.length === 0) return [];
  if (ids.length > 100) throw new Error("单次最多导出 100 个技能");

  const rows = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      category: skills.category,
      type: skills.type,
      version: skills.version,
      description: skills.description,
      content: skills.content,
      inputSchema: skills.inputSchema,
      outputSchema: skills.outputSchema,
      runtimeConfig: skills.runtimeConfig,
      compatibleRoles: skills.compatibleRoles,
    })
    .from(skills)
    .where(
      and(
        inArray(skills.id, ids),
        or(eq(skills.organizationId, orgId), isNull(skills.organizationId))
      )
    );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category as SkillCategory,
    type: r.type,
    version: r.version,
    description: r.description,
    content: r.content ?? "",
    inputSchema: r.inputSchema ?? null,
    outputSchema: r.outputSchema ?? null,
    runtimeConfig: r.runtimeConfig ?? null,
    compatibleRoles: (r.compatibleRoles as string[]) ?? [],
  }));
}

export async function importSkillPackage(data: {
  name: string;
  description: string;
  category: SkillCategory;
  content: string;
  version?: string;
  files: { fileType: string; fileName: string; filePath: string; content: string }[];
}) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  if (!data.name.trim()) throw new Error("技能名称不能为空");
  if (!data.description.trim()) throw new Error("技能描述不能为空");

  await db.transaction(async (tx) => {
    const [newSkill] = await tx
      .insert(skills)
      .values({
        organizationId: orgId,
        name: data.name.trim(),
        category: data.category,
        type: "custom",
        version: data.version?.trim() || "1.0",
        description: data.description.trim(),
        content: data.content,
        compatibleRoles: [],
      })
      .returning({ id: skills.id });

    if (data.files.length > 0) {
      await tx.insert(skillFiles).values(
        data.files.map((f) => ({
          skillId: newSkill.id,
          organizationId: orgId,
          fileType: f.fileType,
          fileName: f.fileName,
          filePath: f.filePath,
          content: f.content,
        }))
      );
    }
  });

  revalidatePath("/skills");
}

/**
 * Import a single SKILL.md file as a custom skill.
 * Parses enriched frontmatter for metadata, stores content in DB.
 */
export async function importSkillMd(data: {
  rawContent: string;
  category?: SkillCategory;
}) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  if (data.rawContent.length > 500_000) {
    throw new Error("文件内容过大（最大 500KB）");
  }

  const { name, description, body, meta } = parseFrontmatter(data.rawContent);

  if (!name.trim()) throw new Error("SKILL.md 缺少 name 字段");
  if (!body.trim()) throw new Error("SKILL.md 内容为空");

  const category = meta.category ?? data.category;
  if (!category) throw new Error("请指定技能分类（SKILL.md 中缺少 category 字段）");

  const [newSkill] = await db
    .insert(skills)
    .values({
      organizationId: orgId,
      name: meta.displayName || name,
      category,
      type: "custom",
      version: meta.version?.trim() || "1.0",
      description: description || name,
      content: body,
      inputSchema: meta.inputSchema ?? null,
      outputSchema: meta.outputSchema ?? null,
      runtimeConfig: meta.runtimeConfig ?? null,
      compatibleRoles: meta.compatibleRoles ?? [],
    })
    .returning({ id: skills.id });

  revalidatePath("/skills");
  return { skillId: newSkill.id };
}

export async function addSkillFile(
  skillId: string,
  data: { fileType: string; fileName: string; filePath: string; content: string }
) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  const existing = await getSkillInOrg(skillId, orgId);
  if (!existing) throw new Error("技能不存在");

  await db.insert(skillFiles).values({
    skillId,
    organizationId: orgId,
    fileType: data.fileType,
    fileName: data.fileName,
    filePath: data.filePath,
    content: data.content,
  });

  revalidatePath(`/skills/${skillId}`);
}

export async function updateSkillFile(
  fileId: string,
  data: { content: string }
) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  const file = await getSkillFileInOrg(fileId, orgId);
  if (!file) throw new Error("技能文件不存在");

  await db
    .update(skillFiles)
    .set({ content: data.content, updatedAt: new Date() })
    .where(buildSkillFileAccessCondition(fileId, orgId));

  revalidatePath(`/skills/${file.skillId}`);
}

export async function deleteSkillFile(fileId: string) {
  await requireAuth();
  const orgId = await requireCurrentOrgId();

  const file = await getSkillFileInOrg(fileId, orgId);
  if (!file) throw new Error("技能文件不存在");

  await db
    .delete(skillFiles)
    .where(buildSkillFileAccessCondition(fileId, orgId));

  revalidatePath(`/skills/${file.skillId}`);
}

// ---------------------------------------------------------------------------
// Skill Usage Records (S8.03)
// ---------------------------------------------------------------------------

export async function recordSkillUsage(data: {
  skillId: string;
  employeeId: string;
  success: boolean;
  qualityScore?: number;
  executionTimeMs?: number;
  tokenUsage?: number;
  errorMessage?: string;
  inputSummary?: string;
  outputSummary?: string;
  missionId?: string;
  missionTaskId?: string;
}) {
  const orgId = await getCurrentUserOrg();

  await db.insert(skillUsageRecords).values({
    skillId: data.skillId,
    employeeId: data.employeeId,
    organizationId: orgId,
    success: data.success ? 1 : 0,
    qualityScore: data.qualityScore ?? null,
    executionTimeMs: data.executionTimeMs ?? null,
    tokenUsage: data.tokenUsage ?? null,
    errorMessage: data.errorMessage ?? null,
    inputSummary: data.inputSummary ?? null,
    outputSummary: data.outputSummary ?? null,
    missionId: data.missionId ?? null,
    missionTaskId: data.missionTaskId ?? null,
  });
}

export interface SkillUsageStats {
  skillId: string;
  skillName: string;
  totalUsages: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgQualityScore: number | null;
  avgExecutionTimeMs: number | null;
  lastUsedAt: string | null;
}

export async function getSkillUsageStats(
  skillId: string
): Promise<SkillUsageStats | null> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return null;

  const skill = await getSkillInOrg(skillId, orgId);
  if (!skill) return null;

  const [stats] = await db
    .select({
      totalUsages: sql<number>`count(*)::int`,
      successCount: sql<number>`sum(case when ${skillUsageRecords.success} = 1 then 1 else 0 end)::int`,
      failureCount: sql<number>`sum(case when ${skillUsageRecords.success} = 0 then 1 else 0 end)::int`,
      avgQualityScore: sql<number | null>`avg(${skillUsageRecords.qualityScore})::int`,
      avgExecutionTimeMs: sql<number | null>`avg(${skillUsageRecords.executionTimeMs})::int`,
      lastUsedAt: sql<string | null>`max(${skillUsageRecords.createdAt})::text`,
    })
    .from(skillUsageRecords)
    .where(
      and(
        eq(skillUsageRecords.skillId, skillId),
        eq(skillUsageRecords.organizationId, orgId)
      )
    );

  const total = stats.totalUsages || 0;
  const successCount = stats.successCount || 0;

  return {
    skillId,
    skillName: skill.name,
    totalUsages: total,
    successCount,
    failureCount: stats.failureCount || 0,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    avgQualityScore: stats.avgQualityScore,
    avgExecutionTimeMs: stats.avgExecutionTimeMs,
    lastUsedAt: stats.lastUsedAt,
  };
}

export async function getEmployeeSkillUsageStats(
  employeeId: string
): Promise<SkillUsageStats[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db
    .select({
      skillId: skillUsageRecords.skillId,
      skillName: skills.name,
      totalUsages: sql<number>`count(*)::int`,
      successCount: sql<number>`sum(case when ${skillUsageRecords.success} = 1 then 1 else 0 end)::int`,
      failureCount: sql<number>`sum(case when ${skillUsageRecords.success} = 0 then 1 else 0 end)::int`,
      avgQualityScore: sql<number | null>`avg(${skillUsageRecords.qualityScore})::int`,
      avgExecutionTimeMs: sql<number | null>`avg(${skillUsageRecords.executionTimeMs})::int`,
      lastUsedAt: sql<string | null>`max(${skillUsageRecords.createdAt})::text`,
    })
    .from(skillUsageRecords)
    .innerJoin(skills, eq(skillUsageRecords.skillId, skills.id))
    .where(
      and(
        eq(skillUsageRecords.employeeId, employeeId),
        eq(skillUsageRecords.organizationId, orgId),
        or(eq(skills.organizationId, orgId), isNull(skills.organizationId))
      )
    )
    .groupBy(skillUsageRecords.skillId, skills.name);

  return rows.map((r) => ({
    skillId: r.skillId,
    skillName: r.skillName,
    totalUsages: r.totalUsages || 0,
    successCount: r.successCount || 0,
    failureCount: r.failureCount || 0,
    successRate:
      r.totalUsages > 0
        ? Math.round(((r.successCount || 0) / r.totalUsages) * 100)
        : 0,
    avgQualityScore: r.avgQualityScore,
    avgExecutionTimeMs: r.avgExecutionTimeMs,
    lastUsedAt: r.lastUsedAt,
  }));
}

// ---------------------------------------------------------------------------
// Internal: Record Skill Usage (no auth required, for Inngest background tasks)
// ---------------------------------------------------------------------------

/**
 * Internal function for recording skill usage without user session.
 * Used by Inngest background tasks (execute-mission-task).
 */
export async function recordSkillUsageInternal(data: {
  skillId: string;
  employeeId: string;
  organizationId: string;
  missionId?: string;
  missionTaskId?: string;
  success: boolean;
  qualityScore?: number;
  executionTimeMs?: number;
  tokenUsage?: number;
  errorMessage?: string;
}) {
  await db.insert(skillUsageRecords).values({
    skillId: data.skillId,
    employeeId: data.employeeId,
    organizationId: data.organizationId,
    missionId: data.missionId ?? null,
    missionTaskId: data.missionTaskId ?? null,
    success: data.success ? 1 : 0,
    qualityScore: data.qualityScore ?? null,
    executionTimeMs: data.executionTimeMs ?? null,
    tokenUsage: data.tokenUsage ?? null,
    errorMessage: data.errorMessage ?? null,
  });
}
