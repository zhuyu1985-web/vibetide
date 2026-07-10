/**
 * 单篇稿件传播数据聚合（内容闭环第 7 步复盘）。
 *
 * 跨渠道聚合：国内 CMS（cms_publications → getArticleDetail 机会性取统计字段）
 * + 海外 external_publications（pending_overseas 本期不真发 → 未计入）。
 * 数值确定性汇总（不让 LLM 估算），回填 articles.spread_data。
 *
 * 注：CMS 单篇阅读/评论取自 getMyArticleDetail 的 passthrough 字段——华栖云 CMS
 * 若在该接口返回 readCount/commentCount 等即真拉；未返回则降级 0 + warning，
 * 待确认字段名后无缝接真数据。
 */
import { db } from "@/db";
import { articles } from "@/db/schema/articles";
import { cmsPublications } from "@/db/schema/cms-publications";
import { externalPublications } from "@/db/schema/external-publications";
import { and, eq } from "drizzle-orm";
import {
  CmsClient,
  getArticleDetail,
  isCmsPublishEnabled,
  requireCmsConfig,
} from "@/lib/cms";

export interface ChannelSpread {
  channel: string;
  platform: string;
  views: number;
  comments: number;
  shares: number;
  pct?: number;
  status?: string;
  url?: string;
}

export interface ArticleSpread {
  aggregated: {
    views: number;
    impressions: number;
    likes: number;
    shares: number;
    comments: number;
  };
  byChannel: ChannelSpread[];
  warnings: string[];
  hasRealData: boolean;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 聚合单篇跨渠道传播数据并回填 spread_data。 */
export async function aggregateArticleSpread(
  orgId: string,
  articleId: string,
): Promise<ArticleSpread> {
  const warnings: string[] = [];
  const byChannel: ChannelSpread[] = [];

  // 1. 国内 CMS 渠道
  const pubs = await db
    .select()
    .from(cmsPublications)
    .where(
      and(
        eq(cmsPublications.organizationId, orgId),
        eq(cmsPublications.articleId, articleId),
      ),
    );

  let client: CmsClient | null = null;
  if (pubs.length > 0 && isCmsPublishEnabled()) {
    try {
      const c = requireCmsConfig();
      client = new CmsClient({
        host: c.host,
        loginCmcId: c.loginCmcId,
        loginCmcTid: c.loginCmcTid,
        timeoutMs: c.timeoutMs,
        maxRetries: c.maxRetries,
      });
    } catch {
      warnings.push("CMS 未配置，国内数据暂取本地缓存");
    }
  }

  for (const p of pubs) {
    let views = 0;
    let comments = 0;
    let shares = 0;
    if (client && p.cmsArticleId) {
      try {
        const detail = await getArticleDetail(client, p.cmsArticleId);
        const raw = detail.data as Record<string, unknown>;
        views = num(raw.readCount ?? raw.clickCount ?? raw.viewCount ?? raw.pv);
        comments = num(raw.commentCount ?? raw.commentNum ?? raw.commentTotal);
        shares = num(raw.forwardCount ?? raw.shareCount ?? raw.transmitCount);
        if (views === 0 && comments === 0) {
          warnings.push(`栏目 ${p.cmsCatalogId ?? ""} CMS 未返回统计字段`);
        }
      } catch {
        warnings.push(`栏目 ${p.cmsCatalogId ?? ""} 统计拉取失败`);
      }
    }
    byChannel.push({
      channel: `CMS·${p.cmsCatalogId ?? "栏目"}`,
      platform: "cms",
      views,
      comments,
      shares,
      url: p.publishedUrl ?? undefined,
    });
  }

  // 2. 海外渠道（pending_overseas 本期不真发 → 未计入）
  const exts = await db
    .select()
    .from(externalPublications)
    .where(
      and(
        eq(externalPublications.organizationId, orgId),
        eq(externalPublications.articleId, articleId),
      ),
    );
  for (const e of exts) {
    byChannel.push({
      channel: e.platform,
      platform: e.platform,
      views: 0,
      comments: 0,
      shares: 0,
      status: e.status,
    });
  }

  // 3. 确定性汇总 + 渠道占比
  const totalViews = byChannel.reduce((s, c) => s + c.views, 0);
  const totalComments = byChannel.reduce((s, c) => s + c.comments, 0);
  const totalShares = byChannel.reduce((s, c) => s + c.shares, 0);
  for (const c of byChannel) {
    if (totalViews > 0 && c.views > 0) {
      c.pct = Math.round((c.views / totalViews) * 100);
    }
  }

  const aggregated = {
    views: totalViews,
    impressions: 0,
    likes: 0,
    shares: totalShares,
    comments: totalComments,
  };

  // 4. 回填 spread_data
  await db
    .update(articles)
    .set({
      spreadData: {
        views: totalViews,
        likes: 0,
        shares: totalShares,
        comments: totalComments,
        lastSyncedAt: new Date().toISOString(),
        source: "api_sync",
        byChannel: byChannel.map((c) => ({
          channel: c.channel,
          platform: c.platform,
          views: c.views,
          pct: c.pct,
          status: c.status,
        })),
      },
      updatedAt: new Date(),
    })
    .where(and(eq(articles.id, articleId), eq(articles.organizationId, orgId)));

  return {
    aggregated,
    byChannel,
    warnings,
    hasRealData: totalViews > 0 || totalComments > 0,
  };
}
