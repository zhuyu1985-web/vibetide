/**
 * Audit account_daily_snapshots 实际指标覆盖
 *
 * 用途：Task 0.1 of `docs/superpowers/plans/2026-05-24-account-analytics-tab1-redesign-plan.md`
 *
 * 流程：
 *   1) 先查 account_daily_snapshots 最近 30 天 5 个指标的非零比例；
 *   2) 如果该表为空（当前本地/远程都是空表，设计期表），fallback 到 collected_items —
 *      collected_items 是 snapshots 的上游数据源（snapshots 本质 = collected_items 按
 *      account/day 聚合），含完全相同的 5 个指标字段（like_count/comment_count/
 *      share_count/favorite_count/view_count）和 platform 列，66k+ 条真实采集数据。
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/audit-snapshots-coverage.ts
 *
 * 阈值规则：< 0.5 的指标视为"该平台该指标无数据" → PLATFORM_METRIC_MATRIX 标 false
 */

import { db } from "../src/db";
import { sql } from "drizzle-orm";

interface CoverageRow {
  platform: string | null;
  count: string | number;
  likes_coverage: string | number;
  comments_coverage: string | number;
  shares_coverage: string | number;
  favorites_coverage: string | number;
  views_coverage: string | number;
}

const METRICS: Array<{ key: keyof CoverageRow; label: string }> = [
  { key: "likes_coverage", label: "likes" },
  { key: "comments_coverage", label: "comments" },
  { key: "shares_coverage", label: "shares" },
  { key: "favorites_coverage", label: "favorites" },
  { key: "views_coverage", label: "views" },
];

function printResults(
  source: string,
  rows: CoverageRow[],
  threshold = 0.5,
): void {
  console.log(`\n=== Coverage 表（数据源：${source}）===\n`);
  console.table(
    rows.map((r) => ({
      platform: r.platform ?? "(unmatched)",
      count: Number(r.count),
      likes: Number(r.likes_coverage).toFixed(4),
      comments: Number(r.comments_coverage).toFixed(4),
      shares: Number(r.shares_coverage).toFixed(4),
      favorites: Number(r.favorites_coverage).toFixed(4),
      views: Number(r.views_coverage).toFixed(4),
    })),
  );

  console.log("\n=== Markdown 表格（复制到 plan 附录 A）===\n");
  console.log(
    "| platform | count | likes | comments | shares | favorites | views |",
  );
  console.log(
    "|----------|-------|-------|----------|--------|-----------|-------|",
  );
  for (const r of rows) {
    console.log(
      `| ${r.platform ?? "(unmatched)"} | ${Number(r.count)} | ${Number(
        r.likes_coverage,
      ).toFixed(4)} | ${Number(r.comments_coverage).toFixed(4)} | ${Number(
        r.shares_coverage,
      ).toFixed(4)} | ${Number(r.favorites_coverage).toFixed(4)} | ${Number(
        r.views_coverage,
      ).toFixed(4)} |`,
    );
  }

  console.log(`\n=== 结论：metric < ${threshold} 的平台-指标组合 ===\n`);
  for (const r of rows) {
    const lowMetrics = METRICS.filter((m) => Number(r[m.key]) < threshold);
    const platform = r.platform ?? "(unmatched)";
    if (lowMetrics.length === 0) {
      console.log(`- ${platform}: 全指标 >= ${threshold}`);
    } else {
      console.log(
        `- ${platform}: 以下指标 < ${threshold} -> ${lowMetrics
          .map((m) => `${m.label}=${Number(r[m.key]).toFixed(2)}`)
          .join(", ")}`,
      );
    }
  }
}

(async () => {
  try {
    // 1) 主查询：account_daily_snapshots（plan 期望的目标）
    console.log(
      "=== Step 1: 检查 account_daily_snapshots 最近 30 天数据 ===\n",
    );
    const snapshotRowCheck = (await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM account_daily_snapshots
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
    `)) as unknown as Array<{ cnt: number }>;
    const snapshotCount = Number(snapshotRowCheck[0]?.cnt ?? 0);
    console.log(`account_daily_snapshots 最近 30 天行数：${snapshotCount}`);

    if (snapshotCount > 0) {
      const rows = (await db.execute(sql`
        SELECT
          platform,
          COUNT(*) AS count,
          AVG(CASE WHEN total_likes > 0 THEN 1 ELSE 0 END)::numeric(10,4) AS likes_coverage,
          AVG(CASE WHEN total_comments > 0 THEN 1 ELSE 0 END)::numeric(10,4) AS comments_coverage,
          AVG(CASE WHEN total_shares > 0 THEN 1 ELSE 0 END)::numeric(10,4) AS shares_coverage,
          AVG(CASE WHEN total_favorites > 0 THEN 1 ELSE 0 END)::numeric(10,4) AS favorites_coverage,
          AVG(CASE WHEN total_views > 0 THEN 1 ELSE 0 END)::numeric(10,4) AS views_coverage
        FROM account_daily_snapshots
        WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY platform
        ORDER BY count DESC
      `)) as unknown as CoverageRow[];
      printResults("account_daily_snapshots (最近 30 天)", rows);
      process.exit(0);
    }

    // 2) Fallback：collected_items 是 snapshots 的上游数据源
    //    snapshots 本质 = collected_items 按 organization/account/day 聚合
    //    指标字段一一对应：
    //      collected_items.like_count     → snapshots.total_likes
    //      collected_items.comment_count  → snapshots.total_comments
    //      collected_items.share_count    → snapshots.total_shares
    //      collected_items.favorite_count → snapshots.total_favorites
    //      collected_items.view_count     → snapshots.total_views
    console.log(
      "\nFallback: account_daily_snapshots 表当前为空（设计期表，本地未填充）。",
    );
    console.log(
      "改用上游 collected_items 做等效 audit，指标字段一一对应：",
    );
    console.log(
      "  like_count → total_likes / comment_count → total_comments / share_count → total_shares",
    );
    console.log(
      "  favorite_count → total_favorites / view_count → total_views\n",
    );

    // 先看全表（无日期限制），因为最近 30 天数据很少
    console.log("=== Step 2a: collected_items 全表（含历史） ===");
    const itemsAll = (await db.execute(sql`
      SELECT
        COALESCE(platform, '(null)') AS platform,
        COUNT(*) AS count,
        AVG(CASE WHEN like_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS likes_coverage,
        AVG(CASE WHEN comment_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS comments_coverage,
        AVG(CASE WHEN share_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS shares_coverage,
        AVG(CASE WHEN favorite_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS favorites_coverage,
        AVG(CASE WHEN view_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS views_coverage
      FROM collected_items
      GROUP BY platform
      ORDER BY count DESC
    `)) as unknown as CoverageRow[];
    printResults("collected_items（全表，无日期限制）", itemsAll);

    console.log("\n\n=== Step 2b: collected_items 最近 30 天 ===");
    const items30 = (await db.execute(sql`
      SELECT
        COALESCE(platform, '(null)') AS platform,
        COUNT(*) AS count,
        AVG(CASE WHEN like_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS likes_coverage,
        AVG(CASE WHEN comment_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS comments_coverage,
        AVG(CASE WHEN share_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS shares_coverage,
        AVG(CASE WHEN favorite_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS favorites_coverage,
        AVG(CASE WHEN view_count > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS views_coverage
      FROM collected_items
      WHERE published_at >= NOW() - INTERVAL '30 days'
      GROUP BY platform
      ORDER BY count DESC
    `)) as unknown as CoverageRow[];
    printResults("collected_items（最近 30 天）", items30);

    // 3) 最权威的 proxy：benchmark_posts + my_post_distributions
    //    这两表是按账号粒度采集的真实互动数据（snapshots 的另一个上游），
    //    platform 通过 join 账号表来自英文 slug，与 PLATFORM_METRIC_MATRIX 命名空间一致。
    //    缺点：没有 favorite_count 字段（schema 里只有 4 个指标）。
    console.log("\n\n=== Step 3: account-grain proxy（按账号采集的 posts）===");
    console.log(
      "数据源：benchmark_posts JOIN benchmark_accounts + my_post_distributions JOIN my_accounts",
    );
    console.log(
      "注意：这俩表没有 favorite_count 字段，favorites_coverage 列固定为 NULL",
    );
    const accountGrain = (await db.execute(sql`
      WITH unified AS (
        SELECT ba.platform, bp.likes, bp.comments, bp.shares, bp.views, NULL::integer AS favorites
        FROM benchmark_posts bp
        JOIN benchmark_accounts ba ON bp.benchmark_account_id = ba.id
        UNION ALL
        SELECT ma.platform, d.likes, d.comments, d.shares, d.views, NULL::integer AS favorites
        FROM my_post_distributions d
        JOIN my_accounts ma ON d.my_account_id = ma.id
      )
      SELECT
        platform,
        COUNT(*) AS count,
        AVG(CASE WHEN likes > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS likes_coverage,
        AVG(CASE WHEN comments > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS comments_coverage,
        AVG(CASE WHEN shares > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS shares_coverage,
        AVG(CASE WHEN favorites > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS favorites_coverage,
        AVG(CASE WHEN views > 0 THEN 1.0 ELSE 0 END)::numeric(10,4) AS views_coverage
      FROM unified
      GROUP BY platform
      ORDER BY count DESC
    `)) as unknown as CoverageRow[];
    printResults(
      "account-grain proxy: benchmark_posts + my_post_distributions",
      accountGrain,
    );

    process.exit(0);
  } catch (e) {
    console.error("ERROR:", e);
    process.exit(1);
  }
})();
