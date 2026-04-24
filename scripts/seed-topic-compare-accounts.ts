// 一次性跑 topic-compare v2 账号 seed。
// 用法：npx tsx scripts/seed-topic-compare-accounts.ts <orgId>
import { seedTopicCompareAccounts } from "@/db/seed-topic-compare";

async function main() {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error("Usage: npx tsx scripts/seed-topic-compare-accounts.ts <orgId>");
    process.exit(1);
  }
  const res = await seedTopicCompareAccounts(orgId);
  console.log("[seed-topic-compare] done:", res);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-topic-compare] fatal:", err);
  process.exit(1);
});
