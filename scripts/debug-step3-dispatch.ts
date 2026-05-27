/**
 * 模拟 step 3 cross_language_rewrite LLM-skill dispatch 用 step 2 真实输出。
 * 看 invocation.ok 是 true/false，以及 result 形态。
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  // 1. 拉 step 2 (topic_classifier) 真实 outputData.results
  const rows = await client`
    SELECT output_data -> 'results' AS results
    FROM mission_tasks
    WHERE assigned_role = 'topic_classifier'
      AND started_at > now() - interval '2 hours'
    ORDER BY started_at DESC LIMIT 1
  `;
  if (rows.length === 0) {
    console.log("No step 2 found");
    process.exit(1);
  }
  const results = rows[0].results as Array<{ id: string; category: string; confidence: number }>;
  console.log(`Step 2 results count: ${results.length}`);
  console.log(`Sample 0:`, JSON.stringify(results[0]));
  console.log(`Sample 49:`, JSON.stringify(results[49]));
  console.log(`Categories: ${new Set(results.map((r) => r.category)).size} unique`);
  console.log(`All other? ${results.every((r) => r.category === "other")}`);
  console.log(`Confidence >= 0.7 count: ${results.filter((r) => (r.confidence ?? 0) >= 0.7).length}`);

  // 2. 注入 globalForDb 让 @/db 用我的 client，然后跑 dispatch
  const schema = await import("@/db/schema");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_client = client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_instance = drizzle(client, { schema });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_warmed = true;

  const { invokeLLMSkillDirectly } = await import("@/lib/agent/llm-skill-dispatch");

  // 3. 模拟 mission-executor 传给 dispatch.execute 的 params
  const params = {
    articles: results,
    targetLanguage: "en",
    variantsPerTopic: "1",  // renderStepParameters fallback to string
  };

  console.log("\n--- Calling invokeLLMSkillDirectly('cross_language_rewrite') ---");
  const invocation = await invokeLLMSkillDirectly("cross_language_rewrite", params);
  console.log("invocation.ok:", invocation.ok);
  if (invocation.ok) {
    console.log("result keys:", Object.keys(invocation.result as object));
    const result = invocation.result as { articles?: unknown[] };
    console.log("articles array?", Array.isArray(result.articles));
    console.log("articles length:", result.articles?.length);
  } else {
    console.log("error:", invocation.error);
  }

  await client.end();
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
