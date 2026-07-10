// src/lib/collection/account-import-helpers.ts
//
// 采集源「批量导入社媒账号」的纯逻辑:平台识别 / URL 解析 / 账号ID校验 /
// 字段读取 / 分级归一 / channel 构造与去重 / 类型与 schema。
//
// 从 account-import.ts(server action)抽出 —— "use server" 文件只能 export
// async 函数,这些同步纯函数放这里才能被单测覆盖。account-import.ts 引用本模块。

import { z } from "zod";
import {
  OUTLET_TIER_VALUES,
  OUTLET_TIER_LABELS,
  type OutletTier,
} from "@/lib/collection/constants";
import {
  parseDouyinProfileUrl,
  parseWeiboProfileUrl,
  parseKuaishouProfileUrl,
} from "@/lib/media-outlet/url-parsers";
import {
  getChannelIdentifier,
  type Channel,
} from "@/lib/media-outlet/channels";

export const DEFAULT_TIER: OutletTier = "government_self_media";
export const DEFAULT_REGION = "全国";

// ─── 平台配置 ──────────────────────────────────────────────────────────

export type SupportedPlatform = "douyin" | "weibo" | "kuaishou" | "wechat_oa";

export const PLATFORM_LABELS: Record<SupportedPlatform, string> = {
  douyin: "抖音",
  weibo: "微博",
  kuaishou: "快手",
  wechat_oa: "微信公众号",
};

/** 各平台的账号识别符字段名(与 channels.ts / findOutletByChannelIdentifier 对齐) */
export const PLATFORM_ID_FIELD: Record<SupportedPlatform, string> = {
  douyin: "secUid",
  weibo: "uid",
  kuaishou: "userId",
  wechat_oa: "ghid",
};

export function resolvePlatform(raw: string): SupportedPlatform | null {
  const p = raw.trim();
  if (!p) return "douyin"; // 平台列留空默认抖音
  const low = p.toLowerCase();
  if (p === "抖音" || low === "douyin") return "douyin";
  if (p === "微博" || low === "weibo") return "weibo";
  if (p === "快手" || low === "kuaishou") return "kuaishou";
  if (p === "微信公众号" || p === "公众号" || p === "微信" || low === "wechat_oa" || low === "wechat")
    return "wechat_oa";
  return null;
}

/** 主页链接 → 账号识别符(公众号无标准主页 URL 解析) */
export function parseUrlToId(
  platform: SupportedPlatform,
  url: string,
): { id: string; profileUrl?: string } | null {
  switch (platform) {
    case "douyin": {
      const c = parseDouyinProfileUrl(url);
      return c ? { id: c.secUid, profileUrl: c.profileUrl } : null;
    }
    case "weibo": {
      const c = parseWeiboProfileUrl(url);
      return c ? { id: c.uid, profileUrl: c.profileUrl } : null;
    }
    case "kuaishou": {
      const c = parseKuaishouProfileUrl(url);
      return c ? { id: c.userId, profileUrl: c.profileUrl } : null;
    }
    case "wechat_oa":
      return null;
  }
}

/** 直填账号 ID 的基本格式校验,返回错误信息或 null(合法) */
export function validateId(platform: SupportedPlatform, id: string): string | null {
  switch (platform) {
    case "weibo":
      return /^\d+$/.test(id) ? null : "微博 uid 必须是数字";
    case "wechat_oa":
      return /^gh_[a-zA-Z0-9]+$/.test(id) ? null : "公众号 ghid 必须以 gh_ 开头";
    case "douyin":
    case "kuaishou":
      return id.trim() ? null : "账号 ID 不能为空";
  }
}

/** 抖音 v.douyin.com 短链 → 跟踪重定向拿完整主页 URL(P1) */
export async function expandDouyinShortLink(url: string): Promise<string | null> {
  try {
    let current = url.trim();
    for (let i = 0; i < 5; i++) {
      const res = await fetch(current, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      });
      const loc = res.headers.get("location");
      if (!loc) return current;
      current = new URL(loc, current).toString();
      if (/douyin\.com\/(?:share\/)?user\//i.test(current)) return current;
    }
    return current;
  } catch {
    return null;
  }
}

// ─── 字段读取容错 ──────────────────────────────────────────────────────

/** Excel 解析后的原始行(中文表头,key 不保证规范,用 readField 容错读取) */
export type AccountImportRawRow = Record<string, unknown>;

export function readField(row: AccountImportRawRow, keys: readonly string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return "";
}

export const FIELD_KEYS = {
  outletName: ["媒体名称", "名称", "媒体", "outletName", "name"],
  platform: ["平台", "platform"],
  profileUrl: ["主页链接", "链接", "主页", "profileUrl", "url"],
  identifier: [
    "账号ID",
    "账号id",
    "账号 ID",
    "secUid",
    "sec_uid",
    "secuid",
    "sec_user_id",
    "uid",
    "userId",
    "user_id",
    "ghid",
  ],
  tier: ["媒体分级", "分级", "tier", "outletTier"],
  region: ["区域", "地区", "region", "outletRegion"],
  groupName: ["集团", "母公司", "groupName"],
  description: ["备注", "说明", "description", "remark"],
} as const;

export function normalizeTier(raw: string): string {
  const t = raw.trim();
  if (!t) return DEFAULT_TIER;
  const byLabel = OUTLET_TIER_VALUES.find((v) => OUTLET_TIER_LABELS[v] === t);
  if (byLabel) return byLabel;
  if ((OUTLET_TIER_VALUES as readonly string[]).includes(t)) return t;
  return DEFAULT_TIER;
}

/** 简易并发池(每批 ≤25 行,并发跑搜索/短链展开) */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

// ─── 预览/确认类型 ─────────────────────────────────────────────────────

export type PreviewMatchSource = "id" | "url" | "auto" | "none";
export type PreviewStatus = "ok" | "auto" | "error" | "duplicate";

export interface PreviewRow {
  rowIndex: number;
  outletName: string;
  platform: SupportedPlatform;
  platformLabel: string;
  nickname: string;
  identifier: string | null; // secUid/uid/userId/ghid
  identifierLabel: string; // 字段名(给前端占位/提示)
  followerCount: number | null;
  verified: boolean | null;
  avatarUrl: string | null;
  outletTier: string; // 已填缺省
  outletRegion: string; // 已填缺省
  groupName: string | null;
  description: string | null;
  profileUrl: string | null;
  matchSource: PreviewMatchSource;
  status: PreviewStatus;
  reason?: string;
}

/** 结构与 new-source-wizard-client 的 WizardOutletOption 一致,供向导回填候选 */
export interface ImportedOutletOption {
  id: string;
  outletName: string;
  outletTier: string;
  channels: Array<{
    type: string;
    nickname?: string;
    name?: string;
    url?: string;
    domain?: string;
  }>;
}

export const confirmRowSchema = z.object({
  outletName: z.string().min(1),
  platform: z.enum(["douyin", "weibo", "kuaishou", "wechat_oa"]),
  nickname: z.string().min(1),
  identifier: z.string().min(1),
  profileUrl: z.string().nullable().optional(),
  outletTier: z.enum(OUTLET_TIER_VALUES),
  outletRegion: z.string().min(1),
  groupName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type ConfirmRow = z.infer<typeof confirmRowSchema>;

export function buildChannel(r: ConfirmRow): Channel {
  const profileUrl = r.profileUrl || undefined;
  switch (r.platform) {
    case "douyin":
      return {
        type: "douyin",
        nickname: r.nickname,
        secUid: r.identifier,
        ...(profileUrl ? { profileUrl } : {}),
      };
    case "weibo":
      return {
        type: "weibo",
        nickname: r.nickname,
        uid: r.identifier,
        ...(profileUrl ? { profileUrl } : {}),
      };
    case "kuaishou":
      return {
        type: "kuaishou",
        nickname: r.nickname,
        userId: r.identifier,
        ...(profileUrl ? { profileUrl } : {}),
      };
    case "wechat_oa":
      return { type: "wechat_oa", name: r.nickname, ghid: r.identifier };
  }
}

export function channelKey(c: Channel): string {
  return `${c.type}:${getChannelIdentifier(c) ?? ""}`;
}

export function toWizardChannels(channels: Channel[]): ImportedOutletOption["channels"] {
  return channels.map((c) => ({
    type: c.type,
    nickname: "nickname" in c ? c.nickname : undefined,
    name: "name" in c ? c.name : undefined,
    url: "url" in c ? c.url : undefined,
    domain: "domain" in c ? c.domain : undefined,
  }));
}
