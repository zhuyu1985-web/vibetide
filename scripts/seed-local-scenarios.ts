/**
 * 一次性脚本:把 2026-05-29 新增的 4 条"本地化场景"(早晚报 / 政策解读 / 本地热点 /
 * 数据新闻) 写到所有 organization。
 *
 * Usage:
 *   npx tsx scripts/seed-local-scenarios.ts
 *
 * 幂等:复用 seedBuiltinTemplatesForOrg 的 onConflictDoUpdate(legacy_scenario_key
 * 唯一索引),重复跑只会刷新现有行,不会插重复。
 *
 * 注意:必须用 dynamic import 让 dotenv 先加载,否则 `@/db` 的 createClient()
 * 在模块顶层运行时 DATABASE_URL 还是空,会用 fallback 报 ECONNREFUSED。
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  // 动态 import 保证 db client 在 env 加载后才初始化
  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema");
  const { seedBuiltinTemplatesForOrg } = await import(
    "@/lib/dal/workflow-templates"
  );
  const { buildBuiltinScenarioSeeds } = await import(
    "@/db/seed-builtin-workflows"
  );
  type BuiltinSeedInput = Awaited<
    ReturnType<typeof buildBuiltinScenarioSeeds>
  > extends Array<infer T>
    ? T
    : never;

  const NEW_SLUGS = new Set([
    "local_briefing_chengdu",
    "local_policy_interpretation_chengdu",
    "local_hotspot_chengdu",
    "local_data_news_chengdu",
  ]);

  const allSeeds = buildBuiltinScenarioSeeds();
  const newOnly: BuiltinSeedInput[] = allSeeds.filter((s: BuiltinSeedInput) =>
    s.legacyScenarioKey ? NEW_SLUGS.has(s.legacyScenarioKey) : false,
  );

  if (newOnly.length !== NEW_SLUGS.size) {
    console.error(
      `[seed-local-scenarios] 期望 ${NEW_SLUGS.size} 条新场景,实际找到 ${newOnly.length} 条`,
    );
    process.exit(1);
  }

  console.log(`[seed-local-scenarios] 准备写入 ${newOnly.length} 条新场景:`);
  for (const s of newOnly)
    console.log(`  - ${s.legacyScenarioKey} (${s.name})`);

  const orgs = await db.select().from(organizations);
  console.log(`\n[seed-local-scenarios] 遍历 ${orgs.length} 个 org`);

  for (const org of orgs) {
    await seedBuiltinTemplatesForOrg(org.id, newOnly);
    console.log(`  ✓ org ${org.id.slice(0, 8)} (${org.name}) 完成`);
  }

  console.log("\n[seed-local-scenarios] DB 写入完成,准备 invalidate Next.js 缓存");
  await invalidatePagesViaApi(["/workflows", "/home"]);

  console.log("\n[seed-local-scenarios] 全部完成");
  process.exit(0);
}

/**
 * 调本地 /api/internal/revalidate-paths 让 Next.js 重新渲染指定页面。
 * - dev 模式无需 secret;production 模式从 env 读 INTERNAL_REVALIDATE_KEY
 * - dev server 没启就静默跳过(不算失败,只是没人接缓存清理)
 */
async function invalidatePagesViaApi(paths: string[]): Promise<void> {
  const baseUrl = process.env.DEV_SERVER_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/api/internal/revalidate-paths`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.INTERNAL_REVALIDATE_KEY;
  if (key) headers["x-internal-key"] = key;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ paths }),
      // 短超时:dev server 没启就快速失败,不要 hang 30s
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn(
        `[seed-local-scenarios] 缓存清理跳过 (HTTP ${res.status}) —— 你可能需要手动刷新 ${paths.join(", ")}`,
      );
      return;
    }
    const data = (await res.json()) as { accepted?: string[] };
    console.log(
      `  ✓ 已 invalidate: ${(data.accepted ?? []).join(", ") || "(无)"}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[seed-local-scenarios] 缓存清理跳过 (${msg}) —— dev server 没启动?手动刷新 ${paths.join(", ")} 即可`,
    );
  }
}

main().catch((err) => {
  console.error("[seed-local-scenarios] 失败:", err);
  process.exit(1);
});
