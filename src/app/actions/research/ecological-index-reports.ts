"use server";

// src/app/actions/research/ecological-index-reports.ts
//
// 生态文明传播指数报告 - Server Actions
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §8.1
//
// 全部走 requireAuth() 鉴权 + 单租户 org 隔离,
// 创建报告后发送 Inngest event `research/ecological-index.generate` 触发异步流水线。

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { inngest } from "@/inngest/client";
import {
  listEcologicalIndexReportsByOrg,
  getEcologicalIndexReportById,
  createEcologicalIndexReport as createReportInDb,
  deleteEcologicalIndexReport,
  previewScopeCoverage as previewCoverageDal,
  type EcologicalIndexReportSummary,
  type EcologicalIndexReportDetail,
  type ScopeCoveragePreview,
} from "@/lib/dal/research/ecological-index-reports";
import { getMediaScopeById } from "@/lib/dal/research/media-scopes";
import { getActivityDatasetById } from "@/lib/dal/research/activity-datasets";

async function requireOrg(): Promise<{ orgId: string; userId: string }> {
  const user = await requireAuth();
  if (!user.organizationId) throw new Error("无法获取组织信息");
  return { orgId: user.organizationId, userId: user.id };
}

/**
 * 列出 org 下所有 ecological_index 报告。
 */
export async function listEcologicalIndexReports(): Promise<
  EcologicalIndexReportSummary[]
> {
  const { orgId } = await requireOrg();
  return await listEcologicalIndexReportsByOrg(orgId);
}

/**
 * 获取详情(含 aggregatesJson + 3 个文件 URL)。
 * 跨 org / 非 ecological_index 类型 → 返 null。
 */
export async function getEcologicalIndexReportDetail(
  reportId: string,
): Promise<EcologicalIndexReportDetail | null> {
  const { orgId } = await requireOrg();
  return await getEcologicalIndexReportById(orgId, reportId);
}

/**
 * 创建报告 + 发送 Inngest event 触发异步生成
 *
 * 1. 校验 title / year 合法
 * 2. 校验 scope + dataset 都存在且归属本 org(防越权选别人的资源)
 * 3. INSERT research_reports(status=pending)
 * 4. inngest.send('research/ecological-index.generate')
 * 5. revalidatePath
 */
export async function createEcologicalIndexReportAction(input: {
  title: string;
  year: number;
  scopeId: string;
  activityDatasetId: string;
  includeContentSource: boolean;
}): Promise<{ reportId: string }> {
  const { orgId, userId } = await requireOrg();

  if (!input.title?.trim()) throw new Error("报告标题不能为空");
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    throw new Error("年份必须是 2000-2100 之间的整数");
  }

  // 校验 scope + dataset 都存在且归属本 org
  const scope = await getMediaScopeById(orgId, input.scopeId);
  if (!scope) throw new Error("选中的媒体名单不存在或无权访问");
  const dataset = await getActivityDatasetById(orgId, input.activityDatasetId);
  if (!dataset) throw new Error("选中的活动数据集不存在或无权访问");

  const { reportId } = await createReportInDb({
    organizationId: orgId,
    title: input.title.trim(),
    generatedBy: userId,
    searchSnapshot: {
      kind: "ecological_index",
      scopeId: input.scopeId,
      activityDatasetId: input.activityDatasetId,
      year: input.year,
      windowStart: `${input.year}-01-01`,
      windowEnd: `${input.year + 1}-01-01`,
      includeContentSource: input.includeContentSource,
      capturedAt: new Date().toISOString(),
    },
  });

  // 发送 Inngest event 触发异步生成(P3.8 实现的流水线消费)
  await inngest.send({
    name: "research/ecological-index.generate",
    data: { reportId, organizationId: orgId },
  });

  revalidatePath("/data-collection/reports");
  return { reportId };
}

/**
 * 删除报告。
 */
export async function deleteEcologicalIndexReportAction(
  reportId: string,
): Promise<void> {
  const { orgId } = await requireOrg();
  await deleteEcologicalIndexReport(orgId, reportId);
  revalidatePath("/data-collection/reports");
}

/**
 * 实时预估覆盖率(供 UI 在选 scope+year 时立刻展示)。
 */
export async function previewScopeCoverage(
  scopeId: string,
  year: number,
): Promise<ScopeCoveragePreview> {
  const { orgId } = await requireOrg();
  return await previewCoverageDal(orgId, scopeId, year);
}
