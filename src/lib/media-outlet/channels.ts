// src/lib/media-outlet/channels.ts
//
// 媒体字典账号矩阵 — Channel discriminated union。
// M1 (2026-05-12) 引入:取代旧的 domains[]/publicAccountNames[] 两个泛字段,
// 让每个媒体在不同平台上的账号都有结构化的识别符,供 tikhub adapter "账号模式"
// (M3) 和反查匹配 (M2 UI) 共同使用。
//
// 平台覆盖范围(Phase 1, 2026-05-12):
//   - website       : 媒体的门户网站(含 RSS feed)
//   - wechat_oa     : 微信公众号(ghid 必填,tikhub 用它拉文章列表)
//   - douyin        : 抖音号(secUid 必填,tikhub 用它拉用户视频)
//   - weibo         : 微博账号(uid 必填,tikhub 用它拉用户微博)
//   - kuaishou      : 快手号(userId 必填,tikhub 用它拉用户视频)
//
// 后续扩展(Phase 2+):xiaohongshu / bilibili / zhihu / video_account / xigua
// 加新平台时:在此文件 union 加分支 + zod schema 加分支,
// tikhub adapter 加对应 endpoint 映射,UI 加对应 Tab。

import { z } from "zod";

// ─── Channel 类型(discriminated union by `type`) ─────────────────────

export type ChannelType =
  | "website"
  | "wechat_oa"
  | "douyin"
  | "weibo"
  | "kuaishou";

export interface WebsiteChannel {
  type: "website";
  /** 完整 URL,如 https://www.people.com.cn */
  url: string;
  /** 域名(已含 host,用于 URL→outlet 反查),如 people.com.cn */
  domain: string;
  /** 该站点的 RSS feed URL,可选 */
  rssUrl?: string;
}

export interface WechatOaChannel {
  type: "wechat_oa";
  /** 公众号显示名,如"人民日报" */
  name: string;
  /** 公众号 ghid(gh_xxxxx),tikhub fetch_mp_article_list 用此 ID 拉文章列表 */
  ghid?: string;
  /** 微信号(可选,用户面识别) */
  wechatId?: string;
  /** 公众号二维码图片 URL(可选) */
  qrcodeUrl?: string;
}

export interface DouyinChannel {
  type: "douyin";
  /** 抖音昵称 */
  nickname: string;
  /** sec_user_id — 稳定 ID,tikhub fetch_user_post_videos 用它 */
  secUid: string;
  /** 数字 uid(可选,部分老接口需要) */
  uid?: string;
  /** 主页 URL,如 https://www.douyin.com/user/MS4wLjABAAAA... */
  profileUrl?: string;
}

export interface WeiboChannel {
  type: "weibo";
  /** 微博昵称 */
  nickname: string;
  /** uid 数字 ID,tikhub fetch_user_posts 用它 */
  uid: string;
  /** 主页 URL,如 https://weibo.com/u/2803301701 */
  profileUrl?: string;
}

export interface KuaishouChannel {
  type: "kuaishou";
  /** 快手昵称 */
  nickname: string;
  /** 主页 URL path 段,如 https://www.kuaishou.com/profile/{userId} 里的 userId */
  userId: string;
  /** 完整主页 URL */
  profileUrl?: string;
}

export type Channel =
  | WebsiteChannel
  | WechatOaChannel
  | DouyinChannel
  | WeiboChannel
  | KuaishouChannel;

// ─── Zod 校验 ────────────────────────────────────────────────────────

export const websiteChannelSchema = z.object({
  type: z.literal("website"),
  url: z.string().url("请填写合法的网站 URL"),
  domain: z.string().min(1, "域名不能为空"),
  rssUrl: z.string().url().optional(),
});

export const wechatOaChannelSchema = z.object({
  type: z.literal("wechat_oa"),
  name: z.string().min(1, "公众号名不能为空"),
  ghid: z
    .string()
    .regex(/^gh_[a-zA-Z0-9]+$/, "ghid 必须以 gh_ 开头(如 gh_a3d35d4c9d3f)")
    .optional(),
  wechatId: z.string().optional(),
  qrcodeUrl: z.string().url().optional(),
});

export const douyinChannelSchema = z.object({
  type: z.literal("douyin"),
  nickname: z.string().min(1, "抖音昵称不能为空"),
  secUid: z.string().min(1, "secUid 不能为空"),
  uid: z.string().optional(),
  profileUrl: z.string().url().optional(),
});

export const weiboChannelSchema = z.object({
  type: z.literal("weibo"),
  nickname: z.string().min(1, "微博昵称不能为空"),
  uid: z.string().regex(/^\d+$/, "微博 uid 必须是数字"),
  profileUrl: z.string().url().optional(),
});

export const kuaishouChannelSchema = z.object({
  type: z.literal("kuaishou"),
  nickname: z.string().min(1, "快手昵称不能为空"),
  userId: z.string().min(1, "快手 userId 不能为空"),
  profileUrl: z.string().url().optional(),
});

export const channelSchema = z.discriminatedUnion("type", [
  websiteChannelSchema,
  wechatOaChannelSchema,
  douyinChannelSchema,
  weiboChannelSchema,
  kuaishouChannelSchema,
]);

export const channelsArraySchema = z.array(channelSchema);

// ─── 工具函数 ────────────────────────────────────────────────────────

/**
 * 取该平台关联的"账号识别符"——tikhub 启动账号模式时校验用。
 * 不同平台用不同字段:wechat_oa.ghid / douyin.secUid / weibo.uid / kuaishou.userId。
 * website 没有"账号 ID",返回 domain;返回 null 表示该 channel 缺少必要识别符。
 */
export function getChannelIdentifier(channel: Channel): string | null {
  switch (channel.type) {
    case "website":
      return channel.domain || null;
    case "wechat_oa":
      return channel.ghid ?? null;
    case "douyin":
      return channel.secUid || null;
    case "weibo":
      return channel.uid || null;
    case "kuaishou":
      return channel.userId || null;
  }
}

/**
 * 取该 channel 的显示名(UI 渲染用)。
 * website 用 domain,其余用 nickname/name。
 */
export function getChannelDisplayName(channel: Channel): string {
  switch (channel.type) {
    case "website":
      return channel.domain;
    case "wechat_oa":
      return channel.name;
    case "douyin":
    case "weibo":
    case "kuaishou":
      return channel.nickname;
  }
}

/** 平台中文显示名(UI 用) */
export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  website: "网站",
  wechat_oa: "微信公众号",
  douyin: "抖音",
  weibo: "微博",
  kuaishou: "快手",
};

/** 平台支持自动采集的能力(M3 tikhub 账号模式用) */
export const CHANNEL_TIKHUB_SUPPORT: Record<
  ChannelType,
  { supported: boolean; endpoint?: string; identifierField: string }
> = {
  website: {
    supported: false,
    identifierField: "domain",
  },
  wechat_oa: {
    supported: true,
    endpoint: "/api/v1/wechat_mp/web/fetch_mp_article_list",
    identifierField: "ghid",
  },
  douyin: {
    supported: true,
    endpoint: "/api/v1/douyin/web/fetch_user_post_videos",
    identifierField: "secUid",
  },
  weibo: {
    supported: true,
    endpoint: "/api/v1/weibo/web/fetch_user_posts",
    identifierField: "uid",
  },
  kuaishou: {
    supported: true,
    // M3 实施时实测精确路径并补全
    endpoint: "/api/v1/kuaishou/web/...",
    identifierField: "userId",
  },
};
