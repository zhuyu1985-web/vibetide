/**
 * 用 loadDependencyOutputs + renderStepParameters 完整重现 step 3 dispatch invocation。
 * 看 params.articles 实际是什么 type / shape。
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const schema = await import("@/db/schema");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_client = client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_instance = drizzle(client, { schema });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_warmed = true;

  // 找最近 step 3 task 的 id + mission_id
  const rows = await client`
    SELECT t.id AS task_id, t.mission_id, t.assigned_role, t.dependencies, t.priority
    FROM mission_tasks t
    WHERE t.assigned_role='cross_language_rewrite' AND t.started_at > now()-interval '30 minutes'
    ORDER BY t.started_at DESC LIMIT 1
  `;
  if (rows.length === 0) {
    console.log("no step 3 task found");
    process.exit(1);
  }
  const { task_id, mission_id, dependencies, priority } = rows[0];
  console.log("step 3 task:", { task_id, mission_id, dependencies, priority });

  // 加载 dependency outputs (跟 mission-executor 一样)
  const { loadDependencyOutputs } = await import("@/lib/mission-core");
  // loadDependencyOutputs 期望 dep task ids
  // dependencies 是 jsonb array. parse:
  const depIds = dependencies as string[];
  console.log("dep ids:", depIds);
  const previousSteps = await loadDependencyOutputs(depIds);
  console.log("previousSteps count:", previousSteps.length);
  previousSteps.forEach((s, i) => {
    console.log(`previousSteps[${i}] keys:`, Object.keys(s));
    if ("results" in s) {
      console.log(`previousSteps[${i}].results type:`, Array.isArray(s.results) ? "array" : typeof s.results, `len:`, Array.isArray(s.results) ? (s.results as unknown[]).length : "n/a");
    }
    if ("topics" in s) {
      console.log(`previousSteps[${i}].topics type:`, Array.isArray(s.topics) ? "array" : typeof s.topics);
    }
  });

  // 复现 Fix 8: 按 priority pad upstream outputs
  const allUpstream = await client`
    SELECT id, priority FROM mission_tasks
    WHERE mission_id=${mission_id} AND priority<${priority} AND status='completed'
  `;
  console.log("allUpstream:", allUpstream);
  const upstreamIds = allUpstream.map((t) => t.id);
  const upstreamOuts = await loadDependencyOutputs(upstreamIds);
  const previousStepsForRender: Array<{ outputData?: unknown }> = [];
  allUpstream.forEach((upTask) => {
    const out = upstreamOuts.find((s) => s.stepKey === upTask.id);
    if (out && upTask.priority != null) {
      previousStepsForRender[(upTask.priority as number) - 1] = { outputData: out };
    }
  });
  if (previousStepsForRender.length === 0) {
    previousSteps.forEach((s, i) => { previousStepsForRender[i] = { outputData: s }; });
  }
  console.log("previousStepsForRender length:", previousStepsForRender.length);
  console.log("previousStepsForRender[0]?", previousStepsForRender[0] !== undefined);
  console.log("previousStepsForRender[1]?", previousStepsForRender[1] !== undefined);

  // mission inputParams
  const missionRow = await client`SELECT input_params FROM missions WHERE id=${mission_id}`;
  const missionInputParams = missionRow[0].input_params as Record<string, unknown>;
  console.log("missionInputParams keys:", Object.keys(missionInputParams || {}));

  // step 3 paramConfig
  const tplRow = await client`
    SELECT wt.steps FROM workflow_templates wt JOIN missions m ON m.workflow_template_id=wt.id
    WHERE m.id=${mission_id}
  `;
  const steps = tplRow[0].steps as Array<{ order: number; config: { skillSlug: string; parameters: Record<string, unknown> } }>;
  const step3 = steps.find((s) => s.order === priority);
  console.log("step3.config.parameters:", step3?.config?.parameters);

  const { renderStepParameters } = await import("@/lib/mission-executor");
  const rendered = renderStepParameters(
    step3!.config.parameters,
    { inputParams: missionInputParams },
    previousStepsForRender,
  );
  console.log("\n=== Rendered params ===");
  console.log("articles type:", Array.isArray(rendered.articles) ? "array" : typeof rendered.articles);
  if (typeof rendered.articles === "string") {
    console.log("articles string preview:", (rendered.articles as string).slice(0, 200));
  } else if (Array.isArray(rendered.articles)) {
    console.log("articles array length:", (rendered.articles as unknown[]).length);
  } else {
    console.log("articles value:", rendered.articles);
  }
  console.log("targetLanguage:", rendered.targetLanguage);
  console.log("variantsPerTopic:", rendered.variantsPerTopic, "type:", typeof rendered.variantsPerTopic);

  // 调 dispatch
  const { invokeLLMSkillDirectly } = await import("@/lib/agent/llm-skill-dispatch");
  const invocation = await invokeLLMSkillDirectly("cross_language_rewrite", rendered);
  console.log("\n=== Invocation ===");
  console.log("ok:", invocation.ok);
  if (!invocation.ok) console.log("error:", invocation.error);

  await client.end();
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
