import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listReportsByOrg } from "@/lib/dal/research/reports";
import {
  ReportsListClient,
  type ReportListRow,
} from "@/app/(dashboard)/data-collection/reports/reports-list-client";

export const dynamic = "force-dynamic";

export default async function ResearchReportsPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) redirect("/home");

  const reports = await listReportsByOrg(ctx.organizationId, 100);

  const rows: ReportListRow[] = reports.map((r) => {
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

  return <ReportsListClient rows={rows} />;
}
