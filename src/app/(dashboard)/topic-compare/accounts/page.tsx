import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listMyAccounts, type MyAccountRow } from "@/lib/dal/my-accounts";
import { MyAccountsClient } from "./my-accounts-client";

export default async function MyAccountsPage() {
  let rows: MyAccountRow[] = [];
  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) rows = await listMyAccounts(orgId);
  } catch (err) {
    console.error("[my-accounts] 加载失败:", err);
  }
  return <MyAccountsClient rows={rows} />;
}
