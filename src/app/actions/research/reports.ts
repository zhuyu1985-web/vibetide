"use server";

// src/app/actions/research/reports.ts
//
// A5 Phase 8 — Report server actions（完整化）
//
// 全部走 requirePermission(MENU_RESEARCH) 鉴权 + getReportById 双键 (reportId, orgId)
// 防跨 org 访问。仅保留 createReportFromSearch (高级检索入口);
// regenerateReport 拒绝快照;saveAsSnapshot 复制 parent 内容（不再触发 Inngest）;
// getSignedUrlForReport 跨 org 校验 + 临过期 1h 重签。
// 2026-05-13: createReportFromTask 已移除(/research/admin/tasks 整体下线)。

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { researchReports } from "@/db/schema/research/reports";
import {
  createReport as dalCreate,
  deleteReport as dalDelete,
  getReportById,
  resetReportForRegeneration,
} from "@/lib/dal/research/reports";
import {
  buildObjectPath,
  resignUrl as storageResignUrl,
} from "@/lib/research/report-storage";
import { PERMISSIONS, requirePermission } from "@/lib/rbac";
import type {
  AggregatesJson,
  ReportSearchSnapshot,
} from "@/db/schema/research/reports";
import type {
  AdvancedSearchCondition,
  SidebarFilter,
} from "@/app/(dashboard)/research/search-mode-types";

const MAX_HIT_ITEMS = 500;

export type ReportPollStatus = "pending" | "generating" | "ready" | "failed";

export interface ReportPollResult {
  status: ReportPollStatus;
  currentStep: string | null;
  errorMessage: string | null;
  reportHtml: string | null;
  isAiFallback: boolean;
  wordFileUrl: string | null;
  excelFileUrl: string | null;
  aggregatesJson: AggregatesJson | null;
}

/**
 * 客户端 3s 轮询调用。返回当前状态机最新快照。
 * 跨 org 报告或 reportId 不存在时抛 Error（前端兜底 console.error，不破坏 UI）。
 */
export async function pollReport(reportId: string): Promise<ReportPollResult> {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  const r = await getReportById(reportId, organizationId);
  if (!r) throw new Error("报告不存在或已被删除");

  const agg = (r.aggregatesJson as AggregatesJson | null) ?? null;

  return {
    status: r.status as ReportPollStatus,
    currentStep: r.currentStep,
    errorMessage: r.errorMessage,
    reportHtml: r.reportHtml,
    isAiFallback: agg?.isAiFallback ?? false,
    wordFileUrl: r.wordFileUrl,
    excelFileUrl: r.excelFileUrl,
    aggregatesJson: agg,
  };
}

/**
 * 入口 — 从高级检索快照创建报告。
 * 由 search-workbench-client "生成报告"按钮调用；hitItemIds 通过
 * fetchAllHitItemIdsForReport DAL helper 一次性预拿（≤ 500 条），
 * 不依赖前端列表分页态。
 */
export async function createReportFromSearch(input: {
  conditions: AdvancedSearchCondition[];
  sidebarFilter: SidebarFilter;
  hitItemIds: string[];
  title: string;
  topicDescription?: string;
}): Promise<{ reportId: string }> {
  const { organizationId, userId } = await requirePermission(
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!input.title.trim()) throw new Error("报告标题不能为空");
  if (input.hitItemIds.length === 0) {
    throw new Error("没有命中数据可生成报告");
  }
  if (input.hitItemIds.length > MAX_HIT_ITEMS) {
    throw new Error(`命中数据超过 ${MAX_HIT_ITEMS} 条，请缩小检索条件`);
  }

  const snapshot: ReportSearchSnapshot = {
    kind: "advanced_search",
    conditions: input.conditions,
    sidebarFilter: input.sidebarFilter,
    hitItemIds: input.hitItemIds,
    capturedAt: new Date().toISOString(),
  };

  const r = await dalCreate({
    organizationId,
    searchSnapshot: snapshot,
    title: input.title.trim(),
    topicDescription: input.topicDescription?.trim() || undefined,
    generatedBy: userId,
  });
  await inngest.send({
    name: "research/report.generate",
    data: { reportId: r.id, organizationId },
  });

  return { reportId: r.id };
}

/**
 * 重新生成（covering write） — 母版报告允许，快照报告拒绝。
 * 1. assert 报告存在 + 非快照 + 非 generating
 * 2. resetReportForRegeneration 清空所有产出物 + 回到 pending
 * 3. 发 inngest 事件 `research/report.generate` 重启 7-step pipeline
 */
export async function regenerateReport(
  reportId: string,
): Promise<{ ok: true }> {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  const r = await getReportById(reportId, organizationId);
  if (!r) throw new Error("报告不存在");
  if (r.isSnapshot) throw new Error("快照报告不允许重新生成");
  if (r.status === "generating") throw new Error("报告正在生成中，请稍后再试");

  await resetReportForRegeneration(reportId);
  await inngest.send({
    name: "research/report.generate",
    data: { reportId, organizationId },
  });
  revalidatePath(`/data-collection/reports/${reportId}`);
  return { ok: true };
}

/**
 * 保存为快照（仅 ready 状态母版可用）。
 * 快照不重新生成 Inngest pipeline — 直接复制 parent 的 reportHtml /
 * aggregatesJson / fileUrls 等到新 row，status=ready，completedAt=now。
 *
 * 拒绝：
 *   - parent 不存在
 *   - parent 已是快照（不允许 snapshot of snapshot）
 *   - parent 状态非 ready（生成中 / 失败的母版不能保存）
 */
export async function saveAsSnapshot(input: {
  parentReportId: string;
  snapshotName: string;
}): Promise<{ snapshotId: string }> {
  const { organizationId, userId } = await requirePermission(
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!input.snapshotName.trim()) throw new Error("快照名称不能为空");

  const parent = await getReportById(input.parentReportId, organizationId);
  if (!parent) throw new Error("母版报告不存在");
  if (parent.isSnapshot) throw new Error("快照不能再被保存为快照");
  if (parent.status !== "ready") {
    throw new Error("仅 ready 状态的报告可保存快照");
  }

  // 复制 row（reportHtml / aggregatesJson / fileUrls 一并复制）
  const [snapshot] = await db
    .insert(researchReports)
    .values({
      organizationId,
      sourceType: parent.sourceType,
      searchSnapshot: parent.searchSnapshot,
      title: parent.title,
      topicDescription: parent.topicDescription,
      reportHtml: parent.reportHtml,
      aggregatesJson: parent.aggregatesJson,
      wordFileUrl: parent.wordFileUrl,
      excelFileUrl: parent.excelFileUrl,
      fileExpiresAt: parent.fileExpiresAt,
      parentReportId: parent.id,
      isSnapshot: true,
      snapshotName: input.snapshotName.trim(),
      status: "ready",
      completedAt: new Date(),
      generatedBy: userId,
    })
    .returning({ id: researchReports.id });
  if (!snapshot) throw new Error("快照创建失败");

  revalidatePath(`/data-collection/reports/${parent.id}`);
  return { snapshotId: snapshot.id };
}

/**
 * 拿报告下载文件签名 URL。临过期 1h 内自动重签 + 写回 DB。
 *
 * 跨 org 校验已在 getReportById 双键查询内部保证；
 * 但仍显式 assert r.organizationId === organizationId 作为深度防御。
 */
export async function getSignedUrlForReport(
  reportId: string,
  kind: "word" | "excel",
): Promise<{ url: string }> {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  const r = await getReportById(reportId, organizationId);
  if (!r) throw new Error("报告不存在");
  if (r.organizationId !== organizationId) {
    throw new Error("无权访问该报告");
  }

  const fileUrl = kind === "word" ? r.wordFileUrl : r.excelFileUrl;
  if (!fileUrl) {
    throw new Error(kind === "word" ? "Word 文件未生成" : "Excel 文件未生成");
  }

  // 临过期 1h 内重签
  const now = Date.now();
  const exp = r.fileExpiresAt?.getTime() ?? 0;
  const needRefresh = exp - now < 60 * 60 * 1000;
  if (!needRefresh) return { url: fileUrl };

  const fileName = kind === "word" ? "report.docx" : "report.xlsx";
  const path = buildObjectPath(organizationId, reportId, fileName);
  const signed = await storageResignUrl(path);

  await db
    .update(researchReports)
    .set(
      kind === "word"
        ? { wordFileUrl: signed.url, fileExpiresAt: signed.expiresAt }
        : { excelFileUrl: signed.url, fileExpiresAt: signed.expiresAt },
    )
    .where(eq(researchReports.id, reportId));

  return { url: signed.url };
}

/**
 * 删除报告（含级联快照 — schema 自带 onDelete cascade）。
 * 删后跳回 /data-collection/reports 列表（详情页删除按钮调用）。
 */
export async function deleteReport(reportId: string): Promise<never> {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  await dalDelete(reportId, organizationId);
  redirect("/data-collection/reports");
}

/**
 * 同 deleteReport，但不 redirect — 给报告列表页内联删除按钮用，
 * 删完原地 revalidatePath 刷新列表。
 */
export async function deleteReportInline(reportId: string): Promise<void> {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  await dalDelete(reportId, organizationId);
  revalidatePath("/data-collection/reports");
}
