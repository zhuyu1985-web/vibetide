import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  listBenchmarkAccounts,
  type BenchmarkAccountRow,
} from "@/lib/dal/benchmark-accounts";
import { BenchmarkAccountsClient } from "./benchmark-accounts-client";

export const dynamic = "force-dynamic";

export default async function BenchmarkAccountsPage() {
  let rows: BenchmarkAccountRow[] = [];
  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) rows = await listBenchmarkAccounts(orgId);
  } catch (err) {
    console.error("[benchmark-accounts] 加载失败:", err);
  }
  return <BenchmarkAccountsClient rows={rows} />;
}
