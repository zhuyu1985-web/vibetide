"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { count, sql } from "drizzle-orm";
import { db } from "@/db";
import { helpFeedback } from "@/db/schema";

/**
 * /help 文档反馈 server action。
 *
 * - 输入校验:docPath 非空、helpful 必填、comment ≤ 500 字
 * - 反滥用:同 IP 1 分钟内 > RATE_LIMIT 条记录直接静默假成功(避免给攻击者反馈)
 * - 隐私:不存明文 IP,只存 sha256(ip) hex
 * - 失败模式:校验失败 → { ok: false };限流命中 → { ok: true } 但不落表
 */
const RATE_LIMIT = Number(process.env.HELP_FEEDBACK_RATE_LIMIT ?? "10");

export async function submitDocFeedback(input: {
  docPath: string;
  helpful: boolean;
  comment?: string;
}): Promise<{ ok: boolean }> {
  // 1. 输入校验
  if (!input.docPath || typeof input.helpful !== "boolean") {
    return { ok: false };
  }
  if (input.comment && input.comment.length > 500) {
    return { ok: false };
  }

  // 2. 取 IP + UA(只用于哈希,不入明文)
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
  const userAgent = h.get("user-agent");

  // 3. 限流:同 IP 1 分钟 > RATE_LIMIT 条直接静默假成功
  const recent = await db
    .select({ count: count() })
    .from(helpFeedback)
    .where(
      sql`${helpFeedback.ipHash} = ${ipHash} AND ${helpFeedback.createdAt} > NOW() - INTERVAL '1 minute'`,
    );
  const cnt = Number(recent[0]?.count ?? 0);
  if (cnt > RATE_LIMIT) {
    return { ok: true };
  }

  // 4. 落表
  await db.insert(helpFeedback).values({
    docPath: input.docPath,
    helpful: input.helpful,
    comment: input.comment ?? null,
    userAgent: userAgent ?? null,
    ipHash,
  });

  return { ok: true };
}
