/**
 * 一次性脚本:给所有海外热榜搬运 workflow 的 step 5 archive_to_drafts
 * 加 dedupBySourceUrl=false 参数。
 *
 * 背景:之前 step 5 没显式传 dedupBySourceUrl,默认 true → 第二次跑同样热榜
 * 时 sourceUrl 已存在 → 全 skip → 用户感知"只有 1 条入库"。
 *
 * Usage: npx tsx scripts/patch-overseas-step5-dedup.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const url = process.env.DATABASE_URL!;
const client = postgres(url, { prepare: false, max: 1 });

(async () => {
  const schema = await import("@/db/schema");
  const db = drizzle(client, { schema });
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({
      id: schema.workflowTemplates.id,
      name: schema.workflowTemplates.name,
      steps: schema.workflowTemplates.steps,
    })
    .from(schema.workflowTemplates);

  let patched = 0;
  for (const row of rows) {
    const steps = (row.steps ?? []) as Array<{
      config?: { skillSlug?: string; parameters?: Record<string, unknown> };
    }>;
    let dirty = false;
    for (const s of steps) {
      if (s.config?.skillSlug === "archive_to_drafts") {
        const params = s.config.parameters ?? {};
        // 2026-05-29 修正:之前 patch 把 dedup 改 false 是误诊
        //("只有 1 条入库"其实是 dedup 正常工作,重跑相同热榜全 skip)。
        // 用户明确要求"之前抓过的稿件不要再入库",恢复 dedupBySourceUrl=true。
        if (params.dedupBySourceUrl !== true) {
          params.dedupBySourceUrl = true;
          s.config.parameters = params;
          dirty = true;
        }
      }
    }
    if (dirty) {
      // cast: 局部声明的简化 steps 类型(只 narrow 到 config.parameters)与
      // schema 的 WorkflowStepDef[] 完整类型不同, 在写回时显式 cast
      await db
        .update(schema.workflowTemplates)
        .set({ steps: steps as typeof schema.workflowTemplates.$inferInsert.steps })
        .where(eq(schema.workflowTemplates.id, row.id));
      patched++;
      console.log(`patched: ${row.id} "${row.name}"`);
    }
  }
  console.log(`\nTotal patched: ${patched}`);
  await client.end();
  process.exit(0);
})();
