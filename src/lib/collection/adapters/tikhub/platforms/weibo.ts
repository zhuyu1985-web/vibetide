import type { RawItem } from "../../../types";
import { parseWeiboTime } from "../time-parser";

/**
 * 真实测试 endpoint（Phase 1 实测）：
 * /api/v1/weibo/web/fetch_search
 */
export const WEIBO_ENDPOINT = "/api/v1/weibo/web/fetch_search";

// ─── 响应结构 ────────────────────────────────────────────────────

interface WeiboPic {
  pid?: string;
  url?: string;
  large?: { url?: string };
  size?: string;
  /** 视频封面时有 videoSrc 字段 */
  videoSrc?: string;
  type?: string;
}

interface WeiboPageInfo {
  type?: string; // "video" | "article" | "topic" | "search_topic" | "place" | ...
  page_pic?: { url?: string };
  media_info?: {
    stream_url?: string;
    stream_url_hd?: string;
    duration?: number; // seconds (float)
  };
}

interface WeiboUser {
  id?: number | string;
  screen_name?: string;
}

interface WeiboMblog {
  id?: string;
  mid?: string;
  bid?: string;
  text?: string;
  text_raw?: string;
  created_at?: string; // Twitter datetime: "Tue May 05 12:55:07 +0800 2026"
  /** 图片列表（含 large 字段） */
  pics?: WeiboPic[];
  pic_num?: number;
  pic_ids?: string[];
  page_info?: WeiboPageInfo;
  user?: WeiboUser;
  reposts_count?: number;
  comments_count?: number;
  attitudes_count?: number;
}

interface WeiboCard {
  card_type?: number;
  mblog?: WeiboMblog;
  card_group?: WeiboCard[];
}

interface WeiboSearchData {
  cards?: WeiboCard[];
}

export interface WeiboSearchResponse {
  code?: number;
  data?: {
    ok?: number;
    data?: WeiboSearchData;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

/** 递归展开 cards 列表，提取所有 mblog 条目 */
function extractMblogs(cards: WeiboCard[]): WeiboMblog[] {
  const result: WeiboMblog[] = [];
  for (const card of cards) {
    if (card.card_type === 9 && card.mblog) {
      result.push(card.mblog);
    } else if (card.card_type === 11 && Array.isArray(card.card_group)) {
      result.push(...extractMblogs(card.card_group));
    }
  }
  return result;
}

/** 去除 Weibo text 中的 HTML 标签，返回纯文本 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

// ─── Mapper ──────────────────────────────────────────────────────

/**
 * 把微博搜索 API 响应映射为标准 RawItem[]。
 *
 * 内容类型判断：
 *  - video   → page_info.type === "video"
 *  - image_set → pics.length > 1（多图）
 *  - image_text → 单图或无图（默认）
 */
export function mapWeiboResponse(response: WeiboSearchResponse): RawItem[] {
  const cards = response.data?.data?.cards ?? [];
  const mblogs = extractMblogs(cards);
  const items: RawItem[] = [];

  for (const m of mblogs) {
    if (!m.id && !m.mid) continue;

    const mblogId = m.id ?? m.mid ?? "";
    const userId = m.user?.id;
    // bid 是 Base62 短 ID，官方 URL 使用 bid
    const urlId = m.bid ?? mblogId;
    const url = userId
      ? `https://weibo.com/${userId}/${urlId}`
      : `https://weibo.com/detail/${mblogId}`;

    const isVideo = m.page_info?.type === "video";
    const pics = m.pics ?? [];
    const isImageSet = !isVideo && pics.length > 1;
    const contentType: RawItem["contentType"] = isVideo
      ? "video"
      : isImageSet
        ? "image_set"
        : "image_text";

    let attachments: RawItem["attachments"] = [];
    if (isVideo) {
      const pi = m.page_info!;
      const videoUrl =
        pi.media_info?.stream_url_hd ?? pi.media_info?.stream_url;
      const thumbUrl = pi.page_pic?.url;
      if (videoUrl) {
        attachments.push({
          kind: "video",
          url: videoUrl,
          durationMs: pi.media_info?.duration
            ? Math.round(pi.media_info.duration * 1000)
            : undefined,
        });
      }
      if (thumbUrl) {
        attachments.push({ kind: "thumbnail", url: thumbUrl });
      }
    } else if (pics.length > 0) {
      attachments = pics
        .map((p) => ({
          kind: "image" as const,
          url: p.large?.url ?? p.url ?? "",
          thumbnailUrl: p.url,
        }))
        .filter((a) => a.url);
    }

    const rawText = m.text_raw || m.text || "";
    const plainText = stripHtml(rawText);

    items.push({
      title: plainText.slice(0, 100) || "(无标题)",
      url,
      summary: plainText.slice(0, 200) || undefined,
      publishedAt: m.created_at ? parseWeiboTime(m.created_at) : undefined,
      channel: "tikhub_weibo",
      contentType,
      attachments,
      rawMetadata: {
        platform: "weibo",
        mblog_id: mblogId,
        bid: m.bid,
        author: m.user?.screen_name,
        author_id: userId,
        likes: m.attitudes_count,
        comments: m.comments_count,
        reposts: m.reposts_count,
        pic_num: m.pic_num,
      },
    });
  }

  return items;
}
