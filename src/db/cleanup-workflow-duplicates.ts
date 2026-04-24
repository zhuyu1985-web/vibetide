/**
 * 清理 workflow_templates 里的重复 builtin 模板，并可按 name 精确删除。
 *
 * 去重规则（同 organization_id + 同 name 的 is_builtin 行）：
 *   1. 优先保留 legacy_scenario_key IS NOT NULL 的那一条
 *   2. 其次按 created_at 升序取最早的一条
 *   3. 其余视为重复，删除
 *
 * 精确删除：
 *   --drop="客户投诉邮件分类,其它名" —— 直接删名字命中的 builtin 行
 *
 * 跑法：
 *   - `npm run db:cleanup-workflow-dupes`                      —— dry-run（默认）
 *   - `npm run db:cleanup-workflow-dupes -- --force`           —— 执行去重
 *   - `npm run db:cleanup-workflow-dupes -- --drop="A,B" --force`
 */

// Load env BEFORE any DB import (否则 import 提升会让 DATABASE_URL=undefined).
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

type Target = {
  id: string;
  name: string;
  legacyKey: string | null;
  orgId: string | null;
  createdAt: Date;
  reason: string;
};

function parseDropList(): string[] {
  const arg = process.argv.find((a) => a.startsWith("--drop="));
  if (!arg) return [];
  return arg
    .slice("--drop=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function findDuplicates(): Promise<Target[]> {
  // 按 (org_id, name) 分组的 builtin 行；保留优先级最高的一条，其余标记删除
  const rows = await db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      legacyKey: workflowTemplates.legacyScenarioKey,
      orgId: workflowTemplates.organizationId,
      createdAt: workflowTemplates.createdAt,
    })
    .from(workflowTemplates)
    .where(eq(workflowTemplates.isBuiltin, true));

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.orgId}|${r.name}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const toDelete: Target[] = [];
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    // 排序：legacy 非空优先，其次 createdAt 升序
    list.sort((a, b) => {
      const al = a.legacyKey ? 0 : 1;
      const bl = b.legacyKey ? 0 : 1;
      if (al !== bl) return al - bl;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const [keep, ...rest] = list;
    for (const r of rest) {
      toDelete.push({
        id: r.id,
        name: r.name,
        legacyKey: r.legacyKey,
        orgId: r.orgId,
        createdAt: r.createdAt,
        reason: `dup of ${keep.id} (${keep.legacyKey ?? "no-legacy"})`,
      });
    }
  }
  return toDelete;
}

async function findByNames(names: string[]): Promise<Target[]> {
  if (names.length === 0) return [];
  const rows = await db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      legacyKey: workflowTemplates.legacyScenarioKey,
      orgId: workflowTemplates.organizationId,
      createdAt: workflowTemplates.createdAt,
    })
    .from(workflowTemplates)
    .where(
      and(
        eq(workflowTemplates.isBuiltin, true),
        inArray(workflowTemplates.name, names),
      ),
    );
  return rows.map((r) => ({ ...r, reason: "drop-by-name" }));
}

async function main() {
  const force = process.argv.includes("--force");
  const dropNames = parseDropList();

  const [dupes, dropped] = await Promise.all([
    findDuplicates(),
    findByNames(dropNames),
  ]);

  // 合并去重
  const byId = new Map<string, Target>();
  for (const t of [...dupes, ...dropped]) byId.set(t.id, t);
  const targets = Array.from(byId.values());

  if (targets.length === 0) {
    console.log("✅ 没有发现重复 / 待删除的 builtin 模板。");
    await client.end();
    process.exit(0);
  }

  console.log(
    `${force ? "⚠️  将删除" : "🔍 dry-run 发现"} ${targets.length} 条 builtin 模板：\n`,
  );
  for (const t of targets) {
    console.log(
      `  - ${t.name.padEnd(24)} legacy=${t.legacyKey ?? "-"}  id=${t.id}  (${t.reason})`,
    );
  }

  if (!force) {
    console.log(
      "\n这是 dry-run（默认）。确认无误后执行：\n  npm run db:cleanup-workflow-dupes -- --force" +
        (dropNames.length
          ? `  --drop="${dropNames.join(",")}"`
          : "") +
        "\n",
    );
    await client.end();
    process.exit(0);
  }

  const ids = targets.map((t) => t.id);
  const deleted = await db
    .delete(workflowTemplates)
    .where(inArray(workflowTemplates.id, ids))
    .returning({ id: workflowTemplates.id });

  console.log(`\n✅ 已删除 ${deleted.length} 条 builtin 模板。`);
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

// 让 sql 引用不被摇树去掉
void sql;
