/**
 * 一次性回填脚本：修复 weibo adapter 历史 bug 导致的 collected_items 顶级字段缺失。
 *
 * Bug 背景：
 *   旧版 weibo adapter (src/lib/collection/adapters/tikhub/platforms/weibo.ts)
 *   把所有指标塞 raw_metadata，没填 RawItem 顶级字段。结果 collected_items 的
 *   platform / external_id / account_id / like_count / comment_count / share_count
 *   全都是 NULL/0，导致 daily-snapshot 完全聚合不到数据 → 详情页全 0。
 *
 * 同时修：
 *   - collection_sources.outlet_id 顶级列回填（ensureTikHubAccountSource 漏写）
 *
 * 用法：
 *   npx tsx scripts/backfill-weibo-collected-items.ts
 *   或：node -r dotenv/config --import tsx scripts/backfill-weibo-collected-items.ts dotenv_config_path=.env.local
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

function cleanUrl(raw: string): string {
  return raw.replace(/[?&]directConnection=true/i, "").replace(/\?$/, "");
}

async function main() {
  const dburl = process.env.DATABASE_URL;
  if (!dburl) {
    console.error("缺少 DATABASE_URL");
    process.exit(1);
  }
  const sql = postgres(cleanUrl(dburl), { prepare: false });

  try {
    // 1. 把 account-mode source 的 outletId 列从 config.outletIds[0] 回填
    const sourceFix = await sql`
      UPDATE collection_sources
      SET outlet_id = (config->'outletIds'->>0)::uuid,
          updated_at = NOW()
      WHERE source_type = 'tikhub'
        AND outlet_id IS NULL
        AND (config->>'mode') = 'account'
        AND jsonb_array_length(config->'outletIds') > 0
      RETURNING id, name
    `;
    console.log(`[1/3] 回填 collection_sources.outlet_id: ${sourceFix.length} 行`);
    for (const r of sourceFix) console.log("  -", r.name);

    // 2. 把 weibo collected_items 的顶级字段从 raw_metadata 回填
    //    通过 first_seen_source_id 反查到 source 拿到 outlet_id
    //    兼容两种 rawMetadata schema:
    //      keyword 模式(platforms/weibo.ts):mblog_id / author_id
    //      account  模式(account-mappers.ts):mblogid / mid / uid
    const itemFix = await sql`
      UPDATE collected_items ci
      SET platform = COALESCE(ci.platform, 'weibo'),
          external_id = COALESCE(
            ci.external_id,
            ci.raw_metadata->>'mblog_id',
            ci.raw_metadata->>'mblogid',
            ci.raw_metadata->>'mid'
          ),
          author = COALESCE(ci.author, ci.raw_metadata->>'author'),
          account_id = COALESCE(
            ci.account_id,
            ci.raw_metadata->>'author_id',
            ci.raw_metadata->>'uid'
          ),
          account_handle = COALESCE(
            ci.account_handle,
            ci.raw_metadata->>'author_id',
            ci.raw_metadata->>'uid'
          ),
          outlet_id = COALESCE(ci.outlet_id, cs.outlet_id),
          like_count = GREATEST(ci.like_count, COALESCE((ci.raw_metadata->>'likes')::int, 0)),
          comment_count = GREATEST(ci.comment_count, COALESCE((ci.raw_metadata->>'comments')::int, 0)),
          share_count = GREATEST(ci.share_count, COALESCE((ci.raw_metadata->>'reposts')::int, 0)),
          updated_at = NOW()
      FROM collection_sources cs
      WHERE ci.first_seen_source_id = cs.id
        AND ci.first_seen_channel IN ('tikhub_weibo_account', 'tikhub_weibo')
        AND (
          ci.platform IS NULL
          OR ci.account_id IS NULL
          OR ci.account_handle IS NULL
          OR ci.outlet_id IS NULL
          OR ci.like_count = 0
        )
      RETURNING ci.id
    `;
    console.log(`[2/3] 回填 weibo collected_items: ${itemFix.length} 行`);

    // 3. 重算 composite_score（避开 daily-snapshot 时算了 0）
    //    权重: like*1 + comment*5 + share*5 + favorite*2 + view*0
    const scoreFix = await sql`
      UPDATE collected_items
      SET composite_score = like_count + comment_count * 5 + share_count * 5 + favorite_count * 2,
          updated_at = NOW()
      WHERE platform = 'weibo'
        AND composite_score = 0
        AND (like_count > 0 OR comment_count > 0 OR share_count > 0)
      RETURNING id
    `;
    console.log(`[3/3] 重算 composite_score: ${scoreFix.length} 行`);

    // 4. 手算 account_daily_snapshots（按 published_at 业务日，Asia/Shanghai）
    //    avoid 等 cron，立刻让 UI 有数据
    const snaps = await sql`
      INSERT INTO account_daily_snapshots (
        organization_id, account_id, account_source, platform, snapshot_date,
        post_count, total_likes, total_comments, total_shares, total_views, total_favorites,
        composite_score_total, composite_score_avg, top_post_id, raw_metrics
      )
      SELECT
        ma.organization_id,
        ma.id AS account_id,
        'my' AS account_source,
        ma.platform,
        (ci.published_at AT TIME ZONE 'Asia/Shanghai')::date AS snapshot_date,
        count(*)::int AS post_count,
        sum(ci.like_count)::int AS total_likes,
        sum(ci.comment_count)::int AS total_comments,
        sum(ci.share_count)::int AS total_shares,
        sum(ci.view_count)::int AS total_views,
        sum(ci.favorite_count)::int AS total_favorites,
        sum(ci.composite_score)::numeric AS composite_score_total,
        (sum(ci.composite_score)::numeric / NULLIF(count(*), 0)) AS composite_score_avg,
        (array_agg(ci.id ORDER BY ci.composite_score DESC NULLS LAST))[1] AS top_post_id,
        jsonb_build_object('source', 'backfill-weibo-collected-items') AS raw_metrics
      FROM my_accounts ma
      JOIN collected_items ci
        ON ci.organization_id = ma.organization_id
       AND ci.outlet_id = ma.outlet_id
       AND ci.platform = ma.platform::text
      WHERE ma.platform::text = 'weibo'
        AND ci.published_at IS NOT NULL
        AND ma.outlet_id IS NOT NULL
      GROUP BY ma.organization_id, ma.id, ma.platform, snapshot_date
      ON CONFLICT (organization_id, account_id, snapshot_date)
      DO UPDATE SET
        post_count = EXCLUDED.post_count,
        total_likes = EXCLUDED.total_likes,
        total_comments = EXCLUDED.total_comments,
        total_shares = EXCLUDED.total_shares,
        total_views = EXCLUDED.total_views,
        total_favorites = EXCLUDED.total_favorites,
        composite_score_total = EXCLUDED.composite_score_total,
        composite_score_avg = EXCLUDED.composite_score_avg,
        top_post_id = EXCLUDED.top_post_id,
        computed_at = NOW()
      RETURNING account_id, snapshot_date, post_count, total_likes
    `;
    console.log(`[4/4] 算 account_daily_snapshots: ${snaps.length} 行`);
    for (const r of snaps) console.log("  -", r);

    console.log("\n回填完成。刷新账号详情页应该能立刻看到数据。");
    console.log("以后新的抓取走修复后的 adapter，会自动填顶级字段。");
  } catch (err) {
    console.error("回填失败:", err);
    process.exitCode = 2;
  } finally {
    await sql.end();
  }
}

void main();
