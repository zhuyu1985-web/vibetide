// src/lib/collection/adapters/tikhub/account-mappers.ts
//
// M3 (2026-05-12) Account 模式: 按账号 ID 拉用户 feed 的 4 个平台 mapper。
// 区别于现有 keyword 模式: 入参不是关键词,响应也是 user-feed 而非 search-result。
//
// ⚠️  Phase 1 实施时使用 tikhub 文档 + best-effort mapping;
//    上线前需要用真实 API 响应回归一轮(尤其是 kuaishou 的精确路径)。

import type { RawItem } from "../../types";
import { parseTimestampSec } from "./time-parser";
import type { TikhubAccountPlatform } from "./config";

// ─── 通用工具:从 tikhub 响应里安全取嵌套数组 ──────────────────────────
function pickArray(obj: unknown, path: string[]): unknown[] {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur && typeof cur === "object" && k in cur) {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return [];
    }
  }
  return Array.isArray(cur) ? cur : [];
}

// ─── 抖音用户发布视频 (复用 keyword 模式 mapper 同款结构) ─────────────
interface DouyinUserFeedResponse {
  data?: { aweme_list?: unknown[] };
}

export function mapDouyinAccountResponse(resp: unknown): RawItem[] {
  const list = (resp as DouyinUserFeedResponse).data?.aweme_list ?? [];
  const items: RawItem[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const aweme = raw as Record<string, unknown>;
    const awemeId = aweme.aweme_id as string | undefined;
    if (!awemeId) continue;

    const video = aweme.video as Record<string, unknown> | undefined;
    const playAddr = video?.play_addr as { url_list?: string[] } | undefined;
    const cover = video?.cover as { url_list?: string[] } | undefined;
    const author = aweme.author as { nickname?: string; sec_uid?: string } | undefined;
    const stats = aweme.statistics as Record<string, number> | undefined;

    const desc = (aweme.desc as string) ?? "";
    const attachments: RawItem["attachments"] = [];
    if (playAddr?.url_list?.[0]) {
      attachments.push({
        kind: "video",
        url: playAddr.url_list[0]!,
        durationMs: video?.duration as number | undefined,
      });
    }
    if (cover?.url_list?.[0]) {
      attachments.push({ kind: "thumbnail", url: cover.url_list[0]! });
    }

    items.push({
      title: desc || "(无标题)",
      url:
        (aweme.share_url as string) ??
        `https://www.douyin.com/video/${awemeId}`,
      summary: desc.slice(0, 200),
      publishedAt: parseTimestampSec(aweme.create_time as number | undefined),
      channel: "tikhub_douyin_account",
      contentType: "short_video",
      attachments,
      rawMetadata: {
        platform: "douyin",
        mode: "account",
        aweme_id: awemeId,
        author: author?.nickname,
        sec_uid: author?.sec_uid,
        likes: stats?.digg_count,
        comments: stats?.comment_count,
        plays: stats?.play_count,
      },
    });
  }
  return items;
}

// ─── 微博用户微博列表 ────────────────────────────────────────────────
interface WeiboUserPostsResponse {
  data?: { list?: unknown[]; cards?: unknown[] };
}

export function mapWeiboAccountResponse(resp: unknown): RawItem[] {
  const r = (resp as WeiboUserPostsResponse).data;
  // tikhub 文档显示有 list 字段;部分 endpoint 用 cards;两者都尝试
  const list = r?.list ?? r?.cards ?? [];
  const items: RawItem[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const mb = raw as Record<string, unknown>;
    // weibo: post 直接挂在 raw,也可能在 raw.mblog
    const post = (mb.mblog as Record<string, unknown> | undefined) ?? mb;
    const id = (post.id as string) ?? (post.mid as string);
    if (!id) continue;

    const text =
      ((post.text_raw as string) ?? "") ||
      stripHtml((post.text as string) ?? "");
    const user = post.user as { screen_name?: string; id?: number | string } | undefined;

    items.push({
      title: text.slice(0, 80) || "(无标题)",
      url: `https://weibo.com/${user?.id}/${id}`,
      summary: text.slice(0, 200),
      publishedAt: post.created_at ? new Date(String(post.created_at)) : undefined,
      channel: "tikhub_weibo_account",
      contentType: "image_text",
      rawMetadata: {
        platform: "weibo",
        mode: "account",
        post_id: id,
        author: user?.screen_name,
        uid: user?.id,
        reposts: post.reposts_count,
        comments: post.comments_count,
        likes: post.attitudes_count,
      },
    });
  }
  return items;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

// ─── 快手用户视频 feed ────────────────────────────────────────────────
// ⚠️  M3 实施时需要用真实响应回归一轮确认结构
interface KuaishouUserFeedResponse {
  data?: { feeds?: unknown[]; list?: unknown[] };
}

export function mapKuaishouAccountResponse(resp: unknown): RawItem[] {
  const r = (resp as KuaishouUserFeedResponse).data;
  const list = r?.feeds ?? r?.list ?? [];
  const items: RawItem[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const feed = raw as Record<string, unknown>;
    const photoId = (feed.photoId as string) ?? (feed.id as string);
    if (!photoId) continue;

    const caption = (feed.caption as string) ?? "";
    const user = feed.user as { name?: string; eid?: string } | undefined;
    const mainMvUrls = feed.mainMvUrls as Array<{ url: string }> | undefined;

    const attachments: RawItem["attachments"] = [];
    if (mainMvUrls?.[0]?.url) {
      attachments.push({ kind: "video", url: mainMvUrls[0].url });
    }
    const coverUrl = feed.coverUrl as string | undefined;
    if (coverUrl) attachments.push({ kind: "thumbnail", url: coverUrl });

    items.push({
      title: caption.slice(0, 80) || "(无标题)",
      url: `https://www.kuaishou.com/short-video/${photoId}`,
      summary: caption.slice(0, 200),
      publishedAt: parseTimestampSec(feed.timestamp as number | undefined),
      channel: "tikhub_kuaishou_account",
      contentType: "short_video",
      attachments,
      rawMetadata: {
        platform: "kuaishou",
        mode: "account",
        photo_id: photoId,
        author: user?.name,
        user_id: user?.eid,
        likes: feed.likeCount,
        plays: feed.viewCount,
      },
    });
  }
  return items;
}

// ─── 微信公众号文章列表 ──────────────────────────────────────────────
interface WechatMpArticleListResponse {
  data?: {
    article_list?: unknown[];
    list?: unknown[];
    /** tikhub 实际字段名可能是 articles / app_msg_list */
    articles?: unknown[];
    app_msg_list?: unknown[];
  };
}

export function mapWechatMpAccountResponse(resp: unknown): RawItem[] {
  const r = (resp as WechatMpArticleListResponse).data;
  const list =
    r?.article_list ?? r?.articles ?? r?.app_msg_list ?? r?.list ?? [];
  const items: RawItem[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const art = raw as Record<string, unknown>;
    const url = (art.url as string) ?? (art.link as string);
    const title = (art.title as string) ?? "";
    if (!url || !title) continue;

    items.push({
      title,
      url,
      summary: (art.digest as string) ?? (art.summary as string) ?? title.slice(0, 200),
      publishedAt:
        parseTimestampSec(art.create_time as number | undefined) ??
        parseTimestampSec(art.publish_time as number | undefined) ??
        (art.update_time ? new Date(String(art.update_time)) : undefined),
      channel: "tikhub_wechat_mp_account",
      contentType: "image_text",
      attachments: art.cover
        ? [{ kind: "thumbnail" as const, url: art.cover as string }]
        : [],
      rawMetadata: {
        platform: "wechat_oa",
        mode: "account",
        article_id: art.article_id ?? art.msgid,
        author: art.author,
        read_count: art.read_num,
        like_count: art.like_num,
      },
    });
  }
  return items;
}

// ─── 4 个平台 mapper 派遣表 ───────────────────────────────────────────
export const ACCOUNT_MAPPERS: Record<TikhubAccountPlatform, (resp: unknown) => RawItem[]> = {
  douyin: mapDouyinAccountResponse,
  weibo: mapWeiboAccountResponse,
  kuaishou: mapKuaishouAccountResponse,
  wechat_oa: mapWechatMpAccountResponse,
};
// 静默吃掉 pickArray unused 警告(后续给小红书/视频号扩展时可能用到)
void pickArray;
