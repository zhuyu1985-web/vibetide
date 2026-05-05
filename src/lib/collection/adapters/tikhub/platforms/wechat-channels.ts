import type { RawItem } from "../../../types";
import { parseTimestampSec } from "../time-parser";

export const WECHAT_CHANNELS_ENDPOINT =
  "/api/v1/wechat_channels/fetch_search_ordinary";

// ─── 响应结构 ──────────────────────────────────────────────────────

interface WechatChannelsSource {
  title?: string;
  iconUrl?: string;
}

interface WechatChannelsItem {
  hashDocID?: string;
  exportId?: string;
  title?: string;
  videoUrl?: string;
  image?: string;
  duration?: string; // "MM:SS" format
  pubTime?: number; // Unix seconds
  likeNum?: number | string;
  width?: number;
  height?: number;
  source?: WechatChannelsSource;
}

export interface WechatChannelsSearchResponse {
  code?: number;
  data?: {
    items?: WechatChannelsItem[];
    offset?: string;
  };
}

// ─── Helper ────────────────────────────────────────────────────────

/** 将 "MM:SS" 格式转换为毫秒 */
function parseDurationToMs(duration: string | undefined): number | undefined {
  if (!duration) return undefined;
  const parts = duration.split(":").map(Number);
  if (parts.length === 2) {
    const [m, s] = parts;
    if (m !== undefined && s !== undefined && !isNaN(m) && !isNaN(s)) {
      return (m * 60 + s) * 1000;
    }
  }
  return undefined;
}

/** 清除 HTML 高亮标签 <em class="highlight">...</em> */
function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

// ─── Mapper ────────────────────────────────────────────────────────

/**
 * 把微信视频号搜索 API 响应映射为标准 RawItem[]。
 * 视频号搜索结果全部是短视频，contentType 固定为 short_video。
 * URL 使用 hashDocID 构造视频链接，没有稳定的 web permalink 时
 * 退而使用 exportId 前缀作为标识符。
 */
export function mapWechatChannelsResponse(
  response: WechatChannelsSearchResponse,
): RawItem[] {
  const list = response.data?.items ?? [];
  const items: RawItem[] = [];

  for (const item of list) {
    const id = item.hashDocID ?? item.exportId;
    if (!id) continue;

    const rawTitle = item.title ?? "";
    const cleanTitle = stripHtml(rawTitle) || "(无标题)";

    const attachments: RawItem["attachments"] = [];
    if (item.videoUrl) {
      attachments.push({
        kind: "video",
        url: item.videoUrl,
        durationMs: parseDurationToMs(item.duration),
        width: item.width,
        height: item.height,
      });
    }
    if (item.image) {
      attachments.push({ kind: "thumbnail", url: item.image });
    }

    items.push({
      title: cleanTitle,
      url: `https://channels.weixin.qq.com/channel/video/${item.hashDocID ?? ""}`,
      summary: cleanTitle.slice(0, 200),
      publishedAt: parseTimestampSec(item.pubTime),
      channel: "tikhub_wechat_channels",
      contentType: "short_video",
      attachments,
      rawMetadata: {
        platform: "wechat_channels",
        hash_doc_id: item.hashDocID,
        export_id: item.exportId,
        author: item.source?.title,
        likes: item.likeNum,
        duration: item.duration,
      },
    });
  }

  return items;
}
