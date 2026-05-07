// src/app/(dashboard)/research/reports/[id]/page.tsx
//
// A5 Phase 5 — Report 详情页 Server Component
// 拉取初始报告 → 传给 client，client 自己管 polling / 状态机 / chart hydration

import { notFound } from "next/navigation";

import { getReportById } from "@/lib/dal/research/reports";
import { PERMISSIONS, requirePermission } from "@/lib/rbac";
import type { AggregatesJson } from "@/db/schema/research/reports";

import { ReportClient } from "./report-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);

  const report = await getReportById(id, organizationId);
  if (!report) notFound();

  const agg = (report.aggregatesJson as AggregatesJson | null) ?? null;

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
    />
  );
}
