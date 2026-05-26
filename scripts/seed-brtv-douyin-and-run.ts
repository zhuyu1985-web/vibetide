/**
 * 一次性脚本：BRTV 抖音真实数据 → 走完整 Account Analytics 管线
 *
 *   1. 在 media_outlet_dictionary 写一条 BRTV 媒体（含 douyin channel + secUid）
 *   2. 创建/启用一条专为 BRTV 抖音的 tikhub collection_source
 *   3. 直接调 tikhub adapter 拉取 BRTV_news 抖音视频
 *   4. writeItems 落 collected_items
 *   5. SQL UPDATE 把 account_handle 改成 my_accounts.handle ('BRTV_news') 以便 join
 *   6. 计算 account_daily_snapshots（最近 30 天）
 *   7. 创建 account_analytics_reports 行
 *   8. 跑 LLM viral attribution × Top 5
 *   9. 跑 distill patterns + recommendations
 *  10. 写 viral_content_attributions，更新报告 status=ready
 *  11. 打印报告访问 URL
 *
 * 用法：
 *   npx tsx scripts/seed-brtv-douyin-and-run.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db";
import {
  collectedItems,
  collectionRuns,
  collectionSources,
  mediaOutletDictionary,
  myAccounts,
  accountAnalyticsReports,
  viralContentAttributions,
} from "@/db/schema";
import { and, eq, gte, sql, desc } from "drizzle-orm";
import { getAdapter } from "@/lib/collection/registry";
import { writeItems } from "@/lib/collection/writer";
import "@/lib/collection/adapters"; // 注册 adapter
import type { Channel } from "@/lib/media-outlet/channels";
import {
  analyzeViralContent,
  distillPatternsAndTips,
} from "@/lib/account-analytics/viral-attributor";
import {
  calculateCompositeScore,
  DEFAULT_COMPOSITE_SCORE_WEIGHTS,
} from "@/lib/account-analytics/composite-score";

// ─── 常量 ───────────────────────────────────────────────────────────
const BRTV_SEC_UID =
  "MS4wLjABAAAAQbUw3qMFrqOY-5ARsb9XRHu1OkvVIzsozQtwxWA5TgE";
const BRTV_NICKNAME = "BRTV 新闻";
const ORG_ID = "a0000000-0000-4000-8000-000000000001";
const TARGET_HANDLE = "BRTV_news"; // 跟 my_accounts.handle 对齐

async function main() {
  console.log("\n=== Step 1: 确保 BRTV 在 media_outlet_dictionary ===");
  const outletId = await ensureOutlet();
  console.log(`outlet_id = ${outletId}`);

  console.log("\n=== Step 2: 创建/启用 BRTV 专属 tikhub source ===");
  const sourceId = await ensureSource(outletId);
  console.log(`source_id = ${sourceId}`);

  console.log("\n=== Step 3: 调 tikhub adapter 抓 BRTV 抖音视频 ===");
  const { itemsCount, runId } = await runCrawl(sourceId);
  console.log(`抓到 ${itemsCount} 条新视频，run_id = ${runId}`);

  console.log("\n=== Step 4: 把 account_handle 改成 my_accounts 对齐值 ===");
  const updatedRows = await alignAccountHandle(sourceId);
  console.log(`UPDATE collected_items SET account_handle='${TARGET_HANDLE}' → ${updatedRows} 行`);

  console.log("\n=== Step 5: 取 BRTV my_accounts 行 ===");
  const myAccount = await db.query.myAccounts.findFirst({
    where: and(
      eq(myAccounts.organizationId, ORG_ID),
      eq(myAccounts.platform, "douyin"),
      eq(myAccounts.handle, TARGET_HANDLE),
    ),
  });
  if (!myAccount) throw new Error(`my_accounts 找不到 douyin/${TARGET_HANDLE}`);
  console.log(`my_account.id = ${myAccount.id}, name = ${myAccount.name}`);

  console.log("\n=== Step 6: 跑 Phase 2 报告管线 ===");
  const { reportId, periodStart, periodEnd } = await runReportPipeline(myAccount.id);

  console.log("\n=== ✅ 完成 ===");
  console.log(`📊 报告：http://localhost:3000/account-analytics/${myAccount.id}/reports/${reportId}`);
  console.log(`📅 区间：${periodStart} ~ ${periodEnd}`);
  console.log(`👤 账号：${myAccount.name} (@${myAccount.handle}, ${myAccount.platform})`);
  process.exit(0);
}

// ─── 工具：upsert outlet ────────────────────────────────────────────
async function ensureOutlet(): Promise<string> {
  const existing = await db
    .select({ id: mediaOutletDictionary.id, channels: mediaOutletDictionary.channels })
    .from(mediaOutletDictionary)
    .where(
      and(
        eq(mediaOutletDictionary.organizationId, ORG_ID),
        eq(mediaOutletDictionary.outletName, BRTV_NICKNAME),
      ),
    )
    .limit(1);

  const channels: Channel[] = [
    {
      type: "douyin",
      nickname: BRTV_NICKNAME,
      secUid: BRTV_SEC_UID,
      profileUrl: `https://www.douyin.com/user/${BRTV_SEC_UID}`,
    },
  ];

  if (existing[0]) {
    // 已存在：合并 channels
    const merged = mergeChannels(
      (existing[0].channels ?? []) as Channel[],
      channels,
    );
    await db
      .update(mediaOutletDictionary)
      .set({ channels: merged, updatedAt: new Date() })
      .where(eq(mediaOutletDictionary.id, existing[0].id));
    return existing[0].id;
  }

  const [row] = await db
    .insert(mediaOutletDictionary)
    .values({
      organizationId: ORG_ID,
      outletName: BRTV_NICKNAME,
      outletTier: "provincial",
      outletRegion: "北京",
      isActive: true,
      channels,
    })
    .returning({ id: mediaOutletDictionary.id });
  return row.id;
}

function mergeChannels(existing: Channel[], incoming: Channel[]): Channel[] {
  const map = new Map<string, Channel>();
  for (const c of existing) map.set(c.type, c);
  for (const c of incoming) map.set(c.type, c); // 同类型覆盖
  return Array.from(map.values());
}

// ─── 工具：upsert source ───────────────────────────────────────────
async function ensureSource(outletId: string): Promise<string> {
  const existing = await db
    .select({ id: collectionSources.id })
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, ORG_ID),
        eq(collectionSources.name, "BRTV 抖音 · 账号分析专用"),
      ),
    )
    .limit(1);

  const cfg = {
    mode: "account" as const,
    outletIds: [outletId],
    accountPlatforms: ["douyin" as const],
    maxPagesPerRun: 5, // 多抓几页拿到更多历史日期数据（之前 1 页只能拿到当天的 20 条）
    resultsPerPage: 20,
    monthlyBudgetUsd: 2,
  };

  if (existing[0]) {
    await db
      .update(collectionSources)
      .set({ enabled: true, config: cfg, updatedAt: new Date() })
      .where(eq(collectionSources.id, existing[0].id));
    return existing[0].id;
  }

  const [row] = await db
    .insert(collectionSources)
    .values({
      organizationId: ORG_ID,
      sourceType: "tikhub",
      name: "BRTV 抖音 · 账号分析专用",
      enabled: true,
      config: cfg,
      targetModules: ["hot_topics"],
    })
    .returning({ id: collectionSources.id });
  return row.id;
}

// ─── 工具：直接调 adapter 抓取 ────────────────────────────────────
async function runCrawl(sourceId: string): Promise<{ itemsCount: number; runId: string }> {
  const [sourceRow] = await db
    .select()
    .from(collectionSources)
    .where(eq(collectionSources.id, sourceId))
    .limit(1);
  if (!sourceRow) throw new Error("source 消失了");

  const adapter = getAdapter("tikhub");
  const parsed = adapter.configSchema.safeParse(sourceRow.config);
  if (!parsed.success) {
    throw new Error(`config 校验失败: ${parsed.error.message}`);
  }

  const [run] = await db
    .insert(collectionRuns)
    .values({
      sourceId,
      organizationId: ORG_ID,
      trigger: "manual",
      startedAt: new Date(),
      status: "running",
    })
    .returning({ id: collectionRuns.id });
  const runId = run.id;

  try {
    const result = await adapter.execute({
      config: parsed.data,
      sourceId,
      organizationId: ORG_ID,
      runId,
      log: (lvl, msg) => console.log(`  [tikhub/${lvl}] ${msg}`),
    });

    const writeResult = await writeItems({
      runId,
      sourceId,
      organizationId: ORG_ID,
      items: result.items,
      source: {
        targetModules: sourceRow.targetModules ?? ["hot_topics"],
        defaultCategory: sourceRow.defaultCategory ?? null,
        defaultTags: sourceRow.defaultTags ?? [],
        outletId: null,
      },
      runMetadata: result.runMetadata,
    });

    await db
      .update(collectionRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        itemsInserted: writeResult.inserted,
        itemsMerged: writeResult.merged,
        itemsFailed: writeResult.failed,
      })
      .where(eq(collectionRuns.id, runId));

    return { itemsCount: writeResult.inserted, runId };
  } catch (err) {
    await db
      .update(collectionRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorSummary: err instanceof Error ? err.message : String(err),
      })
      .where(eq(collectionRuns.id, runId));
    throw err;
  }
}

// ─── 工具：把 account_handle 对齐到 my_accounts ─────────────────
async function alignAccountHandle(sourceId: string): Promise<number> {
  const result = await db.execute(sql`
    UPDATE collected_items
    SET account_handle = ${TARGET_HANDLE}
    WHERE first_seen_source_id = ${sourceId}
      AND platform = 'douyin'
      AND raw_metadata->>'sec_uid' = ${BRTV_SEC_UID}
  `);
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}

// ─── 工具：跑 Phase 2 报告管线（不走 Inngest，inline）──────────
async function runReportPipeline(myAccountId: string): Promise<{
  reportId: string;
  periodStart: string;
  periodEnd: string;
}> {
  // 先用一个保险窗口（28 天）查数据，再根据实际跨度收敛 periodStart/periodEnd
  const now = new Date();
  const windowStart = new Date(now.getTime() - 28 * 24 * 3600 * 1000);

  const items = await db
    .select({
      id: collectedItems.id,
      title: collectedItems.title,
      summary: collectedItems.summary,
      publishedAt: collectedItems.publishedAt,
      likeCount: collectedItems.likeCount,
      commentCount: collectedItems.commentCount,
      shareCount: collectedItems.shareCount,
      viewCount: collectedItems.viewCount,
      favoriteCount: collectedItems.favoriteCount,
    })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, ORG_ID),
        eq(collectedItems.platform, "douyin"),
        eq(collectedItems.accountHandle, TARGET_HANDLE),
        gte(collectedItems.publishedAt, windowStart),
      ),
    )
    .orderBy(desc(collectedItems.publishedAt))
    .limit(200);

  if (items.length === 0) {
    throw new Error("没有可用数据 — 检查 TikHub 是否返回了内容");
  }

  // 根据 items 的真实 publishedAt 跨度自动选 periodStart/periodEnd + reportType
  const shanghaiDateStr = (d: Date) =>
    new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const dates = items
    .map((i) => i.publishedAt)
    .filter((d): d is Date => d !== null)
    .map(shanghaiDateStr);
  const uniqueDates = Array.from(new Set(dates)).sort();
  const periodStart = uniqueDates[0] ?? shanghaiDateStr(now);
  const periodEnd = uniqueDates[uniqueDates.length - 1] ?? shanghaiDateStr(now);
  const spanDays =
    Math.round(
      (new Date(`${periodEnd}T00:00:00+08:00`).getTime() -
        new Date(`${periodStart}T00:00:00+08:00`).getTime()) /
        86_400_000,
    ) + 1;
  const reportType: "daily" | "weekly" | "monthly" | "custom" =
    spanDays === 1
      ? "daily"
      : spanDays <= 7
        ? "weekly"
        : spanDays <= 31
          ? "monthly"
          : "custom";

  console.log(
    `  BRTV 抖音 ${items.length} 条，跨 ${uniqueDates.length} 天 (${periodStart} ~ ${periodEnd}, 共 ${spanDays} 天) → reportType=${reportType}`,
  );

  // 计算综合得分并排序
  const scored = items.map((i) => ({
    ...i,
    publishedAtIso: i.publishedAt?.toISOString() ?? null,
    compositeScore: calculateCompositeScore(
      {
        likes: i.likeCount,
        comments: i.commentCount,
        shares: i.shareCount,
        favorites: i.favoriteCount,
        views: i.viewCount,
      },
      DEFAULT_COMPOSITE_SCORE_WEIGHTS,
    ),
  }));
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  // 把每条的 composite_score 也写回 collected_items（按需）
  await Promise.all(
    scored.map((s) =>
      db
        .update(collectedItems)
        .set({ compositeScore: s.compositeScore })
        .where(eq(collectedItems.id, s.id)),
    ),
  );

  const topN = scored.slice(0, 10); // 全 Top 10 都跑 AI 归因，对齐 UI Chapter 2
  const totalKpis = scored.reduce(
    (acc, i) => ({
      videos: acc.videos + 1,
      likes: acc.likes + i.likeCount,
      comments: acc.comments + i.commentCount,
      favorites: acc.favorites + i.favoriteCount,
      shares: acc.shares + i.shareCount,
    }),
    { videos: 0, likes: 0, comments: 0, favorites: 0, shares: 0 },
  );

  // 创建/更新报告行
  const [report] = await db
    .insert(accountAnalyticsReports)
    .values({
      organizationId: ORG_ID,
      accountId: myAccountId,
      accountSource: "my",
      accountNameSnapshot: BRTV_NICKNAME,
      platform: "douyin",
      reportType,
      periodStart,
      periodEnd,
      status: "analyzing",
      kpis: totalKpis,
      topPostIds: topN.map((i) => i.id),
      compositeScoreFormulaSnapshot: DEFAULT_COMPOSITE_SCORE_WEIGHTS,
    })
    .onConflictDoUpdate({
      target: [
        accountAnalyticsReports.organizationId,
        accountAnalyticsReports.accountId,
        accountAnalyticsReports.periodStart,
        accountAnalyticsReports.periodEnd,
        accountAnalyticsReports.reportType,
      ],
      set: {
        status: "analyzing",
        kpis: totalKpis,
        topPostIds: topN.map((i) => i.id),
        errorMessage: null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: accountAnalyticsReports.id });

  // 并行跑 viral attribution
  console.log(`  调 LLM 分析 Top ${topN.length} 条...`);
  const peers = scored.map((s) => ({
    title: s.title,
    likes: s.likeCount,
    comments: s.commentCount,
    favorites: s.favoriteCount,
    shares: s.shareCount,
    views: s.viewCount,
    compositeScore: s.compositeScore,
  }));

  const attributions: Array<{
    rank: number;
    collectedItemId: string;
    title: string;
    compositeScore: number;
    whyViralSummary: string;
    primaryTags: string[];
    secondaryTags: string[];
    attributionMarkdown: string;
    dimensionBreakdown: {
      topicScore: number;
      emotionScore: number;
      structureScore: number;
      timingScore: number;
      interactionScore: number;
    };
  }> = [];
  for (const [idx, item] of topN.entries()) {
    const rank = idx + 1;
    process.stdout.write(`    Top ${rank}: ${item.title.slice(0, 28)}...`);
    const t0 = Date.now();
    const res = await analyzeViralContent({
      item: {
        title: item.title,
        summary: item.summary ?? undefined,
        publishedAt: item.publishedAtIso,
        likes: item.likeCount,
        comments: item.commentCount,
        favorites: item.favoriteCount,
        shares: item.shareCount,
        views: item.viewCount,
        compositeScore: item.compositeScore,
      },
      accountContext: {
        name: BRTV_NICKNAME,
        platform: "douyin",
        tier: "provincial",
        region: "北京",
      },
      peerItems: peers,
    });
    console.log(`  ✓ ${Date.now() - t0}ms tags=[${res.primaryTags.join(",")}]`);
    attributions.push({
      rank,
      collectedItemId: item.id,
      title: item.title,
      compositeScore: item.compositeScore,
      ...res,
    });
  }

  // 蒸馏 patterns + recommendations
  console.log("  调 LLM 蒸馏共性规律 + 运营建议...");
  const t1 = Date.now();
  const distilled = await distillPatternsAndTips({
    attributions: attributions.map((a) => ({
      title: a.title,
      whyViralSummary: a.whyViralSummary,
      primaryTags: a.primaryTags,
      secondaryTags: a.secondaryTags,
      attributionMarkdown: a.attributionMarkdown,
      dimensionBreakdown: a.dimensionBreakdown,
    })),
    accountContext: {
      name: BRTV_NICKNAME,
      platform: "douyin",
      tier: "provincial",
      region: "北京",
    },
    periodLabel: `${periodStart} ~ ${periodEnd}`,
    totalKpis,
  });
  console.log(`    ✓ ${Date.now() - t1}ms patterns=${distilled.patterns.length} tips=${distilled.recommendations.length}`);

  // 写 attributions（替换式）
  await db
    .delete(viralContentAttributions)
    .where(eq(viralContentAttributions.reportId, report.id));
  await db.insert(viralContentAttributions).values(
    attributions.map((a) => ({
      reportId: report.id,
      collectedItemId: a.collectedItemId,
      rank: a.rank,
      compositeScore: a.compositeScore,
      primaryTags: a.primaryTags,
      secondaryTags: a.secondaryTags,
      whyViralSummary: a.whyViralSummary,
      attributionMarkdown: a.attributionMarkdown,
      dimensionBreakdown: a.dimensionBreakdown,
      aiPromptVersion: "v1",
    })),
  );

  // 更新报告状态
  await db
    .update(accountAnalyticsReports)
    .set({
      status: "ready",
      patterns: distilled.patterns,
      recommendations: distilled.recommendations,
      executiveSummary: distilled.executiveSummary,
      generatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(accountAnalyticsReports.id, report.id));

  return { reportId: report.id, periodStart, periodEnd };
}

main().catch((err) => {
  console.error("\n❌ 失败:", err);
  process.exit(1);
});
