"use server";

// src/app/actions/research/reports.ts
//
// A5 Phase 5 — Report server actions (最小 stub；createReportFromSearch /
// saveAsSnapshot / getSignedUrl 留 Phase 8/9 完整化)
//
// Phase 5 范围：
//   - pollReport         → client polling (3s 间隔) 拉取最新状态
//   - regenerateReport   → 母版重新生成 (reset → enqueue Inngest)
//   - _placeholderCreateReport → Phase 8 才接入双入口 (UI 不调用此 stub)
//
// 全部走 requirePermission(MENU_RESEARCH) 鉴权 + getReportById 双键 (reportId, orgId)
// 防跨 org 访问。

import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import {
  createReport as dalCreate,
  getReportById,
  resetReportForRegeneration,
} from "@/lib/dal/research/reports";
import { PERMISSIONS, requirePermission } from "@/lib/rbac";
import type {
  AggregatesJson,
  ReportSearchSnapshot,
} from "@/db/schema/research/reports";

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
  revalidatePath(`/research/reports/${reportId}`);
  return { ok: true };
}

/**
 * Phase 8 才完整启用 — 报告创建入口。
 * Phase 5 提供 stub 仅为类型完整性；UI 不调用。
 */
export async function _placeholderCreateReport(input: {
  sourceType: "research_task" | "advanced_search";
  title: string;
  topicDescription?: string;
  researchTaskId?: string;
  searchSnapshot: ReportSearchSnapshot;
}): Promise<{ reportId: string }> {
  const { organizationId, userId } = await requirePermission(
    PERMISSIONS.MENU_RESEARCH,
  );
  const r = await dalCreate({
    organizationId,
    sourceType: input.sourceType,
    researchTaskId: input.researchTaskId,
    searchSnapshot: input.searchSnapshot,
    title: input.title,
    topicDescription: input.topicDescription,
    generatedBy: userId,
  });
  await inngest.send({
    name: "research/report.generate",
    data: { reportId: r.id, organizationId },
  });
  return { reportId: r.id };
}
