// migration-domain-001.ts
//
// 「领域一等维度」P1 — 安全增量回填:把历史
// `ai_employees.instanceConfig.domainTags[0]` 回填成 `domains` 表中的一行,
// 并把对应 `ai_employees.domain_id` 指向它。
//
// 为什么:P1 把"领域"从散落在 instanceConfig 里的字符串标签提升为一等维度
// (domains 受控字典 + ai_employees.domain_id 外键)。本脚本把历史实例上已有的
// domainTags 主标签平滑迁过去,不丢数据。
//
// Idempotent:已经有 domain_id 的实例跳过;同 org 同 slug 的 domain 复用不重复建。
// 反复跑第二次应为 0 created / 0 linked。
// 注:本地库实例很可能根本没配 domainTags(instanceConfig 为空),此时
//     dry-run/apply 显示 `0 domains, 0 employees linked` 属正常(无历史数据要迁)。
//
// Usage:
//   npx tsx scripts/migration-domain-001.ts            # dry-run(只打印,不写库)
//   npx tsx scripts/migration-domain-001.ts --apply    # 实际写库

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import { config } from "dotenv";

import * as schema from "../src/db/schema";

config({ path: ".env.local" });
config();

const APPLY = process.argv.includes("--apply");

/** 中文领域名 → 稳定 slug;未知名走 hex fallback,保证不同名不撞 slug。 */
function slugify(name: string): string {
  const MAP: Record<string, string> = {
    财经: "finance",
    时政: "politics",
    体育: "sports",
    社会: "society",
    民生: "livelihood",
    法治: "law",
    科技: "tech",
    文娱: "entertainment",
  };
  return MAP[name] ?? `domain-${Buffer.from(name).toString("hex").slice(0, 8)}`;
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  const emps = await db.select().from(schema.aiEmployees);

  console.log(
    `${APPLY ? "[APPLY]" : "[DRY-RUN]"} 扫描 ${emps.length} 条 ai_employees 行\n`,
  );

  let created = 0;
  let linked = 0;

  for (const e of emps) {
    const tags = (e.instanceConfig as { domainTags?: string[] } | null)
      ?.domainTags;
    // 没有标签、空数组、或已经关联过 domain 的实例都跳过(幂等)。
    if (!tags || tags.length === 0 || e.domainId) continue;

    const name = tags[0];
    const slug = slugify(name);

    let [dom] = await db
      .select()
      .from(schema.domains)
      .where(
        and(
          eq(schema.domains.organizationId, e.organizationId),
          eq(schema.domains.slug, slug),
        ),
      );

    if (!dom) {
      console.log(`[domain] + ${name}(${slug}) for org ${e.organizationId}`);
      if (APPLY) {
        [dom] = await db
          .insert(schema.domains)
          .values({ organizationId: e.organizationId, slug, name })
          .returning();
      }
      created++;
    }

    console.log(`[link] ${e.slug} → ${name}`);
    if (APPLY && dom) {
      await db
        .update(schema.aiEmployees)
        .set({ domainId: dom.id })
        .where(eq(schema.aiEmployees.id, e.id));
    }
    linked++;
  }

  console.log(
    `\n${APPLY ? "APPLIED" : "DRY-RUN"}: ${created} domains, ${linked} employees linked`,
  );
  if (!APPLY) {
    console.log(`\n(dry-run,未写库。确认无误后加 --apply 实际执行)`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
