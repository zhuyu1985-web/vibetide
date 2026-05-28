// src/app/(dashboard)/data-collection/reports/[id]/page.tsx
//
// A5 Phase 5 — Report 详情页 Server Component
// 拉取初始报告 → 传给 client，client 自己管 polling / 状态机 / chart hydration

import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { researchReports } from "@/db/schema/research/reports";
import {
  getReportById,
  listSnapshotsByParent,
} from "@/lib/dal/research/reports";
import { getEcologicalIndexReportById } from "@/lib/dal/research/ecological-index-reports";
import { PERMISSIONS, requirePermission } from "@/lib/rbac";
import type { AdvancedSearchAggregates } from "@/db/schema/research/reports";

import { ReportClient } from "./report-client";
import { EcologicalIndexDetail } from "./ecological-index-detail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);

  // 先查 sourceType 分支:ecological_index 走独立详情页(4 tab),其它走原 ReportClient
  const [base] = await db
    .select({ sourceType: researchReports.sourceType })
    .from(researchReports)
    .where(
      and(
        eq(researchReports.id, id),
        eq(researchReports.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!base) notFound();

  if (base.sourceType === "ecological_index") {
    const detail = await getEcologicalIndexReportById(organizationId, id);
    if (!detail) notFound();
    return <EcologicalIndexDetail report={detail} />;
  }

  const report = await getReportById(id, organizationId);
  if (!report) notFound();

  // Narrow to AdvancedSearchAggregates — A5 报告路径只使用此分支
  // (生态文明指数报告走独立 EcologicalIndexAggregates 路径，不复用该详情页)
  const agg = (report.aggregatesJson as AdvancedSearchAggregates | null) ?? null;

  // Phase 9：仅母版报告加载快照列表（spec：快照不能再创建快照）
  const snapshots = report.isSnapshot
    ? []
    : await listSnapshotsByParent(report.id, organizationId);

  return (
    <ReportClient
      reportId={report.id}
      title={report.title}
      isSnapshot={report.isSnapshot}
      initialStatus={
        report.status as "pending" | "generating" | "ready" | "failed"
      }
      initialCurrentStep={report.currentStep}
      initialErrorMessage={report.errorMessage}
      initialReportHtml={report.reportHtml}
      initialWordFileUrl={report.wordFileUrl}
      initialExcelFileUrl={report.excelFileUrl}
      initialAggregates={agg}
      initialIsAiFallback={agg?.isAiFallback ?? false}
      snapshots={snapshots.map((s) => ({
        id: s.id,
        snapshotName: s.snapshotName ?? "(未命名快照)",
        createdAt: s.createdAt.toISOString(),
      }))}
    />
  );
}
