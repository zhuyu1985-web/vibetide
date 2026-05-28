import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listReportsByOrg } from "@/lib/dal/research/reports";
import { listEcologicalIndexReportsByOrg } from "@/lib/dal/research/ecological-index-reports";
import { listMediaScopesByOrg } from "@/lib/dal/research/media-scopes";
import { listActivityDatasetsByOrg } from "@/lib/dal/research/activity-datasets";
import {
  ReportsListClient,
  type EcoReportListRow,
  type ReportListRow,
} from "./reports-list-client";
import type {
  DatasetOption,
  ScopeOption,
} from "./ecological-index-new-dialog";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function ResearchReportsPage({ searchParams }: PageProps) {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) redirect("/home");

  const { type } = await searchParams;
  const initialTab: "advanced_search" | "ecological_index" =
    type === "ecological_index" ? "ecological_index" : "advanced_search";

  const [advReports, ecoReports, scopes, datasets] = await Promise.all([
    listReportsByOrg(ctx.organizationId, 100),
    listEcologicalIndexReportsByOrg(ctx.organizationId),
    listMediaScopesByOrg(ctx.organizationId),
    listActivityDatasetsByOrg(ctx.organizationId),
  ]);

  const advRows: ReportListRow[] = advReports.map((r) => {
    // snapshot 当前只剩 advanced_search 一种 kind
    const snap = r.searchSnapshot as { hitItemIds?: string[] } | null;
    return {
      id: r.id,
      title: r.title,
      status: r.status as ReportListRow["status"],
      isSnapshot: r.isSnapshot,
      snapshotName: r.snapshotName,
      parentReportId: r.parentReportId,
      hitCount: Array.isArray(snap?.hitItemIds) ? snap!.hitItemIds!.length : 0,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    };
  });

  const ecoRows: EcoReportListRow[] = ecoReports.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    year: r.year,
    currentStep: r.currentStep,
    errorMessage: r.errorMessage,
    generatedByName: r.generatedByName,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  }));

  // 序列化为 client-safe 类型(去掉 Date 字段)
  const scopeOptions: ScopeOption[] = scopes.map((s) => ({
    id: s.id,
    name: s.name,
    totalUnits: s.totalUnits,
    centralCount: s.centralCount,
    industryCount: s.industryCount,
    municipalCount: s.municipalCount,
    districtRmtCount: s.districtRmtCount,
    districtGovCount: s.districtGovCount,
    isDefault: s.isDefault,
  }));

  const datasetOptions: DatasetOption[] = datasets.map((d) => ({
    id: d.id,
    name: d.name,
    year: d.year,
    districtCount: d.districtCount,
    totalActivities: d.totalActivities,
    activityThemes: d.activityThemes,
    isDefault: d.isDefault,
  }));

  return (
    <ReportsListClient
      initialTab={initialTab}
      advRows={advRows}
      ecoRows={ecoRows}
      scopes={scopeOptions}
      datasets={datasetOptions}
    />
  );
}
