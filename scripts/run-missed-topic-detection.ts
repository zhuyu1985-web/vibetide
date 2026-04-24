// 初始化漏题数据：扫描对标 posts 生成 missed_topics 线索
import { detectMissedTopicsForOrg } from "@/lib/topic-matching/missed-topic-finder";

async function main() {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error("Usage: npx tsx scripts/run-missed-topic-detection.ts <orgId>");
    process.exit(1);
  }
  const result = await detectMissedTopicsForOrg({ orgId, sinceDays: 30 });
  console.log("[missed-topic-detection]", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
