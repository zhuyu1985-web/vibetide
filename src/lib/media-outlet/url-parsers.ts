// src/lib/media-outlet/url-parsers.ts
//
// 用户在媒体字典 UI 里粘贴账号主页 URL → 自动解析出对应平台的 channel 对象
// (含识别符 secUid / uid / userId)。M2 (2026-05-12) 引入。
//
// 设计原则:解析失败返回 null,不抛错(UI 上提示"无法解析,请手动填字段")。

import type {
  Channel,
  DouyinChannel,
  KuaishouChannel,
  WeiboChannel,
  WebsiteChannel,
} from "./channels";

// ─── 抖音主页 URL ─────────────────────────────────────────────────────
// 支持格式:
//   https://www.douyin.com/user/MS4wLjABAAAAxxx
//   https://www.iesdouyin.com/share/user/MS4wLjABAAAAxxx
//   https://v.douyin.com/iexxxx/  ← 短链,需要走 API 跳转才能拿到 sec_uid,这里只能拒绝
const DOUYIN_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:douyin\.com|iesdouyin\.com)\/(?:share\/)?user\/([A-Za-z0-9_-]+)/i;

export function parseDouyinProfileUrl(url: string): DouyinChannel | null {
  const m = url.trim().match(DOUYIN_RE);
  if (!m) return null;
  const secUid = m[1]!;
  return {
    type: "douyin",
    nickname: "", // 用户在 UI 上手动填或后续 tikhub 拉用户信息回填
    secUid,
    profileUrl: url.trim(),
  };
}

// ─── 微博主页 URL ─────────────────────────────────────────────────────
// 支持格式:
//   https://weibo.com/u/2803301701
//   https://m.weibo.cn/u/2803301701
//   https://www.weibo.com/u/2803301701/profile
const WEIBO_RE = /^https?:\/\/(?:www\.|m\.)?weibo\.(?:com|cn)\/u\/(\d+)/i;

export function parseWeiboProfileUrl(url: string): WeiboChannel | null {
  const m = url.trim().match(WEIBO_RE);
  if (!m) return null;
  return {
    type: "weibo",
    nickname: "",
    uid: m[1]!,
    profileUrl: url.trim(),
  };
}

// ─── 快手主页 URL ─────────────────────────────────────────────────────
// 支持格式:
//   https://www.kuaishou.com/profile/3xy4nh4nzqzkfxg
//   https://live.kuaishou.com/profile/3xy4nh4nzqzkfxg
const KUAISHOU_RE = /^https?:\/\/(?:www\.|live\.|m\.)?kuaishou\.com\/profile\/([A-Za-z0-9_-]+)/i;

export function parseKuaishouProfileUrl(url: string): KuaishouChannel | null {
  const m = url.trim().match(KUAISHOU_RE);
  if (!m) return null;
  return {
    type: "kuaishou",
    nickname: "",
    userId: m[1]!,
    profileUrl: url.trim(),
  };
}

// ─── 通用网站 URL → Website Channel ─────────────────────────────────
export function parseWebsiteUrl(url: string): WebsiteChannel | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return {
      type: "website",
      url: u.origin,
      domain: u.hostname.replace(/^www\./, ""),
    };
  } catch {
    return null;
  }
}

// ─── 统一入口: 智能识别 URL 对应的平台 ───────────────────────────────
/**
 * 给一段任意 URL,尝试识别它属于哪个平台并返回 channel 对象。
 * 用户在媒体字典编辑界面粘贴时一键填充表单。
 *
 * 识别顺序: 抖音 → 微博 → 快手 → 网站 兜底
 * 返回 null 表示无法识别(罕见,因为 website 是兜底);
 * 返回 channel 但需要用户继续补全 nickname/name 等字段。
 */
export function parseAnyChannelUrl(url: string): Channel | null {
  return (
    parseDouyinProfileUrl(url) ??
    parseWeiboProfileUrl(url) ??
    parseKuaishouProfileUrl(url) ??
    parseWebsiteUrl(url)
  );
}

