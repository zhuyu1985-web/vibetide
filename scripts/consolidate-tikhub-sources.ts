/**
 * scripts/consolidate-tikhub-sources.ts
 *
 * 把所有 source_type='tikhub' 且 mode='account' 的旧采集源,按 accountPlatform 合并成
 * 4 个 canonical 采集源,每个 org 一套:
 *   - tikhub.io 社媒采集-抖音    (douyin)
 *   - tikhub.io 社媒采集-微博    (weibo)
 *   - tikhub.io 社媒采集-快手    (kuaishou)
 *   - tikhub.io 社媒采集-微信公众号 (wechat_oa)
 *
 * 合并语义:
 *  - 同 (org, platform) 内所有 source 的 outletIds 取并集
 *  - maxPagesPerRun / resultsPerPage / monthlyBudgetUsd 取 max
 *  - targetModules / defaultTags 取并集; defaultCategory / outletId / region / tier 留空
 *  - scheduleCron: 手工触发(null) — 用户跑一次后可按需调
 *  - enabled = true(只要被合并的源里至少一个还启用)
 *  - 旧 source 走软删除 (deleted_at = now())
 *
 * Keyword-mode tikhub source 和其他类型不动。
 *
 * 用法:
 *   pnpm tsx scripts/consolidate-tikhub-sources.ts             # dry-run, 仅打印计划
 *   pnpm tsx scripts/consolidate-tikhub-sources.ts --apply     # 真正写库
 *   pnpm tsx scripts/consolidate-tikhub-sources.ts --org <id>  # 限定 org
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// ⚠ ES module 的 `import` 会被 hoist 到顶端,如果直接 import `@/db`,
// db 模块在 dotenv 注入之前就读了 process.env.DATABASE_URL = undefined,
// postgres 默认会连 localhost:5432 → ECONNREFUSED。
// 必须先 await dotenv 注入,再用 dynamic import 加载 db。
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  normalizeLegacyTikhubConfig,
  TIKHUB_ACCOUNT_PLATFORMS,
  TIKHUB_ACCOUNT_PLATFORM_LABELS,
  type TikhubAccountPlatform,
} from "@/lib/collection/adapters/tikhub/config";

const apply = process.argv.includes("--apply");
const orgFlag = process.argv.indexOf("--org");
const orgFilter = orgFlag >= 0 ? process.argv[orgFlag + 1] : null;

const MERGED_NAME = (p: TikhubAccountPlatform) =>
  `tikhub.io 社媒采集-${TIKHUB_ACCOUNT_PLATFORM_LABELS[p]}`;

interface PerOrgPerPlatformBucket {
  outletIds: Set<string>;
  sourceIds: string[];
  maxPages: number;
  resultsPerPage: number;
  budget: number;
  enabled: boolean;
  targetModules: Set<string>;
  defaultTags: Set<string>;
}

function newBucket(): PerOrgPerPlatformBucket {
  return {
    outletIds: new Set(),
    sourceIds: [],
    maxPages: 1,
    resultsPerPage: 20,
    budget: 0,
    enabled: false,
    targetModules: new Set(),
    defaultTags: new Set(),
  };
}

async function main() {
  console.log(`[consolidate-tikhub] mode = ${apply ? "APPLY" : "DRY-RUN"}`);
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL 未注入 — 检查 .env.local 是否存在并能被 dotenv 读到");
  }
  if (orgFilter) console.log(`[consolidate-tikhub] org filter = ${orgFilter}`);

  // dynamic import: 确保 db 模块在 dotenv 注入之后才求值
  const { db } = await import("@/db");
  const { collectionSources } = await import("@/db/schema/collection");

  // 1) 拉所有未软删的 tikhub source
  const allTikhub = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.sourceType, "tikhub"),
        isNull(collectionSources.deletedAt),
      ),
    );

  const filtered = orgFilter
    ? allTikhub.filter((s) => s.organizationId === orgFilter)
    : allTikhub;

  console.log(`[consolidate-tikhub] 总数: ${filtered.length} 条 tikhub source`);

  // 2) 按 (org, platform) 分桶,只看 account 模式
  // 旧字段单值 / 新字段数组都兼容(normalizeLegacyTikhubConfig 统一)
  const buckets = new Map<string, PerOrgPerPlatformBucket>();
  const keywordSources: typeof filtered = [];
  const malformed: { id: string; name: string; reason: string }[] = [];

  for (const src of filtered) {
    let cfg;
    try {
      cfg = normalizeLegacyTikhubConfig(src.config);
    } catch (e) {
      malformed.push({
        id: src.id,
        name: src.name,
        reason: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    if (cfg.mode === "keyword") {
      keywordSources.push(src);
      continue;
    }

    // account 模式:对每个 platform 加一笔 (该 source 在该 platform 上贡献全部 outletIds)
    for (const platform of cfg.accountPlatforms) {
      const key = `${src.organizationId}::${platform}`;
      let b = buckets.get(key);
      if (!b) {
        b = newBucket();
        buckets.set(key, b);
      }
      for (const oid of cfg.outletIds) b.outletIds.add(oid);
      b.sourceIds.push(src.id);
      b.maxPages = Math.max(b.maxPages, cfg.maxPagesPerRun);
      b.resultsPerPage = Math.max(b.resultsPerPage, cfg.resultsPerPage);
      b.budget = Math.max(b.budget, cfg.monthlyBudgetUsd);
      b.enabled = b.enabled || src.enabled;
      for (const m of src.targetModules ?? []) b.targetModules.add(m);
      for (const t of src.defaultTags ?? []) b.defaultTags.add(t);
    }
  }

  // 3) 输出计划
  console.log("");
  console.log(`── 计划 ──────────────────────────────────────────────────`);
  console.log(`保留不动(keyword 模式): ${keywordSources.length} 条`);
  for (const k of keywordSources) {
    console.log(`  - [${k.id.slice(0, 8)}] ${k.name}`);
  }

  console.log("");
  console.log(`合并 account 模式: ${buckets.size} 个 (org × platform) 桶`);
  for (const [key, b] of buckets) {
    const [org, platform] = key.split("::") as [string, TikhubAccountPlatform];
    console.log(
      `  ✦ org ${org.slice(0, 8)} / ${platform} → ${MERGED_NAME(platform)}`,
    );
    console.log(
      `      outlets=${b.outletIds.size}, sources 被合并=${b.sourceIds.length}, ` +
        `maxPages=${b.maxPages}, perPage=${b.resultsPerPage}, budget=$${b.budget}, ` +
        `enabled=${b.enabled}, targetModules=[${[...b.targetModules].join(",")}]`,
    );
    console.log(
      `      旧 source 将软删: ${b.sourceIds.map((id) => id.slice(0, 8)).join(", ")}`,
    );
  }

  if (malformed.length > 0) {
    console.log("");
    console.log(`⚠ 异常 config 不会被合并(${malformed.length} 条):`);
    for (const m of malformed) {
      console.log(`  - [${m.id.slice(0, 8)}] ${m.name}: ${m.reason}`);
    }
  }

  console.log("");

  if (!apply) {
    console.log("DRY-RUN 完成。加 --apply 真正写库。");
    return;
  }

  // 4) APPLY: 事务里 upsert 4 个 canonical source + 软删旧 source
  console.log("── APPLY ─────────────────────────────────────────────────");
  for (const [key, b] of buckets) {
    const [org, platform] = key.split("::") as [string, TikhubAccountPlatform];
    const name = MERGED_NAME(platform);
    const cfgPayload = {
      mode: "account" as const,
      accountPlatforms: [platform],
      outletIds: [...b.outletIds],
      maxPagesPerRun: b.maxPages,
      resultsPerPage: b.resultsPerPage,
      monthlyBudgetUsd: b.budget > 0 ? b.budget : 5,
    };

    // upsert by (org, name)
    const existing = await db
      .select()
      .from(collectionSources)
      .where(
        and(
          eq(collectionSources.organizationId, org),
          eq(collectionSources.name, name),
        ),
      )
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      // 已存在同名 source(可能是上次脚本跑过) — 把它和本次合并桶再合并
      const old = existing[0];
      let oldCfg;
      try {
        oldCfg = normalizeLegacyTikhubConfig(old.config);
      } catch {
        oldCfg = null;
      }
      const merged = new Set(cfgPayload.outletIds);
      if (oldCfg && oldCfg.mode === "account") {
        for (const oid of oldCfg.outletIds) merged.add(oid);
      }
      cfgPayload.outletIds = [...merged];

      await db
        .update(collectionSources)
        .set({
          config: cfgPayload,
          enabled: b.enabled || old.enabled,
          deletedAt: null,
          targetModules: [...new Set([...(old.targetModules ?? []), ...b.targetModules])],
          defaultTags: [
            ...new Set([...(old.defaultTags ?? []), ...b.defaultTags]),
          ],
          updatedAt: new Date(),
        })
        .where(eq(collectionSources.id, old.id));
      console.log(`  ↻ UPDATE ${name} (id=${old.id.slice(0, 8)}, outlets=${merged.size})`);
    } else {
      const [inserted] = await db
        .insert(collectionSources)
        .values({
          organizationId: org,
          name,
          sourceType: "tikhub",
          config: cfgPayload,
          scheduleCron: null,
          targetModules: [...b.targetModules],
          defaultTags: b.defaultTags.size > 0 ? [...b.defaultTags] : null,
          enabled: b.enabled,
        })
        .returning();
      console.log(
        `  + INSERT ${name} (id=${inserted?.id.slice(0, 8)}, outlets=${cfgPayload.outletIds.length})`,
      );
    }

    // 软删旧 source
    await db
      .update(collectionSources)
      .set({
        deletedAt: new Date(),
        enabled: false,
        // 在 config 留一个 break crumb 方便审计 / 回滚
        config: sql`config || jsonb_build_object('consolidated_into', ${name}::text, 'consolidated_at', NOW()::text)`,
      })
      .where(
        sql`${collectionSources.id} = ANY(ARRAY[${sql.join(
          b.sourceIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}])`,
      );
    console.log(`     软删旧 source: ${b.sourceIds.length} 条`);
  }

  console.log("");
  console.log("✓ APPLY 完成。建议用 /data-collection/sources 页面 visually 核对一遍。");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ failed:", e);
    process.exit(1);
  });
