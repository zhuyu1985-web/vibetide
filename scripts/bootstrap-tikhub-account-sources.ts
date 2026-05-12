/**
 * scripts/bootstrap-tikhub-account-sources.ts
 *
 * 为媒体字典中"已填好账号识别符"的 outlets 批量创建 tikhub account-mode 采集源,
 * 并可选择立即跑一遍把数据拉回 collected_items。
 *
 * 跳过抖音(--skip-platforms douyin),因为抖音短链需要人工解析。
 *
 * 用法:
 *   pnpm tsx scripts/bootstrap-tikhub-account-sources.ts            # 仅创建 source,不跑
 *   pnpm tsx scripts/bootstrap-tikhub-account-sources.ts --run-now  # 创建后立即跑一遍
 *   pnpm tsx scripts/bootstrap-tikhub-account-sources.ts --tier central --run-now  # 限定央级
 *   pnpm tsx scripts/bootstrap-tikhub-account-sources.ts --dry-run  # 预演,不写库
 *
 * 默认值:
 *   - 范围: outlet_tier=central (12 家央级媒体)
 *   - 平台: weibo + kuaishou + wechat_oa (跳过抖音)
 *   - 模式: account
 *   - 调度: 手工触发(无 cron)
 *   - 月预算: $2 USD
 *   - 每次拉 1 页 × 20 条 (省预算)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  collectionSources,
  collectionRuns,
  collectionLogs,
} from "@/db/schema";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { tikhubAdapter } from "@/lib/collection/adapters/tikhub";
import { writeItems } from "@/lib/collection/writer";
import type {
  Channel,
  ChannelType,
} from "@/lib/media-outlet/channels";
import { getChannelIdentifier } from "@/lib/media-outlet/channels";

const args = process.argv.slice(2);
const runNow = args.includes("--run-now");
const dryRun = args.includes("--dry-run");
const tierArg = (() => {
  const i = args.indexOf("--tier");
  return i >= 0 ? args[i + 1] : "central";
})();

const TARGET_PLATFORMS: ChannelType[] = ["weibo", "kuaishou", "wechat_oa"];

interface SourcePlan {
  outletId: string;
  outletName: string;
  platform: ChannelType;
  channel: Channel;
  name: string;
}

async function main() {
  // 1. 找 tier 内有 channels 的 outlets
  const outlets = await db
    .select()
    .from(mediaOutletDictionary)
    .where(
      and(
        eq(mediaOutletDictionary.outletTier, tierArg),
        eq(mediaOutletDictionary.isActive, true),
      ),
    );

  if (outlets.length === 0) {
    console.error(`❌ tier=${tierArg} 下没有 outlets`);
    process.exit(1);
  }

  const orgId = outlets[0]!.organizationId;
  console.log(`📋 tier=${tierArg}, ${outlets.length} 个 outlets, org=${orgId}\n`);

  // 2. 生成 source plan
  const plans: SourcePlan[] = [];
  for (const o of outlets) {
    const channels = (o.channels ?? []) as Channel[];
    for (const p of TARGET_PLATFORMS) {
      const ch = channels.find(
        (c) => c.type === p && Boolean(getChannelIdentifier(c)),
      );
      if (!ch) continue;
      plans.push({
        outletId: o.id,
        outletName: o.outletName,
        platform: p,
        channel: ch,
        name: `tikhub-${p}-${o.outletName}`,
      });
    }
  }

  console.log(`计划创建 ${plans.length} 个 tikhub account-mode sources:\n`);
  const byPlatform: Record<string, number> = {};
  for (const p of plans) byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
  for (const [k, v] of Object.entries(byPlatform)) {
    console.log(`  ${k.padEnd(12)} ${v} 个`);
  }
  console.log();

  if (dryRun) {
    console.log("(DRY RUN — 不创建)");
    plans.forEach((p) => console.log(`  - ${p.name}`));
    process.exit(0);
  }

  // 3. 查已存在的 sources (按 name 幂等)
  const existingNames = await db
    .select({ name: collectionSources.name })
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        inArray(
          collectionSources.name,
          plans.map((p) => p.name),
        ),
      ),
    );
  const existingSet = new Set(existingNames.map((r) => r.name));
  console.log(`其中已存在(跳过): ${existingSet.size}\n`);

  // 4. 插入新 sources
  const toCreate = plans.filter((p) => !existingSet.has(p.name));
  if (toCreate.length === 0) {
    console.log("没有新 source 要创建。");
  } else {
    const sourceRows = await db
      .insert(collectionSources)
      .values(
        toCreate.map((p) => ({
          organizationId: orgId,
          name: p.name,
          sourceType: "tikhub",
          enabled: true,
          scheduleCron: null,
          targetModules: ["news"] as string[],
          outletId: p.outletId,
          config: {
            mode: "account",
            outletId: p.outletId,
            accountPlatform: p.platform,
            maxPagesPerRun: 1,
            resultsPerPage: 20,
            monthlyBudgetUsd: 2,
          },
        })),
      )
      .returning({ id: collectionSources.id, name: collectionSources.name });

    console.log(`✅ 已创建 ${sourceRows.length} 个 sources\n`);
  }

  if (!runNow) {
    console.log("(未指定 --run-now,本次只建源不跑。去 /data-collection/sources 手动触发)");
    process.exit(0);
  }

  // 5. 立即跑一遍(直接调 adapter + writer,跳过 Inngest)
  console.log("━━━ 开始采集 ━━━\n");

  // 重新拉所有匹配 name 的 sources (含刚创建的 + 已存在的)
  const allSources = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        inArray(
          collectionSources.name,
          plans.map((p) => p.name),
        ),
      ),
    );

  let totalInserted = 0;
  let totalCost = 0;
  let runOk = 0;
  let runFailed = 0;

  for (const source of allSources) {
    const t0 = Date.now();
    const [run] = await db
      .insert(collectionRuns)
      .values({
        sourceId: source.id,
        organizationId: orgId,
        trigger: "manual",
        startedAt: new Date(),
        status: "running",
      })
      .returning({ id: collectionRuns.id });
    const runId = run!.id;

    try {
      const parsed = tikhubAdapter.configSchema.safeParse(source.config);
      if (!parsed.success) {
        throw new Error(`config invalid: ${parsed.error.message}`);
      }

      const result = await tikhubAdapter.execute({
        // discriminatedUnion 在 generic SourceAdapter<TikhubConfig> 上的推断会丢分支信息,
        // 这里 cast 回 TikhubConfig 安全(已经 safeParse 通过)。
        config: parsed.data as Parameters<typeof tikhubAdapter.execute>[0]["config"],
        sourceId: source.id,
        organizationId: orgId,
        runId,
        log: (level, message) => {
          if (level === "error") console.log(`    [${level}] ${message}`);
          // 写日志到 DB(fire-and-forget)
          db.insert(collectionLogs)
            .values({ runId, sourceId: source.id, level, message })
            .then(() => {})
            .catch(() => {});
        },
      });

      const writeResult = await writeItems({
        runId,
        sourceId: source.id,
        organizationId: orgId,
        items: result.items,
        source: {
          targetModules: source.targetModules,
          defaultCategory: source.defaultCategory,
          defaultTags: source.defaultTags,
          outletId: source.outletId,
          defaultOutletTier: source.defaultOutletTier,
          defaultOutletRegion: source.defaultOutletRegion,
        },
        runMetadata: result.runMetadata,
      });

      const cost = (result.runMetadata?.tikhubCostUsd as number) ?? 0;
      totalInserted += writeResult.inserted;
      totalCost += cost;
      runOk++;

      const elapsed = Date.now() - t0;
      console.log(
        `  ✅ ${source.name.padEnd(36)} +${writeResult.inserted} items ($${cost.toFixed(3)}) ${elapsed}ms`,
      );

      await db
        .update(collectionRuns)
        .set({ finishedAt: new Date(), status: "success" })
        .where(eq(collectionRuns.id, runId));
      await db
        .update(collectionSources)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: "success",
          totalItemsCollected: sql`${collectionSources.totalItemsCollected} + ${writeResult.inserted}`,
          totalRuns: sql`${collectionSources.totalRuns} + 1`,
        })
        .where(eq(collectionSources.id, source.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      runFailed++;
      console.log(`  ❌ ${source.name.padEnd(36)} FAILED: ${msg.slice(0, 80)}`);
      await db
        .update(collectionRuns)
        .set({ finishedAt: new Date(), status: "failed", errorSummary: msg })
        .where(eq(collectionRuns.id, runId));
      await db
        .update(collectionSources)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: "failed",
          totalRuns: sql`${collectionSources.totalRuns} + 1`,
        })
        .where(eq(collectionSources.id, source.id));
    }
  }

  console.log(`\n━━━ 汇总 ━━━`);
  console.log(`成功:    ${runOk} / ${allSources.length}`);
  console.log(`失败:    ${runFailed}`);
  console.log(`总入库:  ${totalInserted} 条 collected_items`);
  console.log(`总花费:  $${totalCost.toFixed(3)} USD`);
  console.log(`\n下一步: 访问 http://localhost:3000/data-collection/content 看采集回的内容`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Bootstrap failed:", err);
  process.exit(1);
});
