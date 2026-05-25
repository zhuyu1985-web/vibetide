import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  myAccounts,
  benchmarkAccounts,
  accountAnalyticsReports,
  viralContentAttributions,
  collectedItems,
} from "@/db/schema";
import { and, eq, gte, lt, sql, desc } from "drizzle-orm";
import {
  analyzeViralContent,
  distillPatternsAndTips,
  type ViralAttribution,
} from "@/lib/account-analytics/viral-attributor";
import { DEFAULT_COMPOSITE_SCORE_WEIGHTS } from "@/lib/account-analytics/composite-score";

const TOP_N_FOR_DAILY = 10;
const TOP_N_FOR_WEEKLY = 10;
const PEER_BASELINE_LIMIT = 20;

/**
 * 报告生成器 —— 由 cron 派发或 Server Action 手动派发。
 *
 * 步骤：
 *   1. 解析账号信息 + 选择 Top N
 *   2. 创建/更新 reports 行（status=analyzing）
 *   3. 并行 LLM 跑每条 viral attribution
 *   4. LLM 二次调用蒸馏 patterns + recommendations + executiveSummary
 *   5. 写 viral_content_attributions + 更新 reports.status=ready
 */
export const accountAnalyticsReportGenerator = inngest.createFunction(
  {
    id: "account-analytics-report-generator",
    name: "Account Analytics · 报告生成器",
    concurrency: { limit: 3 },
    retries: 2,
  },
  { event: "account-analytics/daily-report.requested" },
  async ({ event, step }) => {
    const {
      organizationId,
      accountId,
      accountSource,
      periodStart,
      periodEnd,
      reportType,
      forceRefresh,
    } = event.data;

    const topN = reportType === "weekly" ? TOP_N_FOR_WEEKLY : TOP_N_FOR_DAILY;

    // Step 1：解析账号信息 + 选择 Top N
    const ctx = await step.run("load-context", async () => {
      const accountRow =
        accountSource === "my"
          ? await db.query.myAccounts.findFirst({
              where: eq(myAccounts.id, accountId),
            })
          : await db.query.benchmarkAccounts.findFirst({
              where: eq(benchmarkAccounts.id, accountId),
            });

      if (!accountRow) {
        throw new Error(`account ${accountId} (${accountSource}) not found`);
      }

      // 拉区间内 collected_items（按平台 + 账号 handle 匹配）
      const start = new Date(`${periodStart}T00:00:00+08:00`);
      const endExclusive = new Date(`${periodEnd}T00:00:00+08:00`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

      // 匹配规则与 daily-snapshot 保持一致(三条 OR,最后一条 outletId 是 account 模式
      // 下唯一稳定的桥 — weibo/douyin adapter 把平台 uid 写到 account_id/account_handle,
      // 跟 my_accounts.id (UUID) / my_accounts.handle (业务短 ID) 都对不上)
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
          compositeScore: collectedItems.compositeScore,
        })
        .from(collectedItems)
        .where(
          and(
            eq(collectedItems.organizationId, organizationId),
            eq(collectedItems.platform, accountRow.platform),
            accountRow.outletId
              ? sql`(
                  ${collectedItems.accountHandle} = ${accountRow.handle}
                  OR ${collectedItems.accountId} = ${accountId}
                  OR ${collectedItems.outletId} = ${accountRow.outletId}
                )`
              : sql`(
                  ${collectedItems.accountHandle} = ${accountRow.handle}
                  OR ${collectedItems.accountId} = ${accountId}
                )`,
            gte(collectedItems.publishedAt, start),
            lt(collectedItems.publishedAt, endExclusive),
          ),
        )
        .orderBy(desc(collectedItems.compositeScore))
        .limit(PEER_BASELINE_LIMIT);

      return {
        account: {
          id: accountRow.id,
          name: accountRow.name,
          handle: accountRow.handle,
          platform: accountRow.platform,
          tier:
            "level" in accountRow
              ? (accountRow as { level: string }).level
              : undefined,
          region:
            "region" in accountRow
              ? ((accountRow as { region: string | null }).region ?? undefined)
              : undefined,
        },
        items: items.map((i) => ({
          collectedItemId: i.id,
          title: i.title,
          summary: i.summary,
          publishedAt: i.publishedAt?.toISOString() ?? null,
          likes: i.likeCount,
          comments: i.commentCount,
          shares: i.shareCount,
          views: i.viewCount,
          favorites: i.favoriteCount,
          compositeScore: i.compositeScore,
        })),
      };
    });

    if (ctx.items.length === 0) {
      return { skipped: "no_items_in_period", periodStart, periodEnd };
    }

    const topItems = ctx.items.slice(0, topN);
    const peerItems = ctx.items;

    const totalKpis = ctx.items.reduce(
      (acc, i) => ({
        videos: acc.videos + 1,
        likes: acc.likes + i.likes,
        comments: acc.comments + i.comments,
        favorites: acc.favorites + i.favorites,
        shares: acc.shares + i.shares,
      }),
      { videos: 0, likes: 0, comments: 0, favorites: 0, shares: 0 },
    );

    // Step 2：upsert reports 行（status=analyzing）
    const reportId = await step.run("upsert-report-row", async () => {
      const accountName = ctx.account.name;
      const platform = ctx.account.platform;
      const [row] = await db
        .insert(accountAnalyticsReports)
        .values({
          organizationId,
          accountId,
          accountSource,
          accountNameSnapshot: accountName,
          platform,
          reportType,
          periodStart,
          periodEnd,
          status: "analyzing",
          kpis: totalKpis,
          topPostIds: topItems.map((i) => i.collectedItemId),
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
            topPostIds: topItems.map((i) => i.collectedItemId),
            errorMessage: null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: accountAnalyticsReports.id });
      return row.id;
    });

    // 已存在且未要求 forceRefresh 时跳过
    if (!forceRefresh) {
      const existing = await step.run("check-existing-ready", async () => {
        const r = await db.query.accountAnalyticsReports.findFirst({
          where: eq(accountAnalyticsReports.id, reportId),
        });
        return r?.status === "ready" && (r.generatedAt?.getTime() ?? 0) > Date.now() - 30 * 60 * 1000;
      });
      if (existing) {
        return { skipped: "ready_within_30min", reportId };
      }
    }

    // Step 3：并行跑每条 viral attribution
    type AttrPlus = ViralAttribution & {
      title: string;
      collectedItemId: string;
      rank: number;
      compositeScore: number;
      metrics: {
        likes: number;
        comments: number;
        shares: number;
        favorites: number;
        views?: number;
      };
    };
    const attributions: AttrPlus[] = [];
    for (const [idx, item] of topItems.entries()) {
      const rank = idx + 1;
      const attr = await step.run(
        `analyze-viral-${rank}`,
        async (): Promise<AttrPlus> => {
          const res = await analyzeViralContent({
            item: {
              title: item.title,
              summary: item.summary ?? undefined,
              publishedAt: item.publishedAt,
              likes: item.likes,
              comments: item.comments,
              favorites: item.favorites,
              shares: item.shares,
              views: item.views,
              compositeScore: item.compositeScore,
            },
            accountContext: {
              name: ctx.account.name,
              platform: ctx.account.platform,
              tier: ctx.account.tier,
              region: ctx.account.region,
            },
            peerItems: peerItems.map((p) => ({
              title: p.title,
              likes: p.likes,
              comments: p.comments,
              favorites: p.favorites,
              shares: p.shares,
              views: p.views,
              compositeScore: p.compositeScore,
            })),
          });
          return {
            ...res,
            title: item.title,
            collectedItemId: item.collectedItemId,
            rank,
            compositeScore: item.compositeScore,
            metrics: {
              likes: item.likes,
              comments: item.comments,
              favorites: item.favorites,
              shares: item.shares,
              views: item.views,
            },
          };
        },
      );
      attributions.push(attr);
    }

    // Step 4：蒸馏 patterns + recommendations + executiveSummary
    const distilled = await step.run("distill-patterns-tips", async () => {
      return distillPatternsAndTips({
        attributions: attributions.map((a) => ({
          title: a.title,
          whyViralSummary: a.whyViralSummary,
          primaryTags: a.primaryTags,
          secondaryTags: a.secondaryTags,
          attributionMarkdown: a.attributionMarkdown,
          dimensionBreakdown: a.dimensionBreakdown,
        })),
        accountContext: {
          name: ctx.account.name,
          platform: ctx.account.platform,
          tier: ctx.account.tier,
          region: ctx.account.region,
        },
        periodLabel:
          periodStart === periodEnd ? periodStart : `${periodStart} ~ ${periodEnd}`,
        totalKpis,
      });
    });

    // Step 5：写 viral_content_attributions + 更新 reports
    await step.run("persist-attributions", async () => {
      // 删除老的（如果是 forceRefresh 重算）
      await db
        .delete(viralContentAttributions)
        .where(eq(viralContentAttributions.reportId, reportId));

      await db.insert(viralContentAttributions).values(
        attributions.map((a) => ({
          reportId,
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
    });

    await step.run("finalize-report", async () => {
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
        .where(eq(accountAnalyticsReports.id, reportId));
    });

    return {
      reportId,
      attributionCount: attributions.length,
      patternCount: distilled.patterns.length,
      recommendationCount: distilled.recommendations.length,
    };
  },
);

/**
 * 仅重跑指定报告的 LLM 归因（不重新抓 collected_items），通过派发 daily-report.requested 复用同一管线。
 */
export const accountAnalyticsReportReanalyze = inngest.createFunction(
  {
    id: "account-analytics-report-reanalyze",
    name: "Account Analytics · 仅重跑归因",
    concurrency: { limit: 3 },
    retries: 1,
  },
  { event: "account-analytics/report.reanalyze" },
  async ({ event, step }) => {
    const { organizationId, reportId } = event.data;

    const report = await step.run("load-report", async () => {
      return db.query.accountAnalyticsReports.findFirst({
        where: and(
          eq(accountAnalyticsReports.id, reportId),
          eq(accountAnalyticsReports.organizationId, organizationId),
        ),
      });
    });

    if (!report) {
      return { skipped: "report_not_found" };
    }

    await step.sendEvent("dispatch-regen", {
      name: "account-analytics/daily-report.requested",
      data: {
        organizationId,
        accountId: report.accountId,
        accountSource: report.accountSource,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        reportType: report.reportType,
        forceRefresh: true,
      },
    });

    return { dispatched: true, reportId };
  },
);
