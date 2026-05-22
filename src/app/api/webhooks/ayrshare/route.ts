import { NextResponse, type NextRequest } from "next/server";

import { inngest } from "@/inngest/client";
import {
  AyrshareSchemaError,
  processAyrshareWebhook,
} from "@/lib/ayrshare";

/**
 * Ayrshare HTTPS webhook 接收入口。
 *
 *   POST /api/webhooks/ayrshare
 *
 * 流程：
 *   1. 读取 raw body + `x-ayrshare-signature` header
 *   2. `processAyrshareWebhook` 验签 + 更新 external_publications 行
 *   3. 派发 `external/publication.completed` 事件，由 `ayrshareWebhookHandler` 重算 article 汇总
 *
 * 失败处理：
 *   - 签名错误 / payload schema 错误 → 401 / 422，Ayrshare 会重试
 *   - 数据库错误 → 500，触发 Ayrshare 自身重试机制
 *
 * 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.3
 */

// Ayrshare webhook 不需要 session；明确 runtime + 禁缓存
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-ayrshare-signature");

  try {
    const result = await processAyrshareWebhook(rawBody, signature);

    // 派发汇总事件（即使本次没有匹配到行，也派发——便于运营观察）
    if (result.articleId) {
      await inngest.send({
        name: "external/publication.completed",
        data: {
          articleId: result.articleId,
          ayrsharePostId: extractAyrsharePostIdFromBody(rawBody),
          status: normalizeWebhookStatus(result.status),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      updatedRows: result.updatedRows,
      articleId: result.articleId,
    });
  } catch (err) {
    if (err instanceof AyrshareSchemaError) {
      const isSig = err.message.includes("签名");
      console.warn("[ayrshare-webhook]", err.message);
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: isSig ? 401 : 422 },
      );
    }
    console.error("[ayrshare-webhook] 处理失败", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

/** 健康检查；方便 Ayrshare 控制台测试连通性 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: "ayrshare-webhook" });
}

// ─── helpers ────────────────────────────────────────────────────────────────

function extractAyrsharePostIdFromBody(rawBody: string): string {
  try {
    const obj = JSON.parse(rawBody) as { id?: string };
    return obj.id ?? "";
  } catch {
    return "";
  }
}

function normalizeWebhookStatus(
  status: string,
): "success" | "failed" | "partial" {
  const s = status.toLowerCase();
  if (s.includes("success")) return "success";
  if (s.includes("partial")) return "partial";
  if (s.includes("fail") || s.includes("error")) return "failed";
  // Ayrshare 偶尔返回 "ok"
  if (s === "ok") return "success";
  return "partial";
}
