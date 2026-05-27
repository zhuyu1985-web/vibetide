/**
 * 把所有"海外热榜搬运"4 步旧版 workflow 升级到 5 步新版(插入 batch_deep_read)。
 *
 * 覆盖范围:
 *   - builtin 模板(organizationId=null 的 isBuiltin=true / legacyScenarioKey=hot_topics_overseas_en)
 *   - 用户的 custom 副本(任意 isBuiltin / organizationId)
 *
 * 匹配条件(同时满足才算旧 4 步版):
 *   - steps.length === 4
 *   - steps[0].config.skillSlug === "trending_topics"
 *   - steps[1].config.skillSlug === "topic_classifier"
 *   - steps[2].config.skillSlug === "cross_language_rewrite"
 *   - steps[3].config.skillSlug === "archive_to_drafts"
 *
 * 升级动作:
 *   1. step 1, 2 保留不动(skillSlug 同名,只可能 step.id / name 用户改过)
 *   2. 在 step 2 / 3 之间插入 batch_deep_read,参数 items={{step2.results}}
 *   3. 原 step 3 cross_language_rewrite 顺延为 step 4,articles 引用从
 *      {{step2.results}} → {{step3.items}}
 *   4. 原 step 4 archive_to_drafts 顺延为 step 5,articles 引用从
 *      {{step3.articles}} → {{step4.articles}}
 *   5. 同步 step.order / step.dependsOn / step.id 编号
 *
 * 已经是 5 步或步骤签名不匹配的 workflow 跳过,不破坏用户定制。
 *
 * Usage:
 *   npx tsx scripts/upgrade-overseas-workflow.ts                       # dry-run 全扫
 *   npx tsx scripts/upgrade-overseas-workflow.ts --apply               # 真改 DB(全扫)
 *   npx tsx scripts/upgrade-overseas-workflow.ts --id <uuid>           # dry-run 单条
 *   npx tsx scripts/upgrade-overseas-workflow.ts --id <uuid> --apply   # 真改 DB(单条)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { WorkflowStepDef } from "@/db/schema/workflows";

type WorkflowStep = WorkflowStepDef;

const OLD_SIGNATURE = [
  "trending_topics",
  "topic_classifier",
  "cross_language_rewrite",
  "archive_to_drafts",
] as const;

function stepSlug(s: WorkflowStep): string | undefined {
  return s.config?.skillSlug;
}

function matchesOldSignature(steps: WorkflowStep[]): boolean {
  if (steps.length !== 4) return false;
  const sorted = [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted.every((s, i) => stepSlug(s) === OLD_SIGNATURE[i]);
}

function upgradeSteps(oldSteps: WorkflowStep[]): WorkflowStep[] {
  const sorted = [...oldSteps].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const [s1, s2, oldRewrite, oldArchive] = sorted;

  // 新 step 3: batch_deep_read
  const newDeepRead: WorkflowStep = {
    id: "step-3",
    order: 3,
    dependsOn: ["step-2"],
    name: "抓取详情正文",
    type: "skill",
    key: "fetch",
    label: "抓取详情正文",
    config: {
      skillSlug: "batch_deep_read",
      skillName: "Jina 深读",
      skillCategory: "web_search",
      parameters: {
        items: "{{step2.results}}",
        maxLength: 5000,
        maxConcurrency: 3,
      },
    },
  };

  // 原 step 3 → step 4, articles {{step2.results}} → {{step3.items}}
  const newRewrite: WorkflowStep = {
    ...oldRewrite,
    id: "step-4",
    order: 4,
    dependsOn: ["step-3"],
    config: {
      ...oldRewrite.config,
      parameters: {
        ...(oldRewrite.config?.parameters ?? {}),
        articles: "{{step3.items}}",
      },
    },
  };

  // 原 step 4 → step 5, articles {{step3.articles}} → {{step4.articles}}
  const newArchive: WorkflowStep = {
    ...oldArchive,
    id: "step-5",
    order: 5,
    dependsOn: ["step-4"],
    config: {
      ...oldArchive.config,
      parameters: {
        ...(oldArchive.config?.parameters ?? {}),
        articles: "{{step4.articles}}",
      },
    },
  };

  // step 1, 2 重写 id / dependsOn 保持新结构稳定(用户可能改过 step.id)
  const newS1: WorkflowStep = {
    ...s1,
    id: "step-1",
    order: 1,
    dependsOn: [],
  };
  const newS2: WorkflowStep = {
    ...s2,
    id: "step-2",
    order: 2,
    dependsOn: ["step-1"],
  };

  return [newS1, newS2, newDeepRead, newRewrite, newArchive];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const idArgIndex = process.argv.indexOf("--id");
  const targetId =
    idArgIndex !== -1 ? process.argv[idArgIndex + 1] : undefined;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const client = postgres(url, {
    prepare: false,
    connect_timeout: 10,
    max: 1,
  });

  const schema = await import("@/db/schema");
  const dbInstance = drizzle(client, { schema });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_client = client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_instance = dbInstance;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_warmed = true;

  const { db } = await import("@/db");
  const { workflowTemplates } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const baseQuery = db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      organizationId: workflowTemplates.organizationId,
      isBuiltin: workflowTemplates.isBuiltin,
      legacyScenarioKey: workflowTemplates.legacyScenarioKey,
      steps: workflowTemplates.steps,
    })
    .from(workflowTemplates);

  const all = targetId
    ? await baseQuery.where(eq(workflowTemplates.id, targetId))
    : await baseQuery;

  if (targetId) {
    console.log(`Scanning single workflow id=${targetId}\n`);
    if (all.length === 0) {
      console.log("Workflow 不存在,退出。");
      await client.end();
      process.exit(1);
    }
  } else {
    console.log(`Scanned ${all.length} workflow_templates rows.\n`);
  }

  let matched = 0;
  let upgraded = 0;
  let skipped = 0;

  for (const row of all) {
    const steps = (row.steps ?? []) as WorkflowStep[];
    if (!Array.isArray(steps) || steps.length === 0) {
      skipped++;
      continue;
    }
    if (!matchesOldSignature(steps)) {
      skipped++;
      continue;
    }
    matched++;
    const newSteps = upgradeSteps(steps);

    console.log(
      `[match] id=${row.id} name="${row.name}" org=${row.organizationId ?? "<null>"} builtin=${row.isBuiltin} key=${row.legacyScenarioKey ?? "-"}`,
    );
    console.log(`  before: ${steps.map(stepSlug).join(" → ")}`);
    console.log(`  after:  ${newSteps.map(stepSlug).join(" → ")}`);

    if (apply) {
      await db
        .update(workflowTemplates)
        .set({ steps: newSteps })
        .where(eq(workflowTemplates.id, row.id));
      upgraded++;
      console.log(`  ✓ upgraded\n`);
    } else {
      console.log(`  (dry-run, 加 --apply 真改)\n`);
    }
  }

  console.log("─────────────────────────────────────");
  console.log(
    `Summary: scanned=${all.length} matched=${matched} ${apply ? `upgraded=${upgraded}` : "(dry-run)"} skipped=${skipped}`,
  );

  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Failed:", err);
  process.exit(1);
});
