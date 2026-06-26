import "server-only";
import * as cheerio from "cheerio";

export type VideoSourceKind = "direct" | "stream" | "none";

export interface VideoSource {
  kind: VideoSourceKind;
  /** 可下载/可处理的视频源直链（direct/stream 有，none 无） */
  videoUrl?: string;
  thumbnailUrl?: string;
  durationMs?: number;
  /** 已识别的社媒平台（便于后续接专用单视频解析器） */
  platform?: string;
}

const PLATFORM_HOSTS: { re: RegExp; name: string }[] = [
  { re: /(^|\.)douyin\.com|iesdouyin/i, name: "douyin" },
  { re: /xiaohongshu\.com|xhslink\.com/i, name: "xiaohongshu" },
  { re: /weibo\.(com|cn)/i, name: "weibo" },
  { re: /channels\.weixin\.qq\.com|finder\.video\.qq\.com/i, name: "wechat_channels" },
  { re: /bilibili\.com|b23\.tv/i, name: "bilibili" },
];

const isM3u8 = (u: string) => /\.m3u8(\?|$)/i.test(u);

function platformOf(url: string): string | undefined {
  return PLATFORM_HOSTS.find((p) => p.re.test(url))?.name;
}

/**
 * 从原始 HTML 抽取视频源 + 封面（og:video / twitter:player / <video>）。纯函数，易测。
 */
export function extractVideoMeta(html: string): {
  videoUrl?: string;
  thumbnailUrl?: string;
} {
  const $ = cheerio.load(html);
  const pick = (sel: string, attr: string) => $(sel).first().attr(attr)?.trim() || undefined;
  const videoUrl =
    pick('meta[property="og:video:secure_url"]', "content") ||
    pick('meta[property="og:video:url"]', "content") ||
    pick('meta[property="og:video"]', "content") ||
    pick('meta[name="twitter:player:stream"]', "content") ||
    pick("video", "src") ||
    pick("video source", "src");
  const thumbnailUrl =
    pick('meta[property="og:image"]', "content") ||
    pick('meta[name="twitter:image"]', "content");
  return { videoUrl, thumbnailUrl };
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 VibeTideBot/1.0", Accept: "text/html" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * 检测页面/链接的可下载视频源（D4：通用 og:video 为主，平台专用解析为扩展位）。
 * - direct：og:video / <video src> 直链 mp4 等 → 可下载到素材库。
 * - stream：m3u8/HLS → 不强下，调用方标记 + 存源链接 + 提示。
 * - none  ：无视频，或平台页 JS 渲染拿不到直链（降级）。
 *
 * 注：抖音/视频号等需登录或 JS 渲染的单视频直链解析当前未接（既有 tikhub 适配器是
 * 搜索结果映射器，非单视频解析器），命中 platform 但 og 无视频时降级为 none + platform 标注，
 * 留待后续接专用单视频端点。
 */
export async function detectVideoSource(
  url: string,
  hint?: string,
): Promise<VideoSource> {
  const platform = platformOf(url);

  // hint（上游已解析的视频直链）直接采用，免二次抓取
  if (hint) {
    return isM3u8(hint)
      ? { kind: "stream", videoUrl: hint, platform }
      : { kind: "direct", videoUrl: hint, platform };
  }

  let html = "";
  try {
    html = await fetchHtml(url);
  } catch {
    return { kind: "none", platform };
  }

  const { videoUrl, thumbnailUrl } = extractVideoMeta(html);
  if (videoUrl) {
    return isM3u8(videoUrl)
      ? { kind: "stream", videoUrl, thumbnailUrl, platform }
      : { kind: "direct", videoUrl, thumbnailUrl, platform };
  }
  return { kind: "none", thumbnailUrl, platform };
}
