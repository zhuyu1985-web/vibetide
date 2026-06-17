// migration-craft-002.ts
//
// 四层重构 P1 — 让"工种=模板/员工=实例"在派单层真正生效。必须与运行时派单改动
// (mission-core.ts pickEmployeeForStep 确定性派单 + loadAvailableEmployees hidden 过滤)
// 同批上线。
//
// 每个 org 执行四件事(全部幂等):
//   1. seed 10 个工种默认实例(slug = roleType = craft slug,isPreset=1,hidden=0)。
//   2. 为每个工种实例按 CRAFT_CORE_SKILLS 绑定 core 技能(仅绑该 org 实际存在的 skill)。
//   3. 隐藏旧 10 个内容员工(hidden=1)——不进新花名册、不参与派单;行保留供 mission 历史显示。
//      leader / advisor 保留可见(leaderEmployeeId / 频道顾问 等运行时仍按 id/slug 使用)。
//   4. 把 workflow_templates.defaultTeam 里的旧员工 slug 改写为工种 slug(派单不再依赖它,
//      仅作展示/tie-break;映射近似即可)。
//
// Usage:
//   npx tsx scripts/migration-craft-002.ts            # dry-run
//   npx tsx scripts/migration-craft-002.ts --apply    # 写库

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import { config } from "dotenv";

import * as schema from "../src/db/schema";
import {
  CRAFT_META,
  CRAFT_CORE_SKILLS,
  ORDERED_CRAFTS,
  type CraftType,
} from "../src/lib/constants";

config({ path: ".env.local" });
config();

const APPLY = process.argv.includes("--apply");

// 迁移后隐藏的旧内容员工(被 9+1 工种实例取代)。leader / advisor 保留。
const OLD_CONTENT_SLUGS = [
  "xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaojian",
  "xiaoshen", "xiaofa", "xiaoshu", "xiaoyan", "xiaotan",
];

// defaultTeam 旧 slug → 工种 slug(近似映射,仅用于展示/tie-break)。
const OLD_SLUG_TO_CRAFT: Record<string, CraftType> = {
  xiaolei: "reporter",
  xiaoce: "director",
  xiaozi: "reporter",
  xiaowen: "reporter",
  xiaojian: "post_production",
  xiaoshen: "reviewer",
  xiaofa: "operator",
  xiaoshu: "analyst",
  xiaoyan: "commentator",
  xiaotan: "commentator",
  advisor: "operator",
  leader: "producer",
};

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  const orgs = await db.query.organizations.findMany();
  console.log(
    `${APPLY ? "[APPLY]" : "[DRY-RUN]"} ${orgs.length} 个 org\n`,
  );

  let instCreated = 0;
  let skillsBound = 0;
  let hidden = 0;
  let teamsRewritten = 0;

  for (const org of orgs) {
    // org 内 skill slug → id
    const skillRows = await db
      .select({ id: schema.skills.id, slug: schema.skills.slug })
      .from(schema.skills)
      .where(eq(schema.skills.organizationId, org.id));
    const skillIdBySlug = new Map<string, string>();
    for (const s of skillRows) if (s.slug) skillIdBySlug.set(s.slug, s.id);

    // 1+2. seed 工种实例 + 绑 core 技能
    for (const craft of ORDERED_CRAFTS) {
      const meta = CRAFT_META[craft];
      let employeeId: string | undefined;

      const existing = await db
        .select({ id: schema.aiEmployees.id })
        .from(schema.aiEmployees)
        .where(
          and(
            eq(schema.aiEmployees.organizationId, org.id),
            eq(schema.aiEmployees.slug, craft),
          ),
        );
      if (existing[0]) {
        employeeId = existing[0].id;
      } else if (APPLY) {
        const [created] = await db
          .insert(schema.aiEmployees)
          .values({
            organizationId: org.id,
            slug: craft,
            name: meta.name,
            nickname: meta.name,
            title: meta.name,
            roleType: craft,
            authorityLevel: meta.defaultAuthority,
            isPreset: 1,
            hidden: 0,
          })
          .onConflictDoNothing({
            target: [
              schema.aiEmployees.organizationId,
              schema.aiEmployees.slug,
            ],
          })
          .returning({ id: schema.aiEmployees.id });
        employeeId = created?.id;
        if (created) instCreated++;
      } else {
        instCreated++; // dry-run 计数
      }

      // 绑 core 技能(仅该 org 存在的 skill)
      const coreSlugs = CRAFT_CORE_SKILLS[craft].filter((s) =>
        skillIdBySlug.has(s),
      );
      if (employeeId && APPLY) {
        for (const slug of coreSlugs) {
          const res = await db
            .insert(schema.employeeSkills)
            .values({
              employeeId,
              skillId: skillIdBySlug.get(slug)!,
              level: 85,
              bindingType: "core",
            })
            .onConflictDoNothing({
              target: [
                schema.employeeSkills.employeeId,
                schema.employeeSkills.skillId,
              ],
            })
            .returning({ id: schema.employeeSkills.id });
          if (res[0]) skillsBound++;
        }
      } else if (!APPLY) {
        skillsBound += coreSlugs.length;
      }
    }

    // 3. 隐藏旧内容员工
    for (const slug of OLD_CONTENT_SLUGS) {
      if (APPLY) {
        const res = await db
          .update(schema.aiEmployees)
          .set({ hidden: 1 })
          .where(
            and(
              eq(schema.aiEmployees.organizationId, org.id),
              eq(schema.aiEmployees.slug, slug),
              eq(schema.aiEmployees.hidden, 0),
            ),
          )
          .returning({ id: schema.aiEmployees.id });
        hidden += res.length;
      }
    }

    // 4. 改写 defaultTeam
    const tpls = await db
      .select({
        id: schema.workflowTemplates.id,
        defaultTeam: schema.workflowTemplates.defaultTeam,
      })
      .from(schema.workflowTemplates)
      .where(eq(schema.workflowTemplates.organizationId, org.id));
    for (const tpl of tpls) {
      const team = (tpl.defaultTeam as string[] | null) ?? [];
      if (team.length === 0) continue;
      const mapped = team.map((s) => OLD_SLUG_TO_CRAFT[s] ?? s);
      const deduped = [...new Set(mapped)];
      const changed =
        deduped.length !== team.length ||
        deduped.some((v, i) => v !== team[i]);
      if (!changed) continue;
      teamsRewritten++;
      if (APPLY) {
        await db
          .update(schema.workflowTemplates)
          .set({ defaultTeam: deduped })
          .where(eq(schema.workflowTemplates.id, tpl.id));
      }
    }
  }

  console.log(
    `结果:工种实例=${instCreated} core绑定=${skillsBound} 隐藏旧员工=${hidden} 改写defaultTeam=${teamsRewritten}`,
  );
  if (!APPLY) console.log("\n(dry-run,未写库。确认后加 --apply)");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
