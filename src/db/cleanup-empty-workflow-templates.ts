/**
 * 清理 workflow_templates 里空步骤的"预设/遗留"行。
 *
 * 背景：早期 ADVANCED_SCENARIO_CONFIG / 坏 seed 留下了一批 steps=[]/null
 * 的模板（两会报道团、马拉松直击队、突发应急组、主题宣传队、民生服务组、
 * 快发流水线 等），UI 上看得到却跑不起来。
 *
 * 删除范围（视为空模板，任一成立）：
 *   A. steps IS NULL / 非 array / length=0
 *   B. steps 虽非空，但**没有任何一个 step 的 config.skillSlug 或
 *      config.skillName 是有效字符串**（纯占位 / 脏数据）
 *
 * 且必须满足 (is_builtin=true OR is_public=true OR legacy_scenario_key 非空)。
 * 用户自建的空步骤草稿（三者全 false / null）**不删**。
 *
 * 跑法：
 *   - `npm run db:cleanup-empty-workflows` —— dry-run，只打印
 *   - `npm run db:cleanup-empty-workflows -- --force` —— 真正删除
 */

// Load env manually BEFORE any DB import (.env.local takes priority).
// 注意：不能 import `./index` 或任何会触发顶层 postgres() 调用的模块，否则
// ES 模块 import 提升会让 DATABASE_URL 在连接时为 undefined → ECONNREFUSED。
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

async function main() {
  const force = process.argv.includes("--force");

  // 情形 A：steps 本身为空
  const emptyShape = sql`(
    ${workflowTemplates.steps} IS NULL
    OR jsonb_typeof(${workflowTemplates.steps}) <> 'array'
    OR jsonb_array_length(${workflowTemplates.steps}) = 0
  )`;

  // 情形 B：steps 非空，但所有 step 的 config.skillSlug 和 config.skillName
  // 都缺失或为空串 —— 视为"可视 chain 为空"，UI 上显示不出任何步骤。
  //   NOT EXISTS (SELECT 1 FROM jsonb_array_elements(steps) s
  //               WHERE coalesce(s->'config'->>'skillSlug','') <> ''
  //                  OR coalesce(s->'config'->>'skillName','') <> '')
  const emptyChain = sql`(
    jsonb_typeof(${workflowTemplates.steps}) = 'array'
    AND jsonb_array_length(${workflowTemplates.steps}) > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(${workflowTemplates.steps}) AS s
      WHERE coalesce(s->'config'->>'skillSlug', '') <> ''
         OR coalesce(s->'config'->>'skillName', '') <> ''
    )
  )`;

  const condition = sql`(
    ${workflowTemplates.isBuiltin} = true
    OR ${workflowTemplates.isPublic} = true
    OR ${workflowTemplates.legacyScenarioKey} IS NOT NULL
  ) AND (${emptyShape} OR ${emptyChain})`;

  const targets = await db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      legacyKey: workflowTemplates.legacyScenarioKey,
      isBuiltin: workflowTemplates.isBuiltin,
      isPublic: workflowTemplates.isPublic,
      orgId: workflowTemplates.organizationId,
      stepsLen: sql<number>`COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(${workflowTemplates.steps})='array' THEN ${workflowTemplates.steps} ELSE '[]'::jsonb END), 0)`,
    })
    .from(workflowTemplates)
    .where(condition);

  if (targets.length === 0) {
    console.log("✅ 没有需要清理的空步骤预设模板。");
    await client.end();
    process.exit(0);
  }

  console.log(
    `${force ? "⚠️  将删除" : "🔍 dry-run 发现"} ${targets.length} 条空步骤预设模板：\n`,
  );
  for (const t of targets) {
    const flags = [
      t.isBuiltin ? "builtin" : "",
      t.isPublic ? "public" : "",
      t.legacyKey ? `legacy=${t.legacyKey}` : "",
      `steps=${t.stepsLen}`,
    ]
      .filter(Boolean)
      .join(" | ");
    console.log(`  - ${t.name.padEnd(24)} [${flags}]  id=${t.id}`);
  }

  if (!force) {
    console.log(
      "\n这是 dry-run（默认）。确认无误后执行：\n  npm run db:cleanup-empty-workflows -- --force\n",
    );
    await client.end();
    process.exit(0);
  }

  const deleted = await db
    .delete(workflowTemplates)
    .where(condition)
    .returning({ id: workflowTemplates.id });

  console.log(`\n✅ 已删除 ${deleted.length} 条空步骤预设模板。`);
  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ 清理失败：", err);
  try {
    await client.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
