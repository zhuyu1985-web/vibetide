import { getCurrentUser } from "@/lib/auth";
import {
  getEditorLeaderboard,
  getEditorScore,
  getPointTransactions,
} from "@/lib/dal/editor-scores";
import LeaderboardClient from "./leaderboard-client";

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  const orgId = user?.organizationId ?? null;

  const leaderboard = orgId ? await getEditorLeaderboard(orgId).catch(() => []) : [];
  const currentUser = orgId && user ? await getEditorScore(user.id, orgId).catch(() => null) : null;
  const transactions =
    orgId && user ? await getPointTransactions(user.id, orgId).catch(() => []) : [];

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      currentUser={currentUser}
      transactions={transactions}
    />
  );
}
