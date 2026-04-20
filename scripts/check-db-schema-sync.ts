// check-db-schema-sync.ts
// 检查远程 DB 的关键表列是否匹配最新迁移期望的状态
//
// 验证点：
//   1. workflow_templates 应该有 content / is_public / owner_employee_id /
//      launch_mode / prompt_template 5 列（迁移 0030 + 20260420000001）
//   2. missions 应该有 input_params 列（迁移 20260420000001）
//   3. employee_scenarios 表应该不存在（迁移 20260420000001 DROP 了）
//   4. workflow_category enum 应该有新增的 7 个值（迁移 20260419000001）
//
// Usage: npx tsx scripts/check-db-schema-sync.ts

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });

  const results: { check: string; expected: string; actual: string; ok: boolean }[] = [];

  // Check 1: workflow_templates 5 expected new columns
  const wfCols = await client<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'workflow_templates'
    AND column_name IN ('content', 'is_public', 'owner_employee_id', 'launch_mode', 'prompt_template')
    ORDER BY column_name
  `;
  const wfColNames = wfCols.map((r) => r.column_name).sort();
  const expectedWfCols = ["content", "is_public", "launch_mode", "owner_employee_id", "prompt_template"];
  results.push({
    check: "workflow_templates 新增 5 列",
    expected: expectedWfCols.join(", "),
    actual: wfColNames.join(", ") || "(无)",
    ok: expectedWfCols.every((c) => wfColNames.includes(c)),
  });

  // Check 2: missions.input_params
  const missionsCols = await client<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'missions' AND column_name = 'input_params'
  `;
  results.push({
    check: "missions.input_params 列",
    expected: "exists",
    actual: missionsCols.length > 0 ? "exists" : "missing",
    ok: missionsCols.length > 0,
  });

  // Check 3: employee_scenarios 表应该被 DROP
  const esTable = await client<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'employee_scenarios'
  `;
  results.push({
    check: "employee_scenarios 表已 DROP",
    expected: "absent",
    actual: esTable.length > 0 ? "still exists" : "absent",
    ok: esTable.length === 0,
  });

  // Check 4: workflow_category enum 有 12 个值（包括新增的 7 个：deep/social/advanced/livelihood/podcast/drama/daily_brief）
  const enumVals = await client<{ enumlabel: string }[]>`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'workflow_category'
    ORDER BY enumsortorder
  `;
  const enumNames = enumVals.map((r) => r.enumlabel);
  const requiredEnumValues = ["deep", "social", "advanced", "livelihood", "podcast", "drama", "daily_brief"];
  const missingEnums = requiredEnumValues.filter((v) => !enumNames.includes(v));
  results.push({
    check: "workflow_category enum 有 7 新值",
    expected: requiredEnumValues.join(", "),
    actual: missingEnums.length === 0 ? "all present" : `missing: ${missingEnums.join(", ")}`,
    ok: missingEnums.length === 0,
  });

  // Check 5: launch_mode CHECK 约束
  const checkCons = await client<{ conname: string }[]>`
    SELECT conname FROM pg_constraint
    WHERE conname = 'workflow_templates_launch_mode_check'
  `;
  results.push({
    check: "launch_mode CHECK 约束",
    expected: "exists",
    actual: checkCons.length > 0 ? "exists" : "missing",
    ok: checkCons.length > 0,
  });

  // Check 6: 2 个新索引
  const indexes = await client<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE indexname IN ('idx_workflow_templates_owner_employee', 'idx_workflow_templates_public_builtin')
  `;
  const indexNames = indexes.map((r) => r.indexname).sort();
  results.push({
    check: "workflow_templates 2 新索引",
    expected: "idx_workflow_templates_owner_employee, idx_workflow_templates_public_builtin",
    actual: indexNames.join(", ") || "(无)",
    ok: indexNames.length === 2,
  });

  // Check 7: artifactTypeEnum 有 cms_publication 值
  const artifactEnums = await client<{ enumlabel: string }[]>`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'artifact_type'
    ORDER BY enumsortorder
  `;
  const artifactNames = artifactEnums.map((r) => r.enumlabel);
  results.push({
    check: "artifact_type enum 有 cms_publication",
    expected: "present",
    actual: artifactNames.includes("cms_publication") ? "present" : "missing",
    ok: artifactNames.includes("cms_publication"),
  });

  // Check 8: scenarios.welcomeMessage（旧表，已 DROP，应该不影响 — 只是记录）

  // Print
  console.log("\n━━━ 远程 DB schema 与迁移文件一致性检查 ━━━\n");
  for (const r of results) {
    const symbol = r.ok ? "✅" : "❌";
    console.log(`${symbol} ${r.check}`);
    console.log(`   期望: ${r.expected}`);
    console.log(`   实际: ${r.actual}`);
    console.log();
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log(`━━━ 全部 ${results.length} 项通过，DB 与迁移文件一致 ━━━\n`);
  } else {
    console.log(`━━━ ${failed.length}/${results.length} 项未通过，需要应用迁移 ━━━\n`);
    process.exit(1);
  }

  await client.end();
}

main();
