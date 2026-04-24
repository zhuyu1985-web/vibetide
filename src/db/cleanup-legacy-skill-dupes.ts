/**
 * 清理 skills 表里的遗留老行（slug 为 NULL 的 builtin 副本）。
 *
 * 背景：某次旧 seed 插入过一批 is_builtin=true 但 slug=NULL 的 skill，
 * 与新规范（slug 必填）的 skill 同名字冲突。表现为同一 skill 出现两张卡，
 * 老卡描述短、版本老，而新卡有 slug 和长描述。
 *
 * 删除条件：
 *   - is_builtin = true
 *   - type = 'builtin'
 *   - slug IS NULL
 *
 * 跑法：
 *   - `npx tsx src/db/cleanup-legacy-skill-dupes.ts`          —— dry-run
 *   - `npx tsx src/db/cleanup-legacy-skill-dupes.ts --force`  —— 真删
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import { skills } from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

async function main() {
  const force = process.argv.includes("--force");

  const targets = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      version: skills.version,
      orgId: skills.organizationId,
    })
    .from(skills)
    .where(
      and(
        eq(skills.type, "builtin"),
        isNull(skills.slug),
      ),
    );

  if (targets.length === 0) {
    console.log("✅ 没有 slug=NULL 的遗留 builtin 技能行。");
    await client.end();
    process.exit(0);
  }

  console.log(
    `${force ? "⚠️  将删除" : "🔍 dry-run 发现"} ${targets.length} 条 slug=NULL 的 builtin 遗留行：\n`,
  );
  for (const t of targets) {
    console.log(
      `  - ${t.name.padEnd(24)} ver=${(t.version ?? "").padEnd(8)} id=${t.id.slice(0, 8)}`,
    );
  }

  if (!force) {
    console.log(
      "\n这是 dry-run。确认无误后执行：\n  npx tsx src/db/cleanup-legacy-skill-dupes.ts --force\n",
    );
    await client.end();
    process.exit(0);
  }

  const deleted = await db
    .delete(skills)
    .where(
      and(
        eq(skills.type, "builtin"),
        isNull(skills.slug),
      ),
    )
    .returning({ id: skills.id });

  console.log(`\n✅ 已删除 ${deleted.length} 条遗留 builtin 技能行。`);
  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ 清理失败：", err);
  try { await client.end(); } catch {}
  process.exit(1);
});
