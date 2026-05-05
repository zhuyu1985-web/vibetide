import type { RawItem } from "../../../types";
import { parseTimestampSec } from "../time-parser";

/**
 * 真实测试 endpoint（Phase 1 实测）：
 * - Demo:  /api/v1/demo/douyin_search/app/general_search
 * - Live:  /api/v1/douyin/app/v3/fetch_general_search_result  (需登录态)
 */
export const DOUYIN_ENDPOINT = "/api/v1/douyin/app/v3/fetch_general_search_result";

// ─── 响应结构 ────────────────────────────────────────────────────
interface DouyinPlayAddr {
  url_list?: string[];
  width?: number;
  height?: number;
}

interface DouyinVideo {
  play_addr?: DouyinPlayAddr;
  cover?: DouyinPlayAddr;
  dynamic_cover?: DouyinPlayAddr;
  origin_cover?: DouyinPlayAddr;
  duration?: number; // ms
  width?: number;
  height?: number;
}

interface DouyinAuthor {
  uid?: string;
  nickname?: string;
  sec_uid?: string;
}

interface DouyinStatistics {
  aweme_id?: string;
  digg_count?: number;
  comment_count?: number;
  share_count?: number;
  play_count?: number;
}

interface DouyinAweme {
  aweme_id?: string;
  desc?: string;
  create_time?: number; // Unix seconds
  author?: DouyinAuthor;
  video?: DouyinVideo;
  share_url?: string;
  statistics?: DouyinStatistics;
}

interface DouyinItem {
  type?: number;
  aweme_info?: DouyinAweme;
}

export interface DouyinSearchResponse {
  /** code 200 on success */
  code?: number;
  data?: {
    status_code?: number;
    /** Array of search result items */
    data?: DouyinItem[];
    cursor?: number;
    has_more?: boolean;
  };
}

// ─── Mapper ──────────────────────────────────────────────────────

/**
 * 把抖音搜索 API 响应映射为标准 RawItem[]。
 * 只处理含有效 aweme_info 的视频条目。
 */
export function mapDouyinResponse(response: DouyinSearchResponse): RawItem[] {
  const list = response.data?.data ?? [];
  const items: RawItem[] = [];

  for (const entry of list) {
    const aweme = entry.aweme_info;
    if (!aweme?.aweme_id) continue;

    const videoUrl = aweme.video?.play_addr?.url_list?.[0];
    const thumbUrl =
      aweme.video?.cover?.url_list?.[0] ??
      aweme.video?.origin_cover?.url_list?.[0];

    const attachments: RawItem["attachments"] = [];
    if (videoUrl) {
      attachments.push({
        kind: "video",
        url: videoUrl,
        durationMs: aweme.video?.duration, // already in ms per fixture
        width: aweme.video?.width ?? aweme.video?.play_addr?.width,
        height: aweme.video?.height ?? aweme.video?.play_addr?.height,
      });
    }
    if (thumbUrl) {
      attachments.push({ kind: "thumbnail", url: thumbUrl });
    }

    items.push({
      title: aweme.desc || "(无标题)",
      url:
        aweme.share_url ??
        `https://www.douyin.com/video/${aweme.aweme_id}`,
      summary: aweme.desc?.slice(0, 200),
      publishedAt: parseTimestampSec(aweme.create_time),
      channel: "tikhub_douyin",
      contentType: "short_video",
      attachments,
      rawMetadata: {
        platform: "douyin",
        aweme_id: aweme.aweme_id,
        likes: aweme.statistics?.digg_count,
        comments: aweme.statistics?.comment_count,
        shares: aweme.statistics?.share_count,
        plays: aweme.statistics?.play_count,
        author: aweme.author?.nickname,
        author_uid: aweme.author?.uid ?? aweme.author?.sec_uid,
      },
    });
  }

  return items;
}
