// src/lib/dal/research/reports.ts
//
// A5 Phase 1 — DAL CRUD for research_reports.
//
// Cross-org safety contract:
//   - getReportById        → 用 (reportId, orgId) 双键过滤；mismatch 返 null（不抛）
//   - listReportsByTask    → 用 (taskId, orgId) 双键过滤；其它 org 永远空数组
//   - listSnapshotsByParent→ 用 (parentReportId, orgId) 双键过滤
//   - listReportsByOrg     → 显式 orgId 过滤
//   - deleteReport         → 用 (reportId, orgId) 双键过滤；其它 org delete 不会命中
//
// updateReportStatus / resetReportForRegeneration / countActiveByOrg 仅供
// Inngest pipeline / 内部 server action 使用，调用方自己保证 orgId 已校验。

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  researchReports,
  type ReportSearchSnapshot,
  type AggregatesJson,
} from "@/db/schema/research/reports";

export type ResearchReportRow = typeof researchReports.$inferSelect;
export type ReportStatus = "pending" | "generating" | "ready" | "failed";

/** 创建一份新报告（initial status=pending；Inngest 触发后转 generating）。 */
export async function createReport(input: {
  organizationId: string;
  sourceType: "research_task" | "advanced_search";
  researchTaskId?: string;
  searchSnapshot: ReportSearchSnapshot;
  title: string;
  topicDescription?: string;
  parentReportId?: string;
  isSnapshot?: boolean;
  snapshotName?: string;
  generatedBy?: string;
}): Promise<ResearchReportRow> {
  const [row] = await db
    .insert(researchReports)
    .values({
      organizationId: input.organizationId,
      sourceType: input.sourceType,
      researchTaskId: input.researchTaskId,
      searchSnapshot: input.searchSnapshot,
      title: input.title,
      topicDescription: input.topicDescription,
      parentReportId: input.parentReportId,
      isSnapshot: input.isSnapshot ?? false,
      snapshotName: input.snapshotName,
      generatedBy: input.generatedBy,
      status: "pending",
    })
    .returning();
  if (!row) throw new Error("createReport: insert returned no row");
  return row;
}

/** 跨 org safe — 跨 org 访问返 null（不抛）。 */
export async function getReportById(
  reportId: string,
  orgId: string,
): Promise<ResearchReportRow | null> {
  const [row] = await db
    .select()
    .from(researchReports)
    .where(
      and(
        eq(researchReports.id, reportId),
        eq(researchReports.organizationId, orgId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 列出某任务下所有报告（含母版+快照），按创建时间降序。 */
export async function listReportsByTask(
  taskId: string,
  orgId: string,
): Promise<ResearchReportRow[]> {
  return db
    .select()
    .from(researchReports)
    .where(
      and(
        eq(researchReports.researchTaskId, taskId),
        eq(researchReports.organizationId, orgId),
      ),
    )
    .orderBy(desc(researchReports.createdAt));
}

/** 列出某 org 下最近 N 份报告（默认 50），按创建时间降序。 */
export async function listReportsByOrg(
  orgId: string,
  limit = 50,
): Promise<ResearchReportRow[]> {
  return db
    .select()
    .from(researchReports)
    .where(eq(researchReports.organizationId, orgId))
    .orderBy(desc(researchReports.createdAt))
    .limit(limit);
}

/** Phase 9 快照功能：列出某母版报告下的所有快照，按创建时间降序。 */
export async function listSnapshotsByParent(
  parentReportId: string,
  orgId: string,
): Promise<ResearchReportRow[]> {
  return db
    .select()
    .from(researchReports)
    .where(
      and(
        eq(researchReports.parentReportId, parentReportId),
        eq(researchReports.organizationId, orgId),
      ),
    )
    .orderBy(desc(researchReports.createdAt));
}

/**
 * 部分更新报告字段；Inngest pipeline 各 step 用它推进状态机。
 * 调用方自己保证已通过 (orgId, reportId) 校验。
 */
export async function updateReportStatus(
  reportId: string,
  patch: {
    status?: ReportStatus;
    currentStep?: string | null;
    errorMessage?: string | null;
    reportHtml?: string | null;
    aggregatesJson?: AggregatesJson | null;
    wordFileUrl?: string | null;
    excelFileUrl?: string | null;
    fileExpiresAt?: Date | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  },
): Promise<void> {
  await db
    .update(researchReports)
    .set(patch)
    .where(eq(researchReports.id, reportId));
}

/**
 * 重新生成（covering write）— 清空所有产出物，回到 pending；
 * 母版报告允许，快照报告调用方需自己 assert isSnapshot=false。
 */
export async function resetReportForRegeneration(reportId: string): Promise<void> {
  await db
    .update(researchReports)
    .set({
      status: "pending",
      currentStep: null,
      errorMessage: null,
      reportHtml: null,
      aggregatesJson: null,
      wordFileUrl: null,
      excelFileUrl: null,
      fileExpiresAt: null,
      startedAt: null,
      completedAt: null,
    })
    .where(eq(researchReports.id, reportId));
}

/** 跨 org safe — 其它 org 的 reportId 不会被命中。 */
export async function deleteReport(reportId: string, orgId: string): Promise<void> {
  await db
    .delete(researchReports)
    .where(
      and(
        eq(researchReports.id, reportId),
        eq(researchReports.organizationId, orgId),
      ),
    );
}

/** 当前 org 下处于 pending/generating 的报告数（防并发限流用）。 */
export async function countActiveByOrg(orgId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(researchReports)
    .where(
      and(
        eq(researchReports.organizationId, orgId),
        sql`${researchReports.status} IN ('pending','generating')`,
      ),
    );
  return row?.count ?? 0;
}
