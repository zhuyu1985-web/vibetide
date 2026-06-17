// migration-craft-001.ts
//
// 四层重构 P0 — 安全增量回填:把 `skills.kind` 与 `skills.compatibleRoles` 按
// 单一真相源 src/lib/agent/tool-kinds.ts 归类。
//
// 为什么只做这一步:本回填【不改变任何运行时行为】(目前没有代码读 compatibleRoles
// 或按 kind 过滤工具),因此可独立、安全地先落库。"隐藏旧员工 / seed 工种默认实例 /
// 改写 defaultTeam"会改变派单,必须与 P1 的派单重写同批上线(见 migration-craft-002),
// 否则当前按旧 slug 派单的链路会断。
//
// Idempotent:按 slug 计算目标 kind/compatibleRoles,只 UPDATE 与现状不一致的行,
// 反复跑第二次应为 0 变更。
//
// Usage:
//   npx tsx scripts/migration-craft-001.ts            # dry-run(只打印,不写库)
//   npx tsx scripts/migration-craft-001.ts --apply    # 实际写库

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { config } from "dotenv";

import * as schema from "../src/db/schema";
import {
  UNIVERSAL_TOOL_SLUGS,
  SKILL_OWNER,
  compatibleRolesFor,
} from "../src/lib/agent/tool-kinds";

config({ path: ".env.local" });
config();

const APPLY = process.argv.includes("--apply");
const TOOL_SET = new Set<string>(UNIVERSAL_TOOL_SLUGS);

type TargetKind = "tool" | "skill";

/** 按 slug 算出目标 kind + compatibleRoles;返回 null 表示未在两份清单命中(人工复核)。 */
function classify(slug: string | null): {
  kind: TargetKind;
  compatibleRoles: string[];
} | null {
  if (!slug) return null;
  if (TOOL_SET.has(slug)) return { kind: "tool", compatibleRoles: [] };
  if (slug in SKILL_OWNER)
    return { kind: "skill", compatibleRoles: compatibleRolesFor(slug) };
  return null;
}

function sameRoles(a: string[] | null | undefined, b: string[]): boolean {
  const aa = a ?? [];
  if (aa.length !== b.length) return false;
  const setA = new Set(aa);
  return b.every((r) => setA.has(r));
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  const rows = await db
    .select({
      id: schema.skills.id,
      slug: schema.skills.slug,
      name: schema.skills.name,
      kind: schema.skills.kind,
      compatibleRoles: schema.skills.compatibleRoles,
    })
    .from(schema.skills);

  console.log(
    `${APPLY ? "[APPLY]" : "[DRY-RUN]"} 扫描 ${rows.length} 条 skill 行\n`,
  );

  let toTool = 0;
  let toSkill = 0;
  let unchanged = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    const target = classify(row.slug);
    if (!target) {
      // 未命中清单:保持默认(kind='skill', compatibleRoles 不动),记录待人工复核
      unmatched.push(row.slug ?? `(无slug) ${row.name}`);
      continue;
    }

    const kindChanged = row.kind !== target.kind;
    const rolesChanged = !sameRoles(row.compatibleRoles, target.compatibleRoles);
    if (!kindChanged && !rolesChanged) {
      unchanged++;
      continue;
    }

    if (target.kind === "tool") toTool++;
    else toSkill++;

    if (APPLY) {
      await db
        .update(schema.skills)
        .set({ kind: target.kind, compatibleRoles: target.compatibleRoles })
        .where(eq(schema.skills.id, row.id));
    } else {
      console.log(
        `  ${row.slug} → kind=${target.kind} roles=[${target.compatibleRoles.join(",")}]`,
      );
    }
  }

  console.log(
    `\n结果:tool=${toTool} skill=${toSkill} 已是目标态=${unchanged} 未命中清单=${unmatched.length}`,
  );
  if (unmatched.length > 0) {
    console.log(
      `\n⚠️ 未命中清单(保持 kind='skill',compatibleRoles 不变,请人工确认归类):`,
    );
    console.log("  " + unmatched.sort().join(", "));
  }
  if (!APPLY) {
    console.log(`\n(dry-run,未写库。确认无误后加 --apply 实际执行)`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
