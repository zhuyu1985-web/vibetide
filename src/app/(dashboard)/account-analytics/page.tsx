import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  listAnalyzableAccounts,
  type AnalyzableAccountRow,
} from "@/lib/dal/account-analytics";
import { AccountAnalyticsLandingClient } from "./account-analytics-landing-client";

export const dynamic = "force-dynamic";

export default async function AccountAnalyticsPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  let accounts: AnalyzableAccountRow[] = [];
  try {
    accounts = await listAnalyzableAccounts(orgId, { source: "both" });
  } catch (err) {
    console.error("[account-analytics] 加载账号列表失败:", err);
  }

  return <AccountAnalyticsLandingClient accounts={accounts} />;
}
