import { and, eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { externalPublications } from "@/db/schema";
import {
  AyrshareClient,
  classifyAyrshareError,
  isRetriableAyrshareError,
  requireAyrshareConfig,
  rollupArticleStatus,
  AyrsharePlatformSchema,
  type AyrsharePostRequest,
} from "@/lib/ayrshare";

/**
 * 最多重试 3 次；加上首次发布共 4 次尝试。
 * 对照 `cms-publish-retry.ts` 的指数 backoff 风格。
 */
const MAX_RETRY_COUNT = 3;

/** 每次重试前等待的延迟（ms）：30s → 2min → 10min。 */
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000] as const;

/**
 * 失败 publication 行的重试。
 *
 * 触发：`publishToAyrshare` 内部捕获可重试错误时派发 `external/publication.retry` 事件。
 * 行为：
 *   1. 读 publication 行；若状态非 failed/retrying 则 skip
 *   2. 读取并自增 requestPayload.attempts；超过 MAX 直接返回 exhausted
 *   3. 按 attempt index 做指数 backoff
 *   4. 用 requestPayload.post/platforms/mediaUrls/hashtags 重新调 Ayrshare
 *   5. 成功 → 更新 status='success'；失败可重试 → 再派发自身一次
 *
 * 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.3
 */
export const externalPublishRetry = inngest.createFunction(
  {
    id: "external-publish-retry",
    name: "[Ayrshare] 外站发布失败重试",
    concurrency: { limit: 10 },
    retries: 0, // 本函数自身管理重试节奏
  },
  { event: "external/publication.retry" },
  async ({ event, step, logger }) => {
    const { publicationId } = event.data;

    const pub = await step.run("load-publication", async () => {
      const [row] = await db
        .select()
        .from(externalPublications)
        .where(eq(externalPublications.id, publicationId))
        .limit(1);
      return row ?? null;
    });

    if (!pub) {
      logger.warn(`external-publish-retry: publication ${publicationId} not found`);
      return { skipped: true };
    }

    if (pub.status !== "failed" && pub.status !== "retrying") {
      logger.info(
        `external-publish-retry: publication ${publicationId} status=${pub.status}, skip`,
      );
      return { skipped: true };
    }

    const meta = extractRetryMeta(pub.requestPayload);
    const attempts = meta.attempts ?? 0;
    if (attempts >= MAX_RETRY_COUNT) {
      logger.warn(
        `external-publish-retry: publication ${publicationId} attempts=${attempts}, exhausted`,
      );
      return { exhausted: true };
    }

    const delayMs = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)];
    await step.sleep("retry-delay", `${delayMs}ms`);

    // 切换为 retrying + 自增 attempts
    await step.run("mark-retrying", async () => {
      const nextPayload = {
        ...meta.payload,
        attempts: attempts + 1,
      };
      await db
        .update(externalPublications)
        .set({
          status: "retrying",
          requestPayload: nextPayload as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(externalPublications.id, publicationId));
    });

    // 重发：单平台模式（这次只发当前行的 platform；多平台聚合在初次调用里）
    return await step.run("republish", async () => {
      const config = requireAyrshareConfig();
      const client = new AyrshareClient({
        apiKey: config.apiKey,
        profileKey: config.defaultProfile,
      });

      const platformParsed = AyrsharePlatformSchema.safeParse(pub.platform);
      if (!platformParsed.success) {
        await markFailed(publicationId, "config", `unsupported platform ${pub.platform}`);
        return { success: false, error: `unsupported platform ${pub.platform}` };
      }

      const request: AyrsharePostRequest = {
        post: meta.payload.post ?? "",
        platforms: [platformParsed.data],
        mediaUrls: meta.payload.mediaUrls,
        hashtags: meta.payload.hashtags,
      };

      try {
        const res = await client.post(request);
        const platformResult = (res.postIds ?? []).find(
          (p) => p.platform === platformParsed.data,
        );
        const ok =
          !!platformResult &&
          (!platformResult.status || /success/i.test(platformResult.status));

        await db
          .update(externalPublications)
          .set({
            ayrsharePostId: res.id ?? pub.ayrsharePostId ?? null,
            status: ok ? "success" : "failed",
            platformPostId: platformResult?.id ?? null,
            platformPostUrl: platformResult?.postUrl ?? null,
            errorCode: ok
              ? null
              : String(platformResult?.code ?? "platform_error"),
            errorMessage: ok
              ? null
              : platformResult?.errorMessage ?? "Ayrshare 未返回该平台结果",
            rawResponse: res as unknown as Record<string, unknown>,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(externalPublications.id, publicationId));

        await rollupArticleStatus(pub.articleId);

        logger.info(
          `external-publish-retry: publication ${publicationId} attempt=${attempts + 1} → ${ok ? "success" : "failed"}`,
        );

        // 失败但仍可重试（平台层 error）→ 再次派发自身
        if (!ok && attempts + 1 < MAX_RETRY_COUNT) {
          await inngest.send({
            name: "external/publication.retry",
            data: { publicationId },
          });
        }

        return { success: ok, attempt: attempts + 1 };
      } catch (err) {
        const stage = classifyAyrshareError(err);
        const message = err instanceof Error ? err.message : String(err);
        const retriable = isRetriableAyrshareError(err);

        await markFailed(publicationId, stage, message);
        await rollupArticleStatus(pub.articleId);

        if (retriable && attempts + 1 < MAX_RETRY_COUNT) {
          await inngest.send({
            name: "external/publication.retry",
            data: { publicationId },
          });
        }

        return { success: false, error: message, stage };
      }
    });
  },
);

// ─── helpers ────────────────────────────────────────────────────────────────

interface RetryMeta {
  attempts: number;
  payload: {
    post?: string;
    platforms?: string[];
    mediaUrls?: string[];
    hashtags?: string[];
    [key: string]: unknown;
  };
}

function extractRetryMeta(raw: unknown): RetryMeta {
  if (!raw || typeof raw !== "object") {
    return { attempts: 0, payload: {} };
  }
  const obj = raw as Record<string, unknown>;
  const attempts = typeof obj.attempts === "number" ? obj.attempts : 0;
  return { attempts, payload: obj };
}

async function markFailed(
  publicationId: string,
  stage: string,
  message: string,
): Promise<void> {
  await db
    .update(externalPublications)
    .set({
      status: "failed",
      errorCode: `ayrshare_${stage}`,
      errorMessage: message,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(externalPublications.id, publicationId),
        // 防御性：只更新还在 retrying 的，避免覆盖人工干预
        eq(externalPublications.status, "retrying"),
      ),
    );
}
