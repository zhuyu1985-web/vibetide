// sync-employee-skills-from-md.ts
//
// 按 skills/*/SKILL.md frontmatter 的 compatibleEmployees 字段，向所有 org 的
// employee_skills 表补齐"预设员工 ↔ 内置技能"绑定。
//
// 用途：修复历史 seed 漂移——以前 EMPLOYEE_CORE_SKILLS 常量没覆盖所有
// SKILL.md 已声明的 compatibleEmployees（典型例子：xiaowen / xiaojian 没绑
// tandian_script，结果意图识别只能选用户自建的 custom 员工执行探店脚本）。
//
// Idempotent：依赖 (employee_id, skill_id) unique 索引，反复跑只会 INSERT
// 缺失行，不会重复或删除已有绑定（自定义员工额外绑定不受影响）。
//
// Usage:
//   npx tsx scripts/sync-employee-skills-from-md.ts

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";

import * as schema from "../src/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const SKILLS_DIR = path.resolve(__dirname, "../skills");

// 仅同步预设员工，避免误伤 custom_ 员工
const PRESET_EMPLOYEE_SLUGS = new Set([
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
  "xiaoyan",
]);

/** 解析 SKILL.md frontmatter 里 `compatibleEmployees: [a, b, c]` 形式的列表。 */
function parseCompatibleEmployees(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.startsWith("---")) return [];
  const endIdx = raw.indexOf("---", 3);
  if (endIdx === -1) return [];
  const frontmatter = raw.slice(3, endIdx);

  const match = frontmatter.match(/^\s*compatibleEmployees:\s*\[([^\]]*)\]/m);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  // 收集所有 SKILL.md 的 (skillSlug, employeeSlug) 对
  const dirs = fs.readdirSync(SKILLS_DIR).filter((d) => {
    const stat = fs.statSync(path.join(SKILLS_DIR, d));
    return stat.isDirectory();
  });

  const pairs: Array<{ skillSlug: string; empSlug: string }> = [];
  for (const skillSlug of dirs) {
    const mdPath = path.join(SKILLS_DIR, skillSlug, "SKILL.md");
    if (!fs.existsSync(mdPath)) continue;
    const compatible = parseCompatibleEmployees(mdPath);
    for (const empSlug of compatible) {
      if (!PRESET_EMPLOYEE_SLUGS.has(empSlug)) continue;
      pairs.push({ skillSlug, empSlug });
    }
  }
  console.log(`Parsed ${pairs.length} (skill, employee) pairs from SKILL.md\n`);

  // 加载所有 orgs
  const orgs = await db.query.organizations.findMany();
  console.log(`Found ${orgs.length} organizations\n`);

  let insertedTotal = 0;
  let skippedTotal = 0;

  for (const org of orgs) {
    console.log(`Org: ${org.name} (${org.id})`);

    // 加载该 org 的预设员工
    const emps = await db.query.aiEmployees.findMany({
      where: eq(schema.aiEmployees.organizationId, org.id),
    });
    const empBySlug = new Map<string, string>();
    for (const e of emps) {
      if (PRESET_EMPLOYEE_SLUGS.has(e.slug)) empBySlug.set(e.slug, e.id);
    }

    // 加载该 org 的内置 skills（按 slug 查；slug 字段早期 nullable，旧数据可能 null）
    const skillRows = await db.query.skills.findMany({
      where: eq(schema.skills.organizationId, org.id),
    });
    const skillBySlug = new Map<string, string>();
    for (const s of skillRows) {
      if (s.slug) skillBySlug.set(s.slug, s.id);
    }

    // 拉一遍已有绑定，避免对 unique index 撞太多次
    const empIds = Array.from(empBySlug.values());
    const existingBindings =
      empIds.length > 0
        ? await db
            .select({
              employeeId: schema.employeeSkills.employeeId,
              skillId: schema.employeeSkills.skillId,
            })
            .from(schema.employeeSkills)
            .where(inArray(schema.employeeSkills.employeeId, empIds))
        : [];
    const existingKey = new Set(
      existingBindings.map((b) => `${b.employeeId}::${b.skillId}`),
    );

    let inserted = 0;
    let skipped = 0;
    for (const { skillSlug, empSlug } of pairs) {
      const employeeId = empBySlug.get(empSlug);
      const skillId = skillBySlug.get(skillSlug);
      if (!employeeId || !skillId) {
        skipped++;
        continue;
      }
      const key = `${employeeId}::${skillId}`;
      if (existingKey.has(key)) {
        skipped++;
        continue;
      }
      await db
        .insert(schema.employeeSkills)
        .values({
          employeeId,
          skillId,
          level: 85,
          bindingType: "core",
        })
        .onConflictDoNothing({
          target: [
            schema.employeeSkills.employeeId,
            schema.employeeSkills.skillId,
          ],
        });
      existingKey.add(key);
      inserted++;
    }

    console.log(`  ${inserted} inserted, ${skipped} already-bound/missing\n`);
    insertedTotal += inserted;
    skippedTotal += skipped;
  }

  console.log(
    `Done: ${insertedTotal} new bindings inserted, ${skippedTotal} skipped (already-bound or skill/employee not in org)`,
  );
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
