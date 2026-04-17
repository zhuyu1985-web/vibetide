import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getAuditStats, listPendingAudits } from "@/lib/dal/audit";
import { AuditCenterClient } from "./audit-center-client";

export const dynamic = "force-dynamic";

export default async function AuditCenterPage() {
  const orgId = await getCurrentUserOrg();

  const [stats, pendingAudits] = orgId
    ? await Promise.all([
        getAuditStats(orgId),
        listPendingAudits(orgId),
      ])
    : [
        { pendingCount: 0, approvedToday: 0, rejectedToday: 0, avgReviewTimeMs: null },
        [],
      ];

  return <AuditCenterClient stats={stats} pendingAudits={pendingAudits} />;
}
