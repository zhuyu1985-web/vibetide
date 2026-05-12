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
// 实测验证(commit XXX):web_v2/fetch_user_posts 响应结构
//   data: { data: { list: [...], since_id, total }, ok: 1 }
//   list[] 每项: { mid, mblogid, text_raw, text, created_at, user: {screen_name,idstr},
//                  reposts_count, comments_count, attitudes_count, pic_ids[], pic_num }
interface WeiboUserPostsResponse {
  data?: {
    data?: {
      list?: unknown[];
    };
    ok?: number;
  };
}

export function mapWeiboAccountResponse(resp: unknown): RawItem[] {
  const list = (resp as WeiboUserPostsResponse).data?.data?.list ?? [];
  const items: RawItem[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const post = raw as Record<string, unknown>;
    const mblogid = post.mblogid as string | undefined; // base62 短 ID,用于 URL
    const mid = post.mid as string | undefined; // 数字 ID
    if (!mblogid && !mid) continue;

    // text_raw 已经是干净文本(没有 HTML),优先用
    const text = (post.text_raw as string) ?? stripHtml((post.text as string) ?? "");
    const user = post.user as
      | { screen_name?: string; idstr?: string; id?: number }
      | undefined;
    const uid = user?.idstr ?? String(user?.id ?? "");

    // 主页 URL: https://weibo.com/{uid}/{mblogid} (mblogid 短码)
    const url = mblogid && uid
      ? `https://weibo.com/${uid}/${mblogid}`
      : `https://weibo.com/${uid}/${mid}`;

    // 图片(weibo CDN url 模板:从 pic_ids 拼,但 tikhub 没直接提供 wb_pic_url,先存 raw)
    const picIds = Array.isArray(post.pic_ids) ? (post.pic_ids as string[]) : [];

    items.push({
      title: text.slice(0, 80) || "(无标题)",
      url,
      summary: text.slice(0, 200),
      publishedAt: post.created_at ? parseWeiboDate(String(post.created_at)) : undefined,
      channel: "tikhub_weibo_account",
      contentType: picIds.length > 0 ? "image_set" : "image_text",
      rawMetadata: {
        platform: "weibo",
        mode: "account",
        mid,
        mblogid,
        author: user?.screen_name,
        uid,
        reposts: post.reposts_count,
        comments: post.comments_count,
        likes: post.attitudes_count,
        pic_count: post.pic_num,
        text_length: post.textLength,
      },
    });
  }
  return items;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

/** 解析 weibo "Tue May 12 00:00:00 +0800 2026" 格式 */
function parseWeiboDate(s: string): Date | undefined {
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
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
// 实测响应(commit XXX):
//   data.list[] 每项字段是大写驼峰:
//   { Title, Digest, ContentUrl, ItemIndex, ItemShowType, ItemUpdateTime,
//     CoverImgUrl, IsContinueRead, ... }
// ⚠️  请求参数:不要传 offset=0(会 400),首页用纯 ghid 即可。
interface WechatMpArticleListResponse {
  data?: {
    list?: unknown[];
  };
}

interface WechatMpArticle {
  Title?: string;
  Digest?: string;
  ContentUrl?: string;
  ItemIndex?: number;
  ItemUpdateTime?: number; // Unix 秒
  CoverImgUrl?: string;
  Author?: string;
  /** 兼容老字段名(以防 tikhub 后续改 schema) */
  title?: string;
  digest?: string;
  url?: string;
}

export function mapWechatMpAccountResponse(resp: unknown): RawItem[] {
  const list = (resp as WechatMpArticleListResponse).data?.list ?? [];
  const items: RawItem[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const art = raw as WechatMpArticle;
    const title = art.Title ?? art.title ?? "";
    const url = art.ContentUrl ?? art.url ?? "";
    if (!title || !url) continue;

    items.push({
      title,
      url,
      summary: art.Digest ?? art.digest ?? title.slice(0, 200),
      publishedAt: art.ItemUpdateTime
        ? parseTimestampSec(art.ItemUpdateTime)
        : undefined,
      channel: "tikhub_wechat_mp_account",
      contentType: "image_text",
      attachments: art.CoverImgUrl
        ? [{ kind: "thumbnail" as const, url: art.CoverImgUrl }]
        : [],
      rawMetadata: {
        platform: "wechat_oa",
        mode: "account",
        item_index: art.ItemIndex,
        author: art.Author,
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
