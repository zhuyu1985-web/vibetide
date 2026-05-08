// 一次性脚本：把 72 个默认媒体白名单灌入指定 org（修复 A1 完工漏接 hook 的遗留 bug）
import { config } from "dotenv";
config({ path: ".env.local" });

import("@/db/seed/media-outlet-dictionary").then(async ({ seedMediaOutletDictionary }) => {
  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema");

  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  console.log(`Found ${orgs.length} orgs. Seeding media outlets to each...\n`);

  for (const org of orgs) {
    const result = await seedMediaOutletDictionary(org.id);
    console.log(`  ${org.name} (${org.id.slice(0, 8)}…): inserted=${result.inserted} / skipped=${result.skipped} / total=${result.total}`);
  }
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
