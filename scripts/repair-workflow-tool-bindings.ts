/**
 * 幂等修复历史工作流中已知的空工具参数。
 *
 * 默认 dry-run；只有传 --apply 才写数据库。仅修改精确匹配且 parameters 为空的步骤，
 * 不覆盖用户已经手工配置过的参数。
 *
 * Usage:
 *   npx tsx scripts/repair-workflow-tool-bindings.ts
 *   npx tsx scripts/repair-workflow-tool-bindings.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { WorkflowStepDef } from "@/db/schema/workflows";

type WorkflowStep = WorkflowStepDef;

function hasNoParameters(step: WorkflowStep): boolean {
  return Object.keys(step.config?.parameters ?? {}).length === 0;
}

function repairSteps(name: string, steps: WorkflowStep[]): WorkflowStep[] | null {
  const baseName = name.replace(/[（(]副本[）)](?:\s*\d+)?$/, "").trim();
  let changed = false;

  const repaired = steps.map((step) => {
    const skill = step.config?.skillSlug;
    if (!hasNoParameters(step)) return step;

    if (
      baseName === "突发新闻追踪" &&
      step.name === "事实交叉核查" &&
      skill === "fact_check"
    ) {
      changed = true;
      return {
        ...step,
        config: {
          ...step.config,
          parameters: { text: "{{step2.text}}" },
        },
      };
    }

    if (
      baseName === "热点素材抓取" &&
      step.name === "素材深度爬取" &&
      skill === "web_deep_read"
    ) {
      changed = true;
      return {
        ...step,
        config: {
          ...step.config,
          skillSlug: "batch_deep_read",
          skillName: "批量网页深读",
          parameters: { items: "{{step1.results}}" },
        },
      };
    }

    if (
      baseName === "热点单条海外转发" &&
      step.name === "翻译改写" &&
      skill === "cross_language_rewrite"
    ) {
      changed = true;
      return {
        ...step,
        config: {
          ...step.config,
          parameters: {
            articles:
              '[{"id":"{{source_topic_id}}","title":"{{source_title}}","body":"{{source_body}}","sourceUrl":"{{source_url}}","category":"auto","confidence":1}]',
            targetLanguage: "en",
            variantsPerTopic: "{{variants_per_topic}}",
          },
        },
      };
    }

    return step;
  });

  return changed ? repaired : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const client = postgres(url, {
    prepare: false,
    connect_timeout: 10,
    max: 1,
  });

  try {
    const schema = await import("@/db/schema");
    const dbInstance = drizzle(client, { schema });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__db_client = client;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__db_instance = dbInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__db_warmed = true;

    const { db } = await import("@/db");
    const { workflowTemplates } = schema;
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({
        id: workflowTemplates.id,
        name: workflowTemplates.name,
        steps: workflowTemplates.steps,
      })
      .from(workflowTemplates);

    let matched = 0;
    for (const row of rows) {
      const repaired = repairSteps(
        row.name,
        (row.steps ?? []) as WorkflowStep[],
      );
      if (!repaired) continue;
      matched++;
      console.log(`${apply ? "APPLY" : "DRY-RUN"} ${row.id} ${row.name}`);
      if (apply) {
        await db
          .update(workflowTemplates)
          .set({ steps: repaired, updatedAt: new Date() })
          .where(eq(workflowTemplates.id, row.id));
      }
    }

    console.log(
      `${apply ? "Updated" : "Would update"} ${matched} workflow template(s).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
