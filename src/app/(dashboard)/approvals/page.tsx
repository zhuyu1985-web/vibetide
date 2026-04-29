import {
  getPendingApprovals,
  getApprovalStats,
  getApprovalHistory,
} from "@/lib/dal/approvals";
import { getTeams } from "@/lib/dal/teams";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { ApprovalsClient } from "./approvals-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function ApprovalsPage() {
  const orgId = (await withTimeout(getCurrentUserOrg(), null)) || "";

  const [pending, stats, history, teams] = await Promise.all([
    withTimeout(getPendingApprovals(orgId), []),
    withTimeout(getApprovalStats(orgId), { pending: 0, approvedToday: 0, rejectedToday: 0, timedOut: 0 }),
    withTimeout(getApprovalHistory(orgId, 20), []),
    withTimeout(getTeams(), []),
  ]);

  return (
    <ApprovalsClient
      pending={pending}
      stats={stats}
      history={history}
      teams={teams}
    />
  );
}
