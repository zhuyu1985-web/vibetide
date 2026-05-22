/**
 * Ayrshare webhook 处理：
 *   1. HMAC SHA256 验签（AYRSHARE_WEBHOOK_SECRET）
 *   2. 解析 payload → 按 (ayrsharePostId, platform) 找到对应 external_publications 行
 *   3. 更新 status = success | failed + platformPostId + platformPostUrl + completedAt
 *   4. 触发 article 汇总状态刷新（external/publication.completed 事件 → ayrshareWebhookHandler）
 *
 * 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.1
 */

import { createHmac, timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { externalPublications } from "@/db/schema";

import { requireAyrshareConfig } from "./client";
import { AyrshareSchemaError } from "./errors";
import {
  AyrshareWebhookPayloadSchema,
  type AyrshareWebhookPayload,
} from "./types";

export interface AyrshareWebhookHandleResult {
  /** 受影响的 article id（用于触发汇总事件） */
  articleId: string | null;
  /** 更新成功的 external_publications 行数 */
  updatedRows: number;
  /** webhook 顶层状态（"success" / "failed" / 未知则原样返回） */
  status: string;
}

/**
 * 验证 webhook 签名。
 *
 * Ayrshare 在 webhook header 上放 `x-ayrshare-signature` = `sha256=<hex>`。
 * 我们用配置的 secret 重算 raw body 的 HMAC，按 timing-safe 比较。
 */
export function verifyAyrshareSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  if (!provided) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * 处理 webhook payload —— 调用前必须先用 `verifyAyrshareSignature` 验签。
 *
 * 返回信息供 route handler 用于派发 inngest 事件。
 */
export async function handleAyrshareWebhook(
  payload: unknown,
): Promise<AyrshareWebhookHandleResult> {
  const parsed = AyrshareWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AyrshareSchemaError(
      `Ayrshare webhook payload 结构异常：${parsed.error.message}`,
    );
  }
  const data: AyrshareWebhookPayload = parsed.data;
  const ayrsharePostId = data.id;
  const now = new Date();

  // 顶层 errors[] 索引：同一平台可能在 errors 数组里
  const errorsByPlatform = new Map<string, { message?: string; code?: number | string }>();
  for (const e of data.errors ?? []) {
    if (e.platform) {
      errorsByPlatform.set(e.platform, { message: e.message, code: e.code });
    }
  }

  let updatedRows = 0;
  let articleId: string | null = null;

  for (const item of data.postIds ?? []) {
    const platform = item.platform;
    // 平台维度判定
    const platformErr = errorsByPlatform.get(platform);
    const isSuccess =
      !platformErr &&
      (!item.status || /success/i.test(item.status));

    const updates: Record<string, unknown> = {
      status: isSuccess ? "success" : "failed",
      platformPostId: item.id ?? null,
      platformPostUrl: item.postUrl ?? null,
      completedAt: now,
      updatedAt: now,
    };
    if (!isSuccess) {
      updates.errorCode = String(item.code ?? platformErr?.code ?? "platform_error");
      updates.errorMessage =
        item.errorMessage ??
        platformErr?.message ??
        `Ayrshare ${platform} 失败`;
    } else {
      updates.errorCode = null;
      updates.errorMessage = null;
    }

    const updated = await db
      .update(externalPublications)
      .set(updates)
      .where(
        and(
          eq(externalPublications.ayrsharePostId, ayrsharePostId),
          eq(externalPublications.platform, platform),
        ),
      )
      .returning({ id: externalPublications.id, articleId: externalPublications.articleId });

    for (const row of updated) {
      updatedRows += 1;
      if (!articleId) articleId = row.articleId;
    }
  }

  return {
    articleId,
    updatedRows,
    status: data.status ?? "unknown",
  };
}

/** 包装：route handler 一站式调 verify + handle */
export async function processAyrshareWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<AyrshareWebhookHandleResult> {
  const config = requireAyrshareConfig();
  if (!verifyAyrshareSignature(rawBody, signatureHeader, config.webhookSecret)) {
    throw new AyrshareSchemaError("Ayrshare webhook 签名校验失败");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    throw new AyrshareSchemaError(
      `Ayrshare webhook body 非 JSON：${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return handleAyrshareWebhook(payload);
}
