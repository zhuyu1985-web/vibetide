import { db } from "@/db";
import {
  accountAnalyticsReports,
  accountDailySnapshots,
  viralContentAttributions,
  collectedItems,
  myAccounts,
  benchmarkAccounts,
  mediaOutletDictionary,
} from "@/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Channel } from "@/lib/media-outlet/channels";
import {
  GRANULARITY_WINDOW_DAYS,
  getSummaryCards,
  type Granularity,
  type MetricKey,
  type SummaryKey,
} from "@/lib/account-analytics/platform-meta";
import type { AigcContentCategory } from "@/lib/account-analytics/content-category";

/**
 * 判断某 outlet 是否已为指定平台填好识别符（secUid/uid/userId/ghid/domain）。
 * 给 listAnalyzableAccounts 用，决定 UI 是否显示"点此配置识别符"按钮。
 */
function outletHasPlatformIdentifier(
  channels: Channel[] | null | undefined,
  platform: string,
): boolean {
  if (!channels) return false;
  for (const ch of channels) {
    if (ch.type !== platform) continue;
    switch (ch.type) {
      case "douyin":
        return !!ch.secUid;
      case "weibo":
        return !!ch.uid;
      case "kuaishou":
        return !!ch.userId;
      case "wechat_oa":
        return !!ch.ghid;
      case "website":
        return !!ch.domain;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccountSource = "my" | "benchmark";

export interface AnalyzableAccountRow {
  id: string;
  source: AccountSource;
  name: string;
  handle: string;
  platform: string;
  level?: string;
  region?: string;
  avatarUrl?: string | null;
  isEnabled: boolean;
  latestReportAt?: string | null;
  daysWithData?: number;
  /** Phase 3：是否被 cron 自动抓取 */
  crawlCronEnabled?: boolean;
  /** Phase 3：上次自动抓取时间（ISO 字符串） */
  lastCrawledAt?: string | null;
  /** Phase 3：是否已绑定 outlet（决定 cron 能否生效） */
  hasOutletBinding?: boolean;
  /** Phase 3：outlet.channels[type=平台] 是否已填好识别符（决定 cron 是否能真抓） */
  hasIdentifier?: boolean;
}

export interface DailyTrendPoint {
  date: string;
  posts: number;
  compositeScore: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
}

export interface ReportSummary {
  id: string;
  accountId: string;
  accountName: string;
  /** 账号头像（来自 my_accounts/benchmark_accounts.avatarUrl，可空） */
  accountAvatarUrl?: string | null;
  platform: string;
  reportType: "daily" | "weekly" | "monthly" | "custom";
  periodStart: string;
  periodEnd: string;
  status: "pending" | "crawling" | "scoring" | "analyzing" | "ready" | "failed";
  kpis: {
    videos: number;
    likes: number;
    comments: number;
    favorites: number;
    shares: number;
  };
  executiveSummary: string | null;
  generatedAt: string | null;
}

export interface ViralAttributionView {
  id: string;
  rank: number;
  collectedItemId: string;
  title: string;
  publishedAt: string | null;
  compositeScore: number;
  metrics: {
    likes: number;
    comments: number;
    favorites: number;
    shares: number;
    views?: number;
  };
  primaryTags: string[];
  secondaryTags: string[];
  whyViralSummary: string;
  attributionMarkdown: string;
}

export interface PatternRow {
  dimension: string;
  rule: string;
}

export interface RecommendationRow {
  title: string;
  body: string;
}

export interface FullDataRow {
  collectedItemId: string;
  rank: number;
  title: string;
  likes: number;
  comments: number;
  favorites: number;
  shares: number;
  compositeScore: number;
  isTop5: boolean;
}

export interface PeriodOverview {
  /** 每日发布量（按 published date 升序） */
  dailyPosts: Array<{ date: string; count: number }>;
  /** Top 10 综合得分排行榜（按平台对应的公式） */
  top10: Array<{
    rank: number;
    collectedItemId: string;
    title: string;
    likes: number;
    comments: number;
    views: number;
    favorites: number;
    shares: number;
    score: number;
  }>;
  /** 公式描述（UI 显示用） */
  formulaLabel: string;
  /** Top10 表格列开关（按 platform） */
  showViews: boolean;
  showFavoritesAndShares: boolean;
  /** 周期统计 footer */
  stats: {
    totalCount: number;
    top10AvgLikes: number;
    top10AvgComments: number;
    top10AvgViews: number;
    top10AvgFavorites: number;
    top10AvgShares: number;
    restCount: number;
    restAvgLikes: number;
    restAvgComments: number;
    restAvgViews: number;
    restAvgFavorites: number;
    restAvgShares: number;
  };
  /** 周期段描述（如"5月10日 ~ 5月24日 / 共 15 天"） */
  periodLabel: string;
}

export interface AccountReportDetail {
  report: ReportSummary;
  topAttributions: ViralAttributionView[];
  patterns: PatternRow[];
  recommendations: RecommendationRow[];
  /** 完整数据首页（默认 20 条），后续翻页通过 Server Action loadReportFullDataPage 取 */
  fullData: FullDataRow[];
  /** 完整数据总条数（用于显示"已加载 X / 共 Y 条"） */
  fullDataTotal: number;
  /** 周期总览：每日发布量 + Top10 排行 + 均值 footer */
  periodOverview: PeriodOverview;
}

export interface AccountAnalyticsOverview {
  trend: DailyTrendPoint[];
  latestReport: ReportSummary | null;
  totals: {
    posts: number;
    compositeScore: number;
    likes: number;
    comments: number;
    shares: number;
    favorites: number;
  };
}

// ---------------------------------------------------------------------------
// Public DAL —— DB-only
// ---------------------------------------------------------------------------

export async function listAnalyzableAccounts(
  orgId: string,
  filter?: { source?: AccountSource | "both"; platform?: string },
): Promise<AnalyzableAccountRow[]> {
  // 用 dedupe map 防止同一 (source + platform + handle.lower()) 出现多张卡片
  const dedupe = new Map<string, AnalyzableAccountRow>();
  const keyOf = (a: { source: AccountSource; platform: string; handle: string }) =>
    `${a.source}::${a.platform.toLowerCase()}::${a.handle.toLowerCase()}`;

  // 真实 my_accounts
  if (filter?.source !== "benchmark") {
    try {
      const myRows = await db
        .select({
          id: myAccounts.id,
          name: myAccounts.name,
          handle: myAccounts.handle,
          platform: myAccounts.platform,
          avatarUrl: myAccounts.avatarUrl,
          isEnabled: myAccounts.isEnabled,
          crawlCronEnabled: myAccounts.crawlCronEnabled,
          lastCrawledAt: myAccounts.lastCrawledAt,
          outletId: myAccounts.outletId,
          outletChannels: mediaOutletDictionary.channels,
        })
        .from(myAccounts)
        .leftJoin(
          mediaOutletDictionary,
          eq(myAccounts.outletId, mediaOutletDictionary.id),
        )
        .where(eq(myAccounts.organizationId, orgId));
      for (const r of myRows) {
        if (filter?.platform && r.platform !== filter.platform) continue;
        const row: AnalyzableAccountRow = {
          id: r.id,
          name: r.name,
          handle: r.handle,
          platform: r.platform,
          avatarUrl: r.avatarUrl,
          isEnabled: r.isEnabled,
          source: "my",
          crawlCronEnabled: r.crawlCronEnabled,
          lastCrawledAt: r.lastCrawledAt?.toISOString() ?? null,
          hasOutletBinding: r.outletId !== null,
          hasIdentifier: outletHasPlatformIdentifier(
            r.outletChannels as Channel[] | null,
            r.platform,
          ),
        };
        const k = keyOf(row);
        if (!dedupe.has(k)) {
          dedupe.set(k, row);
        }
      }
    } catch (err) {
      console.warn("[account-analytics] my_accounts 查询失败:", err);
    }
  }

  // 真实 benchmark_accounts（org 范围内 + 全局预设）
  if (filter?.source !== "my") {
    try {
      const benchRows = await db
        .select({
          id: benchmarkAccounts.id,
          name: benchmarkAccounts.name,
          handle: benchmarkAccounts.handle,
          platform: benchmarkAccounts.platform,
          level: benchmarkAccounts.level,
          region: benchmarkAccounts.region,
          avatarUrl: benchmarkAccounts.avatarUrl,
          isEnabled: benchmarkAccounts.isEnabled,
          organizationId: benchmarkAccounts.organizationId,
          crawlCronEnabled: benchmarkAccounts.crawlCronEnabled,
          lastCrawledAt: benchmarkAccounts.lastCrawledAt,
          outletId: benchmarkAccounts.outletId,
          outletChannels: mediaOutletDictionary.channels,
        })
        .from(benchmarkAccounts)
        .leftJoin(
          mediaOutletDictionary,
          eq(benchmarkAccounts.outletId, mediaOutletDictionary.id),
        )
        .where(
          sql`${benchmarkAccounts.organizationId} = ${orgId} OR ${benchmarkAccounts.organizationId} IS NULL`,
        );
      for (const r of benchRows) {
        if (filter?.platform && r.platform !== filter.platform) continue;
        const row: AnalyzableAccountRow = {
          id: r.id,
          name: r.name,
          handle: r.handle,
          platform: r.platform,
          level: r.level,
          region: r.region ?? undefined,
          avatarUrl: r.avatarUrl,
          isEnabled: r.isEnabled,
          source: "benchmark",
          crawlCronEnabled: r.crawlCronEnabled,
          lastCrawledAt: r.lastCrawledAt?.toISOString() ?? null,
          hasOutletBinding: r.outletId !== null,
          hasIdentifier: outletHasPlatformIdentifier(
            r.outletChannels as Channel[] | null,
            r.platform,
          ),
        };
        const k = keyOf(row);
        if (!dedupe.has(k)) {
          dedupe.set(k, row);
        }
      }
    } catch (err) {
      console.warn("[account-analytics] benchmark_accounts 查询失败:", err);
    }
  }

  // 输出排序：先我方，再对标；同组内按平台分组再按名称
  const all = Array.from(dedupe.values());
  return all.sort((a, b) => {
    if (a.source !== b.source) return a.source === "my" ? -1 : 1;
    if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
}

export async function getAccountAnalyticsOverview(
  orgId: string,
  accountId: string,
  opts?: { windowDays?: number },
): Promise<AccountAnalyticsOverview> {
  const windowDays = opts?.windowDays ?? 7; // Phase 3 默认 7 天窗口

  // 真实 DB：account_daily_snapshots
  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - windowDays);
  const sinceDateStr = sinceDate.toISOString().slice(0, 10);

  let trendRows: Array<{
    date: string;
    posts: number;
    compositeScore: number;
    likes: number;
    comments: number;
    shares: number;
    favorites: number;
  }> = [];
  try {
    const rows = await db
      .select({
        date: accountDailySnapshots.snapshotDate,
        posts: accountDailySnapshots.postCount,
        compositeScore: accountDailySnapshots.compositeScoreTotal,
        likes: accountDailySnapshots.totalLikes,
        comments: accountDailySnapshots.totalComments,
        shares: accountDailySnapshots.totalShares,
        favorites: accountDailySnapshots.totalFavorites,
      })
      .from(accountDailySnapshots)
      .where(
        and(
          eq(accountDailySnapshots.organizationId, orgId),
          eq(accountDailySnapshots.accountId, accountId),
          gte(accountDailySnapshots.snapshotDate, sinceDateStr),
        ),
      )
      .orderBy(desc(accountDailySnapshots.snapshotDate));
    trendRows = rows;
  } catch (err) {
    console.warn("[account-analytics] account_daily_snapshots 查询失败:", err);
  }

  const trend = trendRows.reverse();

  const totals = trend.reduce(
    (acc, day) => ({
      posts: acc.posts + day.posts,
      compositeScore: acc.compositeScore + day.compositeScore,
      likes: acc.likes + day.likes,
      comments: acc.comments + day.comments,
      shares: acc.shares + day.shares,
      favorites: acc.favorites + day.favorites,
    }),
    { posts: 0, compositeScore: 0, likes: 0, comments: 0, shares: 0, favorites: 0 },
  );

  const latestReport = (await listReportsForAccount(orgId, accountId, { limit: 1 }))[0] ?? null;

  return { trend, latestReport, totals };
}

export async function listReportsForAccount(
  orgId: string,
  accountId: string,
  opts?: { reportType?: "daily" | "weekly" | "monthly" | "custom"; limit?: number },
): Promise<ReportSummary[]> {
  const limit = opts?.limit ?? 30;

  try {
    const rows = await db
      .select()
      .from(accountAnalyticsReports)
      .where(
        and(
          eq(accountAnalyticsReports.organizationId, orgId),
          eq(accountAnalyticsReports.accountId, accountId),
          opts?.reportType
            ? eq(accountAnalyticsReports.reportType, opts.reportType)
            : sql`true`,
        ),
      )
      .orderBy(desc(accountAnalyticsReports.periodStart))
      .limit(limit);

    if (rows.length === 0) return [];

    return rows.map(reportRowToSummary);
  } catch (err) {
    console.warn("[account-analytics] reports 查询失败:", err);
    return [];
  }
}

/** 首页加载条数（与 loadReportFullDataPage 默认 limit 保持一致） */
export const DEFAULT_FULL_DATA_PAGE_SIZE = 20;

/**
 * 综合得分公式 —— 按 platform 动态选择，因为抖音 web 接口不返回 play_count。
 *
 * - douyin: 点赞×1 + 评论×3 + 收藏×2 + 转发×1.5  （无 plays）
 * - kuaishou / bilibili / weibo (web): 点赞×1 + 评论×3 + 播放×0.01
 * - 其他: 与 douyin 同公式
 */
export function getScoreFormula(platform: string): {
  label: string;
  /** UI 是否展示"播放"列（抖音 false） */
  showViews: boolean;
  /** UI 是否展示"收藏/转发"列（抖音 true） */
  showFavoritesAndShares: boolean;
  jsCompute: (m: {
    likes: number;
    comments: number;
    views: number;
    favorites: number;
    shares: number;
  }) => number;
} {
  if (platform === "kuaishou" || platform === "bilibili") {
    return {
      label: "综合得分 = 点赞×1 + 评论×3 + 播放×0.01",
      showViews: true,
      showFavoritesAndShares: false,
      jsCompute: (m) => Math.round(m.likes + m.comments * 3 + m.views * 0.01),
    };
  }
  // 抖音默认（无 plays，用 favorites + shares 补足）
  return {
    label: "综合得分 = 点赞×1 + 评论×3 + 收藏×2 + 转发×1.5",
    showViews: false,
    showFavoritesAndShares: true,
    jsCompute: (m) => Math.round(m.likes + m.comments * 3 + m.favorites * 2 + m.shares * 1.5),
  };
}

/** SQL 端的"新公式"表达式 —— 与 getScoreFormula 对齐，用于 DB ORDER BY */
function newScoreExprFor(platform: string) {
  if (platform === "kuaishou" || platform === "bilibili") {
    return sql<number>`(${collectedItems.likeCount} + ${collectedItems.commentCount} * 3 + ${collectedItems.viewCount} * 0.01)`;
  }
  return sql<number>`(${collectedItems.likeCount} + ${collectedItems.commentCount} * 3 + ${collectedItems.favoriteCount} * 2 + ${collectedItems.shareCount} * 1.5)`;
}

/** 把"5月10日 ~ 5月24日 / 共 15 天"这种区间标签算出来 */
function formatPeriodLabel(periodStart: string, periodEnd: string): string {
  const fmt = (s: string) => {
    const [, m, d] = s.split("-");
    return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
  };
  if (periodStart === periodEnd) return `${fmt(periodStart)}（单日）`;
  const start = new Date(`${periodStart}T00:00:00+08:00`);
  const end = new Date(`${periodEnd}T00:00:00+08:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return `${fmt(periodStart)} ~ ${fmt(periodEnd)} / 共 ${days} 天`;
}

/** 从全量轻量 items 算 periodOverview（每日发布量 + Top10 + 均值 footer） */
function buildPeriodOverview(args: {
  items: Array<{
    id: string;
    title: string;
    publishedAt: Date | null;
    likeCount: number;
    commentCount: number;
    viewCount: number;
    favoriteCount: number;
    shareCount: number;
  }>;
  periodStart: string;
  periodEnd: string;
  platform: string;
}): PeriodOverview {
  const { items, periodStart, periodEnd, platform } = args;
  const formula = getScoreFormula(platform);

  // 每日发布量（补齐区间内每一天，没数据的天显示 0）
  // 注意：toISOString() 返回的是 UTC 切片，必须 +8h 才能对齐 Asia/Shanghai 业务日
  const toSh = (d: Date): string =>
    new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  const dateCount = new Map<string, number>();
  for (const i of items) {
    if (!i.publishedAt) continue;
    const dateStr = toSh(i.publishedAt);
    dateCount.set(dateStr, (dateCount.get(dateStr) ?? 0) + 1);
  }
  const dailyPosts: Array<{ date: string; count: number }> = [];
  // 用纯字符串比较推日期，避免 UTC 漂移
  let cursor = periodStart;
  while (cursor <= periodEnd) {
    dailyPosts.push({ date: cursor, count: dateCount.get(cursor) ?? 0 });
    // 推进一天（Asia/Shanghai 中午 12:00 +24h 一定不会跨天）
    const next = new Date(`${cursor}T12:00:00+08:00`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = toSh(next);
  }

  // Top 10（按平台公式重新排序，避免 SQL 排序与公式不一致）
  const scored = items
    .map((i) => ({
      ...i,
      score: formula.jsCompute({
        likes: i.likeCount,
        comments: i.commentCount,
        views: i.viewCount,
        favorites: i.favoriteCount,
        shares: i.shareCount,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const top10 = scored.slice(0, 10).map((i, idx) => ({
    rank: idx + 1,
    collectedItemId: i.id,
    title: i.title,
    likes: i.likeCount,
    comments: i.commentCount,
    views: i.viewCount,
    favorites: i.favoriteCount,
    shares: i.shareCount,
    score: i.score,
  }));

  // 均值 footer
  const top10Items = scored.slice(0, 10);
  const restItems = scored.slice(10);
  const avg = (
    arr: typeof scored,
    key: "likeCount" | "commentCount" | "viewCount" | "favoriteCount" | "shareCount",
  ) =>
    arr.length === 0
      ? 0
      : Math.round(arr.reduce((s, i) => s + i[key], 0) / arr.length);

  return {
    dailyPosts,
    top10,
    formulaLabel: formula.label,
    showViews: formula.showViews,
    showFavoritesAndShares: formula.showFavoritesAndShares,
    periodLabel: formatPeriodLabel(periodStart, periodEnd),
    stats: {
      totalCount: items.length,
      top10AvgLikes: avg(top10Items, "likeCount"),
      top10AvgComments: avg(top10Items, "commentCount"),
      top10AvgViews: avg(top10Items, "viewCount"),
      top10AvgFavorites: avg(top10Items, "favoriteCount"),
      top10AvgShares: avg(top10Items, "shareCount"),
      restCount: restItems.length,
      restAvgLikes: avg(restItems, "likeCount"),
      restAvgComments: avg(restItems, "commentCount"),
      restAvgViews: avg(restItems, "viewCount"),
      restAvgFavorites: avg(restItems, "favoriteCount"),
      restAvgShares: avg(restItems, "shareCount"),
    },
  };
}

/**
 * 取报告所属账号的 handle + avatarUrl（用于反查 collected_items + 渲染头像）。
 * 兼容 my_accounts 与 benchmark_accounts。
 */
async function getAccountMetaForReport(
  accountId: string,
  source: AccountSource,
): Promise<{ handle: string | null; avatarUrl: string | null }> {
  try {
    if (source === "my") {
      const row = await db.query.myAccounts.findFirst({
        where: eq(myAccounts.id, accountId),
        columns: { handle: true, avatarUrl: true },
      });
      return {
        handle: row?.handle ?? null,
        avatarUrl: row?.avatarUrl ?? null,
      };
    }
    const row = await db.query.benchmarkAccounts.findFirst({
      where: eq(benchmarkAccounts.id, accountId),
      columns: { handle: true, avatarUrl: true },
    });
    return {
      handle: row?.handle ?? null,
      avatarUrl: row?.avatarUrl ?? null,
    };
  } catch (err) {
    console.warn("[account-analytics] 反查账号 meta 失败:", err);
    return { handle: null, avatarUrl: null };
  }
}

/**
 * 构造 collected_items 的"账号+区间"筛选条件 —— Top N 与 fullData 都靠它。
 * 注意：collected_items.account_handle 在 TikHub Account 模式下被写成 secUid（mapper 设的），
 * 我们 seed 脚本会把它对齐到 my_accounts.handle (例如 'BRTV_news')；
 * 同时也用 account_id（secUid）做兜底，覆盖 mapper 写入但脚本没对齐的情况。
 */
function buildItemsWhere(args: {
  orgId: string;
  platform: string;
  handle: string;
  periodStart: string;
  periodEnd: string;
}) {
  const start = new Date(`${args.periodStart}T00:00:00+08:00`);
  const endExclusive = new Date(`${args.periodEnd}T00:00:00+08:00`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return and(
    eq(collectedItems.organizationId, args.orgId),
    eq(collectedItems.platform, args.platform),
    sql`${collectedItems.accountHandle} = ${args.handle}`,
    sql`${collectedItems.publishedAt} >= ${start.toISOString()} AND ${collectedItems.publishedAt} < ${endExclusive.toISOString()}`,
  );
}

export async function getAccountReportDetail(
  orgId: string,
  reportId: string,
): Promise<AccountReportDetail | null> {
  try {
    const report = await db.query.accountAnalyticsReports.findFirst({
      where: and(
        eq(accountAnalyticsReports.id, reportId),
        eq(accountAnalyticsReports.organizationId, orgId),
      ),
    });
    if (!report) return null;

    const { handle, avatarUrl } = await getAccountMetaForReport(
      report.accountId,
      report.accountSource,
    );

    const itemsWhere = handle
      ? buildItemsWhere({
          orgId,
          platform: report.platform,
          handle,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
        })
      : null;

    // 综合得分 SQL 表达式 —— 按平台动态选（抖音用收藏/转发，快手用播放）
    const newScoreExpr = newScoreExprFor(report.platform);
    const formula = getScoreFormula(report.platform);

    const [attrRows, firstPage, totalRow, allItems] = await Promise.all([
      // Top N attributions（左 join 拿真实 metrics 而不是 0）
      db
        .select({
          attr: viralContentAttributions,
          itemTitle: collectedItems.title,
          itemPublishedAt: collectedItems.publishedAt,
          itemLikes: collectedItems.likeCount,
          itemComments: collectedItems.commentCount,
          itemFavorites: collectedItems.favoriteCount,
          itemShares: collectedItems.shareCount,
          itemViews: collectedItems.viewCount,
        })
        .from(viralContentAttributions)
        .leftJoin(
          collectedItems,
          eq(viralContentAttributions.collectedItemId, collectedItems.id),
        )
        .where(eq(viralContentAttributions.reportId, reportId))
        .orderBy(viralContentAttributions.rank),

      // 首页 fullData（20 条），按新公式得分降序
      itemsWhere
        ? db
            .select({
              id: collectedItems.id,
              title: collectedItems.title,
              likeCount: collectedItems.likeCount,
              commentCount: collectedItems.commentCount,
              shareCount: collectedItems.shareCount,
              favoriteCount: collectedItems.favoriteCount,
              viewCount: collectedItems.viewCount,
              compositeScore: collectedItems.compositeScore,
            })
            .from(collectedItems)
            .where(itemsWhere)
            .orderBy(desc(newScoreExpr))
            .limit(DEFAULT_FULL_DATA_PAGE_SIZE)
        : Promise.resolve([] as Array<{
            id: string;
            title: string;
            likeCount: number;
            commentCount: number;
            shareCount: number;
            favoriteCount: number;
            viewCount: number;
            compositeScore: number;
          }>),

      // total count
      itemsWhere
        ? db
            .select({ c: sql<number>`count(*)::int` })
            .from(collectedItems)
            .where(itemsWhere)
        : Promise.resolve([{ c: 0 }]),

      // 周期总览所需的全量轻量数据（最多 500 条，足够算 dailyPosts + Top10 + 均值）
      itemsWhere
        ? db
            .select({
              id: collectedItems.id,
              title: collectedItems.title,
              publishedAt: collectedItems.publishedAt,
              likeCount: collectedItems.likeCount,
              commentCount: collectedItems.commentCount,
              viewCount: collectedItems.viewCount,
              favoriteCount: collectedItems.favoriteCount,
              shareCount: collectedItems.shareCount,
            })
            .from(collectedItems)
            .where(itemsWhere)
            .orderBy(desc(newScoreExpr))
            .limit(500)
        : Promise.resolve(
            [] as Array<{
              id: string;
              title: string;
              publishedAt: Date | null;
              likeCount: number;
              commentCount: number;
              viewCount: number;
              favoriteCount: number;
              shareCount: number;
            }>,
          ),
    ]);

    const topPostIdSet = new Set<string>(report.topPostIds);
    const fullDataTotal = totalRow[0]?.c ?? 0;

    const periodOverview = buildPeriodOverview({
      items: allItems,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      platform: report.platform,
    });

    return {
      report: { ...reportRowToSummary(report), accountAvatarUrl: avatarUrl },
      topAttributions: attrRows.map(
        ({
          attr,
          itemTitle,
          itemPublishedAt,
          itemLikes,
          itemComments,
          itemFavorites,
          itemShares,
          itemViews,
        }) => ({
          id: attr.id,
          rank: attr.rank,
          collectedItemId: attr.collectedItemId,
          title: itemTitle ?? "(原内容已删除)",
          publishedAt: itemPublishedAt?.toISOString() ?? null,
          compositeScore: attr.compositeScore,
          metrics: {
            likes: itemLikes ?? 0,
            comments: itemComments ?? 0,
            favorites: itemFavorites ?? 0,
            shares: itemShares ?? 0,
            views: itemViews ?? undefined,
          },
          primaryTags: attr.primaryTags,
          secondaryTags: attr.secondaryTags,
          whyViralSummary: attr.whyViralSummary,
          attributionMarkdown: attr.attributionMarkdown,
        }),
      ),
      patterns: report.patterns,
      recommendations: report.recommendations,
      fullData: firstPage.map((r, idx) => ({
        collectedItemId: r.id,
        rank: idx + 1,
        title: r.title,
        likes: r.likeCount,
        comments: r.commentCount,
        favorites: r.favoriteCount,
        shares: r.shareCount,
        compositeScore: formula.jsCompute({
          likes: r.likeCount,
          comments: r.commentCount,
          views: r.viewCount,
          favorites: r.favoriteCount,
          shares: r.shareCount,
        }),
        isTop5: topPostIdSet.has(r.id),
      })),
      fullDataTotal,
      periodOverview,
    };
  } catch (err) {
    console.warn("[account-analytics] report detail 查询失败:", err);
    return null;
  }
}

/**
 * 翻页拉取完整数据 —— 由客户端"加载更多"按钮 / 触底自动加载调用。
 */
export async function getAccountReportFullDataPage(
  orgId: string,
  reportId: string,
  opts: { offset: number; limit?: number },
): Promise<{ rows: FullDataRow[]; total: number; hasMore: boolean }> {
  const limit = Math.min(opts.limit ?? DEFAULT_FULL_DATA_PAGE_SIZE, 100);
  const offset = Math.max(opts.offset, 0);

  try {
    const report = await db.query.accountAnalyticsReports.findFirst({
      where: and(
        eq(accountAnalyticsReports.id, reportId),
        eq(accountAnalyticsReports.organizationId, orgId),
      ),
    });
    if (!report) return { rows: [], total: 0, hasMore: false };

    const { handle } = await getAccountMetaForReport(
      report.accountId,
      report.accountSource,
    );
    if (!handle) return { rows: [], total: 0, hasMore: false };

    const where = buildItemsWhere({
      orgId,
      platform: report.platform,
      handle,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
    });

    const newScoreExpr = newScoreExprFor(report.platform);
    const formula = getScoreFormula(report.platform);

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: collectedItems.id,
          title: collectedItems.title,
          likeCount: collectedItems.likeCount,
          commentCount: collectedItems.commentCount,
          shareCount: collectedItems.shareCount,
          favoriteCount: collectedItems.favoriteCount,
          viewCount: collectedItems.viewCount,
        })
        .from(collectedItems)
        .where(where)
        .orderBy(desc(newScoreExpr))
        .limit(limit)
        .offset(offset),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(collectedItems)
        .where(where),
    ]);

    const topPostIdSet = new Set<string>(report.topPostIds);
    const total = totalRow[0]?.c ?? 0;
    return {
      rows: rows.map((r, idx) => ({
        collectedItemId: r.id,
        rank: offset + idx + 1,
        title: r.title,
        likes: r.likeCount,
        comments: r.commentCount,
        favorites: r.favoriteCount,
        shares: r.shareCount,
        compositeScore: formula.jsCompute({
          likes: r.likeCount,
          comments: r.commentCount,
          views: r.viewCount,
          favorites: r.favoriteCount,
          shares: r.shareCount,
        }),
        isTop5: topPostIdSet.has(r.id),
      })),
      total,
      hasMore: offset + rows.length < total,
    };
  } catch (err) {
    console.warn("[account-analytics] fullData page 查询失败:", err);
    return { rows: [], total: 0, hasMore: false };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reportRowToSummary(row: typeof accountAnalyticsReports.$inferSelect): ReportSummary {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.accountNameSnapshot,
    platform: row.platform,
    reportType: row.reportType,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    status: row.status,
    kpis: row.kpis,
    executiveSummary: row.executiveSummary,
    generatedAt: row.generatedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// getMetricSeries — 按粒度（day/week/month）聚合单个指标的时间序列
// ---------------------------------------------------------------------------
// 给 Tab1 数据分析模块的趋势卡片用：用户选 metric + granularity → 序列。
// Spec §7.4：day=7d，week=12w(84d)，month=6mo(180d)。
//
// 安全性：metric / granularity 均通过白名单 lookup 后才 sql.raw，
// 杜绝 SQL 注入；window 用参数化数字带类型转 INTERVAL。

/** snapshot 列名白名单，按 MetricKey 映射；杜绝 sql.raw 注入。 */
const METRIC_COLUMN_MAP: Record<MetricKey, string> = {
  likes: "total_likes",
  comments: "total_comments",
  shares: "total_shares",
  favorites: "total_favorites",
  views: "total_views",
  compositeScore: "composite_score_total",
};

/** DATE_TRUNC 单位白名单 */
const TRUNC_UNIT_MAP: Record<Granularity, string> = {
  day: "day",
  week: "week",
  month: "month",
};

export async function getMetricSeries(opts: {
  orgId: string;
  accountId: string;
  granularity: Granularity;
  metric: MetricKey;
}): Promise<Array<{ bucket: string; value: number }>> {
  const { orgId, accountId, granularity, metric } = opts;
  const column = METRIC_COLUMN_MAP[metric];
  if (!column) throw new Error(`Unknown metric: ${metric}`);
  const truncUnit = TRUNC_UNIT_MAP[granularity];
  if (!truncUnit) throw new Error(`Unknown granularity: ${granularity}`);
  const windowDays = GRANULARITY_WINDOW_DAYS[granularity];

  // truncUnit 已通过白名单校验；直接 sql.raw 内嵌成字面量，
  // 避免 Postgres 把同名 parameter 视为两个不同表达式导致
  // "must appear in GROUP BY" 错误。
  const rows = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('${sql.raw(truncUnit)}', snapshot_date), 'YYYY-MM-DD') AS bucket,
      COALESCE(SUM(${sql.raw(column)}), 0)::float AS value
    FROM account_daily_snapshots
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND snapshot_date >= CURRENT_DATE - (${windowDays}::int * INTERVAL '1 day')
    GROUP BY DATE_TRUNC('${sql.raw(truncUnit)}', snapshot_date)
    ORDER BY bucket ASC
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    bucket: String(r.bucket),
    value: Number(r.value ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// getPublishActivity — 发布柱状图（按粒度）+ 平台特定 6 列数字带
// ---------------------------------------------------------------------------
// 给 Tab1 数据分析模块的"发布活跃度"卡片用。
//
// 关键决策：不在 DAL 里查 platform。page.tsx 已经加载了 account 对象（含 platform），
// 上层传入更简单，也避免 my_accounts/benchmark_accounts 跨表 JOIN
// （两表在 topic-compare-v2.ts，namespace 拆分会导致类型问题）。

export async function getPublishActivity(opts: {
  orgId: string;
  accountId: string;
  /** 平台 slug；由上层传入，决定数字带的 6 列子集 */
  platform: string;
  granularity: Granularity;
}): Promise<{
  buckets: Array<{ bucket: string; publishCount: number }>;
  summary: Partial<Record<SummaryKey, number>>;
}> {
  const { orgId, accountId, platform, granularity } = opts;
  const truncUnit = TRUNC_UNIT_MAP[granularity];
  if (!truncUnit) throw new Error(`Unknown granularity: ${granularity}`);
  const windowDays = GRANULARITY_WINDOW_DAYS[granularity];
  const cards = getSummaryCards(platform);

  // 发布柱状图（按粒度 bucket 聚合 post_count）
  const bucketRows = (await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('${sql.raw(truncUnit)}', snapshot_date), 'YYYY-MM-DD') AS bucket,
      COALESCE(SUM(post_count), 0)::int AS publish_count
    FROM account_daily_snapshots
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND snapshot_date >= CURRENT_DATE - (${windowDays}::int * INTERVAL '1 day')
    GROUP BY DATE_TRUNC('${sql.raw(truncUnit)}', snapshot_date)
    ORDER BY bucket ASC
  `)) as unknown as Array<Record<string, unknown>>;

  // 数字带 —— 一次性查 10 列（SUM/MAX/AVG），按 platform 子集挑出 6 列。
  // SQL 列名与 SummaryKey 的 snake_case 形式一一对应。
  const sumRows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(post_count), 0)::int AS publish_count,
      COALESCE(SUM(total_likes), 0)::bigint AS total_likes,
      COALESCE(SUM(total_comments), 0)::bigint AS total_comments,
      COALESCE(SUM(total_shares), 0)::bigint AS total_shares,
      COALESCE(SUM(total_favorites), 0)::bigint AS total_favorites,
      COALESCE(SUM(total_views), 0)::bigint AS total_views,
      COALESCE(MAX(total_likes), 0)::int AS max_likes,
      COALESCE(MAX(total_views), 0)::int AS max_views,
      COALESCE(AVG(NULLIF(total_likes, 0)), 0)::int AS avg_likes,
      COALESCE(AVG(NULLIF(total_views, 0)), 0)::int AS avg_views
    FROM account_daily_snapshots
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND snapshot_date >= CURRENT_DATE - (${windowDays}::int * INTERVAL '1 day')
  `)) as unknown as Array<Record<string, unknown>>;
  const sumRow = sumRows[0] ?? {};

  const summary: Partial<Record<SummaryKey, number>> = {};
  for (const key of cards) {
    // SummaryKey (camelCase) -> SQL column (snake_case)
    const sqlKey = key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
    summary[key] = Number(sumRow[sqlKey] ?? 0);
  }

  return {
    buckets: bucketRows.map((r) => ({
      bucket: String(r.bucket),
      publishCount: Number(r.publish_count ?? 0),
    })),
    summary,
  };
}

// ---------------------------------------------------------------------------
// getRecentTopPosts — 近 30 天 TOP N 帖子（mode=hot/latest）
// ---------------------------------------------------------------------------
// 给 Tab1 数据分析模块的"近期 TOP 帖子"卡片用：
//   - mode=hot   → ORDER BY composite_score DESC
//   - mode=latest → ORDER BY published_at DESC
//
// 字段 alias 约定：
//   - schema 真实字段 coverImageUrl → 输出 thumbnail（保持上层组件契约稳定）
//   - schema 真实字段 canonicalUrl  → 输出 sourceUrl

export async function getRecentTopPosts(opts: {
  orgId: string;
  accountId: string;
  mode: "hot" | "latest";
  limit?: number;
}): Promise<
  Array<{
    id: string;
    title: string;
    summary: string | null;
    thumbnail: string | null;
    score: number;
    viewCount: number;
    commentCount: number;
    likeCount: number;
    publishedAt: string; // ISO
    sourceUrl: string;
  }>
> {
  const { orgId, accountId, mode, limit = 5 } = opts;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const orderClause =
    mode === "hot"
      ? desc(collectedItems.compositeScore)
      : desc(collectedItems.publishedAt);

  const rows = await db
    .select({
      id: collectedItems.id,
      title: collectedItems.title,
      summary: collectedItems.summary,
      coverImageUrl: collectedItems.coverImageUrl,
      score: collectedItems.compositeScore,
      viewCount: collectedItems.viewCount,
      commentCount: collectedItems.commentCount,
      likeCount: collectedItems.likeCount,
      publishedAt: collectedItems.publishedAt,
      canonicalUrl: collectedItems.canonicalUrl,
    })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, orgId),
        eq(collectedItems.accountId, accountId),
        gte(collectedItems.publishedAt, thirtyDaysAgo),
      ),
    )
    .orderBy(orderClause)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? "(无标题)",
    summary: r.summary,
    thumbnail: r.coverImageUrl, // alias: coverImageUrl → thumbnail
    score: Number(r.score ?? 0),
    viewCount: r.viewCount ?? 0,
    commentCount: r.commentCount ?? 0,
    likeCount: r.likeCount ?? 0,
    publishedAt: r.publishedAt?.toISOString() ?? "",
    sourceUrl: r.canonicalUrl ?? "", // alias: canonicalUrl → sourceUrl
  }));
}

// ---------------------------------------------------------------------------
// getCategoryDistribution — AIGC 分类分布（区块 C 左：横向条形图）
// ---------------------------------------------------------------------------
// 给 Tab1 数据分析模块 区块 C 用：
//   - buckets: 按 aigc_content_category 聚合的近 30 天发文计数
//   - annotatedRatio: 已标注 / 全部（决定是否还在 zero state）
//
// 安全性：所有参数走 tagged template 绑定，无 sql.raw 注入面。

export async function getCategoryDistribution(opts: {
  orgId: string;
  accountId: string;
}): Promise<{
  buckets: Array<{ category: AigcContentCategory; count: number }>;
  annotatedRatio: number;
}> {
  const { orgId, accountId } = opts;

  const rows = (await db.execute(sql`
    SELECT
      aigc_content_category AS category,
      COUNT(*)::int AS count
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND published_at >= NOW() - INTERVAL '30 days'
      AND aigc_content_category IS NOT NULL
    GROUP BY aigc_content_category
    ORDER BY count DESC
  `)) as unknown as Array<Record<string, unknown>>;

  const ratioRows = (await db.execute(sql`
    SELECT
      COALESCE(
        SUM(CASE WHEN aigc_annotated_at IS NOT NULL THEN 1 ELSE 0 END)::float
        / NULLIF(COUNT(*), 0),
        0
      ) AS ratio
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND published_at >= NOW() - INTERVAL '30 days'
  `)) as unknown as Array<Record<string, unknown>>;
  const ratioRow = ratioRows[0] ?? {};

  return {
    buckets: rows.map((r) => ({
      category: r.category as AigcContentCategory,
      count: Number(r.count ?? 0),
    })),
    annotatedRatio: Number(ratioRow.ratio ?? 0),
  };
}

// ---------------------------------------------------------------------------
// getKeywordCloud — AIGC 关键词云（区块 C 右：d3-cloud）
// ---------------------------------------------------------------------------
// 给 Tab1 数据分析模块 区块 C 用：
//   - words: 按 aigc_keywords[] 展开 (LATERAL jsonb_array_elements_text) 后
//            聚合 weight = COUNT(*)，取 Top 30
//   - annotatedRatio: 已标注 / 全部（决定是否还在 zero state）
//
// 窗口：7d / 30d 两档（与区块 A/B 不同；词云需更长窗口才有足量样本）。

export async function getKeywordCloud(opts: {
  orgId: string;
  accountId: string;
  range: "7d" | "30d";
}): Promise<{
  words: Array<{ keyword: string; weight: number }>;
  annotatedRatio: number;
}> {
  const { orgId, accountId, range } = opts;
  const days = range === "7d" ? 7 : 30;

  const rows = (await db.execute(sql`
    SELECT
      kw AS keyword,
      COUNT(*)::int AS weight
    FROM collected_items,
         LATERAL jsonb_array_elements_text(aigc_keywords) AS kw
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND published_at >= NOW() - (${days}::int * INTERVAL '1 day')
      AND aigc_keywords IS NOT NULL
    GROUP BY kw
    ORDER BY weight DESC
    LIMIT 30
  `)) as unknown as Array<Record<string, unknown>>;

  const ratioRows = (await db.execute(sql`
    SELECT COALESCE(
      SUM(CASE WHEN aigc_annotated_at IS NOT NULL THEN 1 ELSE 0 END)::float
      / NULLIF(COUNT(*), 0),
      0
    ) AS ratio
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND account_id = ${accountId}
      AND published_at >= NOW() - (${days}::int * INTERVAL '1 day')
  `)) as unknown as Array<Record<string, unknown>>;
  const ratioRow = ratioRows[0] ?? {};

  return {
    words: rows.map((r) => ({
      keyword: String(r.keyword),
      weight: Number(r.weight ?? 0),
    })),
    annotatedRatio: Number(ratioRow.ratio ?? 0),
  };
}
