import { db } from "@/db";
import {
  skills,
  employeeSkills,
  aiEmployees,
  skillFiles,
  skillVersions,
  skillUsageRecords,
} from "@/db/schema";
import { and, count, desc, eq, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { Skill, SkillCategory } from "@/lib/types";
import type { SkillFileRow, SkillVersionRow } from "@/db/types";
import { getCurrentUserOrg } from "@/lib/dal/auth";

export interface SkillWithBindCount extends Skill {
  bindCount: number;
  updatedAt: string;
}

export interface BoundEmployee {
  id: string;
  name: string;
  nickname: string;
  roleType: string;
  level: number;
}

export interface PluginConfigData {
  endpoint: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  authType?: "none" | "api_key" | "bearer";
  authKey?: string;
  requestTemplate?: string;
  responseMapping?: Record<string, string>;
  timeoutMs?: number;
}

export interface SkillRuntimeConfig {
  type: string;
  avgLatencyMs: number;
  maxConcurrency: number;
  modelDependency?: string;
}

export interface SkillDetail {
  id: string;
  name: string;
  category: SkillCategory;
  type: "builtin" | "custom" | "plugin";
  version: string;
  description: string;
  content: string;
  compatibleRoles: string[];
  inputSchema?: Record<string, string> | null;
  outputSchema?: Record<string, string> | null;
  runtimeConfig?: SkillRuntimeConfig | null;
  pluginConfig?: PluginConfigData | null;
  bindCount: number;
  createdAt: string;
  updatedAt: string;
  boundEmployees: BoundEmployee[];
}

function mapSkillSummary(s: {
  id: string;
  name: string;
  category: string;
  version: string;
  type: string;
  description: string;
}): Skill {
  return {
    id: s.id,
    name: s.name,
    category: s.category as SkillCategory,
    version: s.version,
    level: 0,
    type: s.type as "builtin" | "custom" | "plugin",
    description: s.description,
  };
}

function buildSkillScopeCondition(orgId: string | null) {
  return orgId
    ? or(eq(skills.organizationId, orgId), isNull(skills.organizationId))
    : undefined;
}

function buildSkillAccessCondition(id: string, orgId: string | null) {
  return orgId
    ? and(eq(skills.id, id), or(eq(skills.organizationId, orgId), isNull(skills.organizationId)))
    : eq(skills.id, id);
}

type ScopedSkillRow = {
  organizationId: string | null;
  name: string;
  type: string;
  category: string;
};

function getScopedSkillKey(skill: ScopedSkillRow) {
  return `${skill.type}::${skill.category}::${skill.name}`;
}

function preferScopedSkillRows<T extends ScopedSkillRow>(rows: T[], orgId: string | null): T[] {
  if (!orgId) return rows;

  const keysWithOrgSpecific = new Set(
    rows
      .filter((row) => row.organizationId === orgId)
      .map((row) => getScopedSkillKey(row))
  );

  return rows.filter(
    (row) => !(row.organizationId === null && keysWithOrgSpecific.has(getScopedSkillKey(row)))
  );
}

async function findSkillRecord(
  where: SQL<unknown> | undefined
) {
  try {
    return await db.query.skills.findFirst({ where });
  } catch {
    const rows = await db
      .select({
        id: skills.id,
        organizationId: skills.organizationId,
        name: skills.name,
        category: skills.category,
        type: skills.type,
        version: skills.version,
        description: skills.description,
        content: sql<string>`''`,
        compatibleRoles: skills.compatibleRoles,
        inputSchema: skills.inputSchema,
        outputSchema: skills.outputSchema,
        runtimeConfig: skills.runtimeConfig,
        pluginConfig: sql<PluginConfigData | null>`null`,
        createdAt: skills.createdAt,
        updatedAt: skills.updatedAt,
      })
      .from(skills)
      .where(where)
      .limit(1);

    return rows[0] ?? null;
  }
}

export async function getSkills(category?: SkillCategory): Promise<Skill[]> {
  const orgId = await getCurrentUserOrg();
  const skillScope = buildSkillScopeCondition(orgId);

  const rows = await db.query.skills.findMany({
    ...(category || skillScope
      ? {
          where:
            category && skillScope
              ? and(skillScope, eq(skills.category, category))
              : category
                ? eq(skills.category, category)
                : skillScope,
        }
      : {}),
    orderBy: (s, { asc }) => [asc(s.category), asc(s.name)],
  });

  return preferScopedSkillRows(rows, orgId).map(mapSkillSummary);
}

export async function getSkillsWithBindCount(): Promise<SkillWithBindCount[]> {
  const orgId = await getCurrentUserOrg();
  const skillScope = buildSkillScopeCondition(orgId);

  const rows = await db
    .select({
      id: skills.id,
      organizationId: skills.organizationId,
      name: skills.name,
      category: skills.category,
      type: skills.type,
      version: skills.version,
      description: skills.description,
      compatibleRoles: skills.compatibleRoles,
      updatedAt: skills.updatedAt,
      bindCount: count(aiEmployees.id),
    })
    .from(skills)
    .leftJoin(employeeSkills, eq(skills.id, employeeSkills.skillId))
    .leftJoin(
      aiEmployees,
      orgId
        ? and(
            eq(employeeSkills.employeeId, aiEmployees.id),
            eq(aiEmployees.organizationId, orgId)
          )
        : eq(employeeSkills.employeeId, aiEmployees.id)
    )
    .where(skillScope)
    .groupBy(skills.id)
    .orderBy(skills.category, skills.name, skills.updatedAt);

  return preferScopedSkillRows(rows, orgId).map((s) => ({
    ...mapSkillSummary(s),
    compatibleRoles: (s.compatibleRoles ?? []) as string[],
    bindCount: Number(s.bindCount),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function getSkillById(id: string) {
  const orgId = await getCurrentUserOrg();

  const row = await findSkillRecord(buildSkillAccessCondition(id, orgId));
  if (!row) return null;
  return row;
}

export async function getSkillDetail(id: string): Promise<SkillDetail | null> {
  const orgId = await getCurrentUserOrg();

  const [row, bindings] = await Promise.all([
    findSkillRecord(buildSkillAccessCondition(id, orgId)),
    db
      .select({
        employeeId: employeeSkills.employeeId,
        level: employeeSkills.level,
        name: aiEmployees.name,
        nickname: aiEmployees.nickname,
        roleType: aiEmployees.roleType,
      })
      .from(employeeSkills)
      .innerJoin(aiEmployees, eq(employeeSkills.employeeId, aiEmployees.id))
      .where(
        orgId
          ? and(
              eq(employeeSkills.skillId, id),
              eq(aiEmployees.organizationId, orgId)
            )
          : eq(employeeSkills.skillId, id)
      ),
  ]);
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    category: row.category as SkillCategory,
    type: row.type as "builtin" | "custom" | "plugin",
    version: row.version,
    description: row.description,
    content: row.content ?? "",
    compatibleRoles: (row.compatibleRoles ?? []) as string[],
    inputSchema: row.inputSchema as Record<string, string> | null,
    outputSchema: row.outputSchema as Record<string, string> | null,
    runtimeConfig: row.runtimeConfig as SkillRuntimeConfig | null,
    pluginConfig:
      row.type === "plugin"
        ? (row.pluginConfig as PluginConfigData | null)
        : null,
    bindCount: bindings.length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    boundEmployees: bindings.map((b) => ({
      id: b.employeeId,
      name: b.name,
      nickname: b.nickname,
      roleType: b.roleType,
      level: b.level,
    })),
  };
}

export interface SkillDetailWithFiles extends SkillDetail {
  files: SkillFileRow[];
}

export async function getSkillFiles(skillId: string): Promise<SkillFileRow[]> {
  const orgId = await getCurrentUserOrg();

  return db.query.skillFiles.findMany({
    where: orgId
      ? and(
          eq(skillFiles.skillId, skillId),
          or(eq(skillFiles.organizationId, orgId), isNull(skillFiles.organizationId))
        )
      : eq(skillFiles.skillId, skillId),
    orderBy: (f, { asc }) => [asc(f.fileType), asc(f.fileName)],
  });
}

export async function getSkillDetailWithFiles(
  id: string
): Promise<SkillDetailWithFiles | null> {
  const [detail, files] = await Promise.all([getSkillDetail(id), getSkillFiles(id)]);
  if (!detail) return null;

  return { ...detail, files };
}

export async function getSkillsNotBoundToEmployee(
  employeeId: string
): Promise<Skill[]> {
  const orgId = await getCurrentUserOrg();
  const skillScope = buildSkillScopeCondition(orgId);

  const boundSkills = await db
    .select({ skillId: employeeSkills.skillId })
    .from(employeeSkills)
    .innerJoin(aiEmployees, eq(employeeSkills.employeeId, aiEmployees.id))
    .where(
      orgId
        ? and(
            eq(employeeSkills.employeeId, employeeId),
            eq(aiEmployees.organizationId, orgId)
          )
        : eq(employeeSkills.employeeId, employeeId)
    );

  const boundIds = boundSkills.map((s) => s.skillId);

  const rows = await db.query.skills.findMany({
    ...((skillScope || boundIds.length > 0)
      ? {
          where:
            skillScope && boundIds.length > 0
              ? and(skillScope, notInArray(skills.id, boundIds))
              : skillScope
                ? skillScope
                : notInArray(skills.id, boundIds),
        }
      : {}),
    orderBy: (s, { asc }) => [asc(s.category), asc(s.name)],
  });

  return preferScopedSkillRows(rows, orgId).map(mapSkillSummary);
}

// ---------------------------------------------------------------------------
// Skill Version History
// ---------------------------------------------------------------------------

export async function getSkillVersionHistory(
  skillId: string
): Promise<SkillVersionRow[]> {
  const orgId = await getCurrentUserOrg();

  return db.query.skillVersions.findMany({
    where: orgId
      ? and(
          eq(skillVersions.skillId, skillId),
          or(eq(skillVersions.organizationId, orgId), isNull(skillVersions.organizationId))
        )
      : eq(skillVersions.skillId, skillId),
    orderBy: [desc(skillVersions.versionNumber)],
  });
}

export async function getSkillVersion(
  versionId: string
): Promise<SkillVersionRow | undefined> {
  const orgId = await getCurrentUserOrg();

  return db.query.skillVersions.findFirst({
    where: orgId
      ? and(
          eq(skillVersions.id, versionId),
          or(eq(skillVersions.organizationId, orgId), isNull(skillVersions.organizationId))
        )
      : eq(skillVersions.id, versionId),
  });
}

export async function getLatestVersionNumber(
  skillId: string
): Promise<number> {
  const orgId = await getCurrentUserOrg();

  const latest = await db.query.skillVersions.findFirst({
    where: orgId
      ? and(
          eq(skillVersions.skillId, skillId),
          or(eq(skillVersions.organizationId, orgId), isNull(skillVersions.organizationId))
        )
      : eq(skillVersions.skillId, skillId),
    orderBy: [desc(skillVersions.versionNumber)],
  });
  return latest?.versionNumber ?? 0;
}

// ---------------------------------------------------------------------------
// Skill Recommendations
// ---------------------------------------------------------------------------

export interface SkillRecommendation {
  skill: Skill;
  reason: string;
  score: number;
}

export async function getSkillRecommendations(
  employeeId: string,
  roleType: string
): Promise<SkillRecommendation[]> {
  const orgId = await getCurrentUserOrg();
  const skillScope = buildSkillScopeCondition(orgId);

  const boundSkills = await db
    .select({ skillId: employeeSkills.skillId })
    .from(employeeSkills)
    .innerJoin(aiEmployees, eq(employeeSkills.employeeId, aiEmployees.id))
    .where(
      orgId
        ? and(
            eq(employeeSkills.employeeId, employeeId),
            eq(aiEmployees.organizationId, orgId)
          )
        : eq(employeeSkills.employeeId, employeeId)
    );
  const boundIds = new Set(boundSkills.map((s) => s.skillId));

  const allSkillsRaw = await db.query.skills.findMany({
    ...(skillScope ? { where: skillScope } : {}),
    orderBy: (s, { asc }) => [asc(s.category), asc(s.name)],
  });
  const allSkills = preferScopedSkillRows(allSkillsRaw, orgId);

  const recommendations: SkillRecommendation[] = [];

  const boundCategories = new Set<string>();
  for (const bs of boundSkills) {
    const skill = allSkills.find((sk) => sk.id === bs.skillId);
    if (skill) boundCategories.add(skill.category);
  }

  for (const s of allSkills) {
    if (boundIds.has(s.id)) continue;

    let score = 0;
    let reason = "";

    const compatibleRoles = (s.compatibleRoles as string[]) || [];
    if (compatibleRoles.length > 0 && !compatibleRoles.includes(roleType)) {
      continue;
    }

    if (compatibleRoles.length > 0 && compatibleRoles.includes(roleType)) {
      score += 40;
      reason = "与当前角色高度匹配";
    }

    if (!boundCategories.has(s.category)) {
      score += 20;
      reason = reason || "可扩展能力范围到新分类";
    }

    if (s.type === "builtin") {
      score += 10;
    }

    if (score > 0) {
      recommendations.push({
        skill: mapSkillSummary(s),
        reason: reason || "推荐绑定",
        score,
      });
    }
  }

  return recommendations.sort((a, b) => b.score - a.score).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Consolidated Detail Page Query (single call for all detail page data)
// ---------------------------------------------------------------------------

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

export interface SkillDetailPageData {
  skill: SkillDetailWithFiles;
  versions: SkillVersionRow[];
  usageStats: SkillUsageStats | null;
}

export async function getSkillDetailPageData(
  id: string
): Promise<SkillDetailPageData | null> {
  const orgId = await getCurrentUserOrg();

  const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
    p.catch(() => fallback);

  const [row, bindings, files, versions, usageStatsRows] = await Promise.all([
    findSkillRecord(buildSkillAccessCondition(id, orgId)),
    safe(
      db
        .select({
          employeeId: employeeSkills.employeeId,
          level: employeeSkills.level,
          name: aiEmployees.name,
          nickname: aiEmployees.nickname,
          roleType: aiEmployees.roleType,
        })
        .from(employeeSkills)
        .innerJoin(aiEmployees, eq(employeeSkills.employeeId, aiEmployees.id))
        .where(
          orgId
            ? and(
                eq(employeeSkills.skillId, id),
                eq(aiEmployees.organizationId, orgId)
              )
            : eq(employeeSkills.skillId, id)
        ),
      []
    ),
    safe(
      db.query.skillFiles.findMany({
        where: orgId
          ? and(
              eq(skillFiles.skillId, id),
              or(eq(skillFiles.organizationId, orgId), isNull(skillFiles.organizationId))
            )
          : eq(skillFiles.skillId, id),
        orderBy: (f, { asc }) => [asc(f.fileType), asc(f.fileName)],
      }),
      []
    ),
    safe(
      db.query.skillVersions.findMany({
        where: orgId
          ? and(
              eq(skillVersions.skillId, id),
              or(eq(skillVersions.organizationId, orgId), isNull(skillVersions.organizationId))
            )
          : eq(skillVersions.skillId, id),
        orderBy: [desc(skillVersions.versionNumber)],
      }),
      []
    ),
    safe(
      db
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
          orgId
            ? and(
                eq(skillUsageRecords.skillId, id),
                eq(skillUsageRecords.organizationId, orgId)
              )
            : eq(skillUsageRecords.skillId, id)
        ),
      []
    ),
  ]);

  if (!row) return null;

  const skill: SkillDetailWithFiles = {
    id: row.id,
    name: row.name,
    category: row.category as SkillCategory,
    type: row.type as "builtin" | "custom" | "plugin",
    version: row.version,
    description: row.description,
    content: row.content ?? "",
    compatibleRoles: (row.compatibleRoles ?? []) as string[],
    inputSchema: row.inputSchema as Record<string, string> | null,
    outputSchema: row.outputSchema as Record<string, string> | null,
    runtimeConfig: row.runtimeConfig as SkillRuntimeConfig | null,
    pluginConfig:
      row.type === "plugin"
        ? (row.pluginConfig as PluginConfigData | null)
        : null,
    bindCount: bindings.length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    boundEmployees: bindings.map((b) => ({
      id: b.employeeId,
      name: b.name,
      nickname: b.nickname,
      roleType: b.roleType,
      level: b.level,
    })),
    files,
  };

  const stats = usageStatsRows[0];
  const total = stats?.totalUsages || 0;
  const successCount = stats?.successCount || 0;

  const usageStats: SkillUsageStats = {
    skillId: id,
    skillName: row.name,
    totalUsages: total,
    successCount,
    failureCount: stats?.failureCount || 0,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    avgQualityScore: stats?.avgQualityScore ?? null,
    avgExecutionTimeMs: stats?.avgExecutionTimeMs ?? null,
    lastUsedAt: stats?.lastUsedAt ?? null,
  };

  return { skill, versions, usageStats };
}
