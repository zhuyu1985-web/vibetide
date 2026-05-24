import { notFound, redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getAccountAnalyticsOverview,
  listAnalyzableAccounts,
  listReportsForAccount,
} from "@/lib/dal/account-analytics";
import { AccountOverviewClient } from "./account-overview-client";

export const dynamic = "force-dynamic";

export default async function AccountOverviewPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const accounts = await listAnalyzableAccounts(orgId, { source: "both" });
  const account = accounts.find((a) => a.id === accountId);
  if (!account) notFound();

  const [overview, reports] = await Promise.all([
    getAccountAnalyticsOverview(orgId, accountId),
    listReportsForAccount(orgId, accountId),
  ]);

  return (
    <AccountOverviewClient
      account={account}
      overview={overview}
      reports={reports}
    />
  );
}
