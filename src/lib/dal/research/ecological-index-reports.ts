// src/lib/dal/research/ecological-index-reports.ts
//
// 生态文明传播指数报告 - DAL (ecological_index sourceType 专用)
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §4.2 / §8.1
//
// 与现有 research_reports 表共用 schema,只是 sourceType='ecological_index'
//
// 多租户 scope: 所有读写函数强制 organizationId 隔离 + sourceType 过滤,防跨 org / 跨类型越权。

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  researchReports,
  type EcologicalIndexSnapshot,
  type EcologicalIndexAggregates,
} from "@/db/schema/research/reports";
import { userProfiles } from "@/db/schema/users";

export type EcologicalIndexReportStatus =
  | "pending"
  | "generating"
  | "ready"
  | "failed";

export type EcologicalIndexReportSummary = {
  id: string;
  title: string;
  status: EcologicalIndexReportStatus;
  currentStep: string | null;
  errorMessage: string | null;
  scopeId: string;
  activityDatasetId: string;
  year: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  generatedByName: string | null;
};

export type EcologicalIndexReportDetail = EcologicalIndexReportSummary & {
  searchSnapshot: EcologicalIndexSnapshot;
  aggregatesJson: EcologicalIndexAggregates | null;
  wordFileUrl: string | null;
  excelFileUrl: string | null;
  contentSourceFileUrls: {
    central?: string | null;
    industry?: string | null;
    municipal?: string | null;
    district?: string | null;
  } | null;
};

/**
 * 列出 org 下所有 ecological_index 报告(按创建时间倒序)
 */
export async function listEcologicalIndexReportsByOrg(
  orgId: string,
): Promise<EcologicalIndexReportSummary[]> {
  const rows = await db
    .select({
      id: researchReports.id,
      title: researchReports.title,
      status: researchReports.status,
      currentStep: researchReports.currentStep,
      errorMessage: researchReports.errorMessage,
      searchSnapshot: researchReports.searchSnapshot,
      createdAt: researchReports.createdAt,
      startedAt: researchReports.startedAt,
      completedAt: researchReports.completedAt,
      generatedByName: userProfiles.displayName,
    })
    .from(researchReports)
    .leftJoin(userProfiles, eq(userProfiles.id, researchReports.generatedBy))
    .where(
      and(
        eq(researchReports.organizationId, orgId),
        eq(researchReports.sourceType, "ecological_index"),
      ),
    )
    .orderBy(desc(researchReports.createdAt));

  return rows.map((r) => {
    const snap = r.searchSnapshot as EcologicalIndexSnapshot;
    return {
      id: r.id,
      title: r.title,
      status: r.status as EcologicalIndexReportStatus,
      currentStep: r.currentStep,
      errorMessage: r.errorMessage,
      scopeId: snap.scopeId,
      activityDatasetId: snap.activityDatasetId,
      year: snap.year,
      createdAt: r.createdAt,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      generatedByName: r.generatedByName,
    };
  });
}

/**
 * 获取详情(含 aggregatesJson / 3 个文件 URL)
 * org-scope 防越权(跨 org 返 null,不抛)
 */
export async function getEcologicalIndexReportById(
  orgId: string,
  reportId: string,
): Promise<EcologicalIndexReportDetail | null> {
  const [row] = await db
    .select({
      id: researchReports.id,
      title: researchReports.title,
      status: researchReports.status,
      currentStep: researchReports.currentStep,
      errorMessage: researchReports.errorMessage,
      searchSnapshot: researchReports.searchSnapshot,
      aggregatesJson: researchReports.aggregatesJson,
      wordFileUrl: researchReports.wordFileUrl,
      excelFileUrl: researchReports.excelFileUrl,
      contentSourceFileUrls: researchReports.contentSourceFileUrls,
      createdAt: researchReports.createdAt,
      startedAt: researchReports.startedAt,
      completedAt: researchReports.completedAt,
      generatedByName: userProfiles.displayName,
    })
    .from(researchReports)
    .leftJoin(userProfiles, eq(userProfiles.id, researchReports.generatedBy))
    .where(
      and(
        eq(researchReports.id, reportId),
        eq(researchReports.organizationId, orgId),
        eq(researchReports.sourceType, "ecological_index"),
      ),
    )
    .limit(1);

  if (!row) return null;
  const snap = row.searchSnapshot as EcologicalIndexSnapshot;
  return {
    id: row.id,
    title: row.title,
    status: row.status as EcologicalIndexReportStatus,
    currentStep: row.currentStep,
    errorMessage: row.errorMessage,
    scopeId: snap.scopeId,
    activityDatasetId: snap.activityDatasetId,
    year: snap.year,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    generatedByName: row.generatedByName,
    searchSnapshot: snap,
    aggregatesJson: row.aggregatesJson as EcologicalIndexAggregates | null,
    wordFileUrl: row.wordFileUrl,
    excelFileUrl: row.excelFileUrl,
    contentSourceFileUrls:
      row.contentSourceFileUrls as EcologicalIndexReportDetail["contentSourceFileUrls"],
  };
}

/**
 * 创建报告(初始状态 pending),供 Server Action 用
 */
export async function createEcologicalIndexReport(input: {
  organizationId: string;
  title: string;
  searchSnapshot: EcologicalIndexSnapshot;
  generatedBy: string;
}): Promise<{ reportId: string }> {
  const [row] = await db
    .insert(researchReports)
    .values({
      organizationId: input.organizationId,
      sourceType: "ecological_index",
      title: input.title,
      searchSnapshot: input.searchSnapshot,
      status: "pending",
      generatedBy: input.generatedBy,
    })
    .returning({ id: researchReports.id });
  if (!row) throw new Error("create ecological_index report failed");
  return { reportId: row.id };
}

/**
 * Inngest 流水线用: 更新状态 + step + 错误 + 产物 URL
 * (调用方自己保证 reportId 已经过 org 校验,内部无 org-scope 过滤)
 */
export type StatusUpdate = {
  status?: EcologicalIndexReportStatus;
  currentStep?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  aggregatesJson?: EcologicalIndexAggregates;
  wordFileUrl?: string | null;
  excelFileUrl?: string | null;
  contentSourceFileUrls?: EcologicalIndexReportDetail["contentSourceFileUrls"];
};

export async function updateEcologicalIndexReportStatus(
  reportId: string,
  update: StatusUpdate,
): Promise<void> {
  const setData: Record<string, unknown> = {};
  if (update.status !== undefined) setData["status"] = update.status;
  if (update.currentStep !== undefined) setData["currentStep"] = update.currentStep;
  if (update.errorMessage !== undefined) setData["errorMessage"] = update.errorMessage;
  if (update.startedAt !== undefined) setData["startedAt"] = update.startedAt;
  if (update.completedAt !== undefined) setData["completedAt"] = update.completedAt;
  if (update.aggregatesJson !== undefined) setData["aggregatesJson"] = update.aggregatesJson;
  if (update.wordFileUrl !== undefined) setData["wordFileUrl"] = update.wordFileUrl;
  if (update.excelFileUrl !== undefined) setData["excelFileUrl"] = update.excelFileUrl;
  if (update.contentSourceFileUrls !== undefined) {
    setData["contentSourceFileUrls"] = update.contentSourceFileUrls;
  }

  if (Object.keys(setData).length === 0) return;
  await db
    .update(researchReports)
    .set(setData)
    .where(eq(researchReports.id, reportId));
}

/**
 * 删除报告(org-scope + sourceType 双过滤)
 */
export async function deleteEcologicalIndexReport(
  orgId: string,
  reportId: string,
): Promise<void> {
  await db
    .delete(researchReports)
    .where(
      and(
        eq(researchReports.id, reportId),
        eq(researchReports.organizationId, orgId),
        eq(researchReports.sourceType, "ecological_index"),
      ),
    );
}

/**
 * 实时预估某 scope/year 的覆盖率(供 UI 在选 scope+year 时立刻展示)
 * 返回 outlet 匹配数 + 命中 items / 总 items + 各 tier 分布
 *
 * 注意:
 * - 复用 research_media_scope_units.resolved_outlet_ids(P1 落地);
 *   若 units 尚未 resolve(matcher 还没跑) → matchedOutletCount = 0,UI 应提示先 resolve
 * - district_rmt + district_gov 合并归到 district tier(展示侧)
 */
export type ScopeCoveragePreview = {
  matchedOutletCount: number;
  itemsInScope: number;
  itemsTotal: number;
  retentionPct: number;
  byTier: {
    central: number;
    industry: number;
    municipal: number;
    district: number;
  };
};

type ScopeUnitTierRow = {
  tier: string;
  outlet_ids: string[] | null;
};

export async function previewScopeCoverage(
  orgId: string,
  scopeId: string,
  year: number,
): Promise<ScopeCoveragePreview> {
  const yearStart = new Date(`${year}-01-01T00:00:00Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00Z`);

  // 1. 查 scope units 已经 resolve 的 outlet ids,按 tier 分组
  const unitsResult = await db.execute(sql`
    SELECT u.tier AS tier, u.resolved_outlet_ids AS outlet_ids
    FROM research_media_scope_units u
    INNER JOIN research_media_scopes s ON s.id = u.scope_id
    WHERE u.scope_id = ${scopeId}::uuid
      AND s.organization_id = ${orgId}::uuid
  `);
  const unitsRows = unitsResult as unknown as ScopeUnitTierRow[];

  // 2. 把 outlet ids 按 tier 归并(scope_unit_tier → media_tier:
  //    district_rmt + district_gov = district)
  const byTier: Record<"central" | "industry" | "municipal" | "district", string[]> = {
    central: [],
    industry: [],
    municipal: [],
    district: [],
  };
  for (const r of unitsRows) {
    if (!r.outlet_ids || r.outlet_ids.length === 0) continue;
    const target: keyof typeof byTier | null =
      r.tier === "central"
        ? "central"
        : r.tier === "industry"
          ? "industry"
          : r.tier === "municipal"
            ? "municipal"
            : r.tier === "district_rmt" || r.tier === "district_gov"
              ? "district"
              : null;
    if (!target) continue;
    for (const id of r.outlet_ids) byTier[target].push(id);
  }
  const allOutlets = [
    ...byTier.central,
    ...byTier.industry,
    ...byTier.municipal,
    ...byTier.district,
  ];

  // 3. 查各 tier items 数(分母在 step 4 总查)
  const byTierCounts: Record<"central" | "industry" | "municipal" | "district", number> = {
    central: 0,
    industry: 0,
    municipal: 0,
    district: 0,
  };
  if (allOutlets.length > 0) {
    for (const tier of ["central", "industry", "municipal", "district"] as const) {
      const ids = byTier[tier];
      if (ids.length === 0) continue;
      // 用 jsonb 数组参数 + jsonb_array_elements_text → uuid 转型,避免拼接巨长 SQL
      const idsJson = JSON.stringify(ids);
      const result = await db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM collected_items
        WHERE organization_id = ${orgId}::uuid
          AND outlet_id IN (
            SELECT (value)::uuid FROM jsonb_array_elements_text(${idsJson}::jsonb)
          )
          AND published_at >= ${yearStart.toISOString()}
          AND published_at < ${yearEnd.toISOString()}
      `);
      const rows = result as unknown as Array<{ n: number }>;
      byTierCounts[tier] = rows[0]?.n ?? 0;
    }
  }
  const itemsInScope =
    byTierCounts.central +
    byTierCounts.industry +
    byTierCounts.municipal +
    byTierCounts.district;

  // 4. 查总 items 数(同时间窗,作为分母)
  const totalRes = await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM collected_items
    WHERE organization_id = ${orgId}::uuid
      AND published_at >= ${yearStart.toISOString()}
      AND published_at < ${yearEnd.toISOString()}
  `);
  const totalRows = totalRes as unknown as Array<{ n: number }>;
  const itemsTotal = totalRows[0]?.n ?? 0;

  const matchedOutletCount = new Set(allOutlets).size;
  const retentionPct = itemsTotal > 0 ? (itemsInScope / itemsTotal) * 100 : 0;

  return {
    matchedOutletCount,
    itemsInScope,
    itemsTotal,
    retentionPct,
    byTier: byTierCounts,
  };
}
