/**
 * Ayrshare API DTO + Zod schema 校验。
 *
 * 文档：https://www.ayrshare.com/docs/apis/post/post
 *
 * 平台 slug 严格锁定为 Ayrshare 官方枚举；新增平台需同时更新 SUPPORTED_PLATFORMS。
 */

import { z } from "zod";

/** Ayrshare 支持的全部平台 slug（与 plan §3.1 对齐） */
export const SUPPORTED_PLATFORMS = [
  "twitter",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "reddit",
  "bluesky",
  "gmb",
  "telegram",
] as const;

export type AyrsharePlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const AyrsharePlatformSchema = z.enum(SUPPORTED_PLATFORMS);

// ─── Request ────────────────────────────────────────────────────────────────

export interface AyrsharePostRequest {
  /** 主文案；不同平台会自动裁剪长度 */
  post: string;
  /** 目标平台数组 */
  platforms: AyrsharePlatform[];
  /** 配图 / 视频 URL（最多 9 张） */
  mediaUrls?: string[];
  /** 标签（不带 #，Ayrshare 自动拼接） */
  hashtags?: string[];
  /** 定时发布；不传则立即发 */
  scheduleDate?: string; // ISO 8601
  /** Ayrshare Business plan 多账号 profile key（可选） */
  profileKey?: string;
  /** 平台特定参数，键为平台 slug */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  platformOptions?: Record<string, any>;
}

// ─── Response ───────────────────────────────────────────────────────────────

/** 单个平台的发布结果（Ayrshare 在 postIds[] 中返回） */
export const AyrsharePostIdSchema = z.object({
  platform: AyrsharePlatformSchema,
  id: z.string().optional(),
  postUrl: z.string().url().optional(),
  status: z.string().optional(),
  /** 平台特定错误（如 Instagram 媒体校验失败） */
  errorMessage: z.string().optional(),
  code: z.union([z.number(), z.string()]).optional(),
});

export type AyrsharePostIdResult = z.infer<typeof AyrsharePostIdSchema>;

export const AyrsharePostResponseSchema = z.object({
  /** "success" | "error" — 顶层调用状态 */
  status: z.string(),
  /** Ayrshare 聚合 post id（跨平台统一），失败时可能缺失 */
  id: z.string().optional(),
  /** 各平台结果（成功 / 失败按 status 字段） */
  postIds: z.array(AyrsharePostIdSchema).optional(),
  /** Ayrshare 返回的错误对象（失败时） */
  errors: z
    .array(
      z.object({
        action: z.string().optional(),
        status: z.string().optional(),
        code: z.union([z.number(), z.string()]).optional(),
        message: z.string().optional(),
        platform: z.string().optional(),
      }),
    )
    .optional(),
  /** 顶层错误消息（HTTP 4xx/5xx 时） */
  message: z.string().optional(),
  code: z.union([z.number(), z.string()]).optional(),
  action: z.string().optional(),
});

export type AyrsharePostResponse = z.infer<typeof AyrsharePostResponseSchema>;

// ─── Webhook payload ────────────────────────────────────────────────────────

/**
 * Ayrshare webhook：当发布完成（成功或失败）回调 VibeTide。
 *
 * 字段沿用 POST /api/post 响应同构（id + postIds），额外加 type 区分事件类型。
 */
export const AyrshareWebhookPayloadSchema = z.object({
  /** "feed" | "social" | ... — Ayrshare 事件类型；我们关心 "feed"/"post"/"action" */
  type: z.string().optional(),
  action: z.string().optional(),
  /** Ayrshare 聚合 post id */
  id: z.string(),
  status: z.string().optional(),
  postIds: z.array(AyrsharePostIdSchema).optional(),
  errors: z
    .array(
      z.object({
        platform: z.string().optional(),
        message: z.string().optional(),
        code: z.union([z.number(), z.string()]).optional(),
      }),
    )
    .optional(),
  /** ISO 8601 时间戳 */
  created: z.string().optional(),
  updated: z.string().optional(),
});

export type AyrshareWebhookPayload = z.infer<typeof AyrshareWebhookPayloadSchema>;
