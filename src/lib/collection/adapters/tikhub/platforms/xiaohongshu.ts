import type { RawItem } from "../../../types";
import { parseTimestampSec } from "../time-parser";

/**
 * 真实测试 endpoint（Phase 1 实测）：
 * /api/v1/xiaohongshu/web/search_notes
 *
 * 参数：keyword / page / sort / noteType / noteTime
 */
export const XHS_ENDPOINT = "/api/v1/xiaohongshu/web/search_notes";

// ─── 响应结构 ────────────────────────────────────────────────────

interface XhsStreamEntry {
  master_url?: string;
  duration?: number; // ms
  width?: number;
  height?: number;
  quality_type?: string;
}

interface XhsVideoInfoV2 {
  media?: {
    video?: {
      width?: number;
      height?: number;
      duration?: number; // seconds
    };
    stream?: {
      h264?: XhsStreamEntry[];
      h265?: XhsStreamEntry[];
    };
  };
  /** thumbnail 是字符串 URL（直接值，不是对象） */
  image?: {
    thumbnail?: string;
  };
}

interface XhsImage {
  url?: string;
  url_size_large?: string;
  width?: number;
  height?: number;
}

interface XhsUser {
  userid?: string;
  nickname?: string;
}

interface XhsNote {
  id?: string;
  title?: string;
  desc?: string;
  /** "video" | "normal" */
  type?: string;
  /** Unix seconds */
  timestamp?: number;
  user?: XhsUser;
  images_list?: XhsImage[];
  video_info_v2?: XhsVideoInfoV2;
  liked_count?: number;
  collected_count?: number;
  comments_count?: number;
  shared_count?: number;
}

interface XhsItem {
  model_type?: string;
  note?: XhsNote;
}

export interface XhsSearchResponse {
  code?: number;
  data?: {
    code?: number;
    data?: {
      items?: XhsItem[];
    };
  };
}

// ─── Mapper ──────────────────────────────────────────────────────

/**
 * 把小红书搜索 API 响应映射为标准 RawItem[]。
 *
 * 内容类型判断（基于 note.type 字符串）：
 *  - "video"  → contentType = "video"，attachments 含 video + thumbnail
 *  - "normal" → contentType = "image_set"，attachments 含 N 个 image
 *
 * publishedAt：note.timestamp 是 Unix 秒，用 parseTimestampSec()。
 *
 * video URL：video_info_v2.media.stream.h264[0].master_url
 * thumbnail：video_info_v2.image.thumbnail（字符串直接值）
 * 图文图片：images_list[].url（优先 url_size_large）
 */
export function mapXiaohongshuResponse(response: XhsSearchResponse): RawItem[] {
  const rawItems = response.data?.data?.items ?? [];
  const result: RawItem[] = [];

  for (const entry of rawItems) {
    // 只处理真实笔记条目（过滤广告、dsl 等）
    if (entry.model_type !== "note" || !entry.note) continue;

    const note = entry.note;
    if (!note.id) continue;

    const isVideo = note.type === "video";
    const attachments: RawItem["attachments"] = [];

    if (isVideo) {
      // 提取视频 URL：优先 h264 stream
      const h264List = note.video_info_v2?.media?.stream?.h264 ?? [];
      const h265List = note.video_info_v2?.media?.stream?.h265 ?? [];
      const bestStream = h264List[0] ?? h265List[0];
      const videoUrl = bestStream?.master_url;
      const durationMs = bestStream?.duration; // h264 stream duration 单位 ms

      if (videoUrl) {
        attachments.push({
          kind: "video",
          url: videoUrl,
          durationMs,
          width: bestStream?.width ?? note.video_info_v2?.media?.video?.width,
          height: bestStream?.height ?? note.video_info_v2?.media?.video?.height,
        });
      }

      // 封面图：video_info_v2.image.thumbnail 是字符串 URL
      const thumbUrl = note.video_info_v2?.image?.thumbnail;
      if (thumbUrl) {
        attachments.push({ kind: "thumbnail", url: thumbUrl });
      }
    } else {
      // 图文笔记：从 images_list 构建 image 附件
      const imgs = note.images_list ?? [];
      for (const img of imgs) {
        const url = img.url_size_large ?? img.url;
        if (url) {
          attachments.push({ kind: "image", url });
        }
      }
    }

    result.push({
      title: note.title || (note.desc ?? "").slice(0, 50) || "(无标题)",
      url: `https://www.xiaohongshu.com/explore/${note.id}`,
      summary: note.desc?.slice(0, 200),
      publishedAt: parseTimestampSec(note.timestamp),
      channel: "tikhub_xiaohongshu",
      contentType: isVideo ? "video" : "image_set",
      attachments,
      rawMetadata: {
        platform: "xiaohongshu",
        note_id: note.id,
        author: note.user?.nickname,
        author_id: note.user?.userid,
        likes: note.liked_count,
        comments: note.comments_count,
        collects: note.collected_count,
        shares: note.shared_count,
      },
    });
  }

  return result;
}
