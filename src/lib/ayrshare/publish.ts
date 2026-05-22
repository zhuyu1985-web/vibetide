/**
 * Ayrshare 外站发布主入口。
 *
 * 流程：
 *   1. 读 article（必须 language='en'，否则 AyrshareConfigError）
 *   2. 对 `platforms` 数组每个平台插一条 external_publications 记录（status='submitting'）
 *   3. 调 AyrshareClient.post 一次性多平台发布
 *   4. 收到统一 ayrsharePostId 后写回所有记录，按 postIds[].status 分别更新成功/失败
 *   5. 顶层异常分类后批量更新 status='failed' + errorCode + errorMessage
 *   6. 派发 external/publication.retry 事件（可重试错误）
 *
 * 对照 `src/lib/cms/publish/publish-article.ts` 的状态机风格。
 */

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { articles, externalPublications } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

import { AyrshareClient, requireAyrshareConfig } from "./client";
import {
  AyrshareConfigError,
  AyrshareError,
  classifyAyrshareError,
  isRetriableAyrshareError,
} from "./errors";
import {
  AyrsharePlatformSchema,
  type AyrsharePlatform,
  type AyrsharePostIdResult,
} from "./types";

export type ExternalPublicationRow = InferSelectModel<typeof externalPublications>;

export interface PublishToAyrshareInput {
  articleId: string;
  /** 平台 slug 数组；至少 1 个 */
  platforms: string[];
  /** 触发用户 id（写 operator_id） */
  operatorId: string;
}

export interface PublishToAyrshareResult {
  /** 本次产生的 external_publications 行（每平台一条） */
  submissions: ExternalPublicationRow[];
  /** Ayrshare 聚合 post id；失败时可能为空 */
  ayrsharePostId?: string;
  /** 是否整体成功（即 client.post 没抛错） */
  success: boolean;
  /** 失败时的错误分类 */
  error?: {
    stage: ReturnType<typeof classifyAyrshareError>;
    message: string;
    retriable: boolean;
  };
}

/**
 * 把一篇英文稿件发到指定外站平台数组。
 *
 * 注意：调用方需保证已通过 `requireAuth()` 鉴权 + 操作权限校验；本函数只关注 IO 流。
 */
export async function publishToAyrshare(
  input: PublishToAyrshareInput,
): Promise<PublishToAyrshareResult> {
  // 1. 输入校验
  if (!input.platforms.length) {
    throw new AyrshareConfigError("platforms 不能为空");
  }
  const platforms: AyrsharePlatform[] = input.platforms.map((p) => {
    const parsed = AyrsharePlatformSchema.safeParse(p);
    if (!parsed.success) {
      throw new AyrshareConfigError(`不支持的平台 slug: ${p}`);
    }
    return parsed.data;
  });

  // 2. 加载文章
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, input.articleId))
    .limit(1);

  if (!article) {
    throw new AyrshareConfigError(`article 不存在: ${input.articleId}`);
  }
  if (article.language !== "en") {
    throw new AyrshareConfigError(
      `article ${article.id} language=${article.language}，只支持 language='en' 的稿件外发`,
    );
  }
  if (!article.body && !article.summary && !article.title) {
    throw new AyrshareConfigError(
      `article ${article.id} 无 title/body/summary，无法生成发布文案`,
    );
  }

  // 3. 组装 Ayrshare payload
  const post = buildPostText(article);
  const mediaUrls = collectMediaUrls(article);
  const hashtags = collectHashtags(article);
  const requestPayload = {
    post,
    platforms,
    mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    hashtags: hashtags.length ? hashtags : undefined,
  };

  // 4. 为每个平台插入一条 submitting 记录
  const now = new Date();
  const insertRows = platforms.map((platform) => ({
    organizationId: article.organizationId,
    articleId: article.id,
    platform,
    status: "submitting" as const,
    requestPayload,
    operatorId: input.operatorId,
    submittedAt: now,
  }));

  const submissions = await db
    .insert(externalPublications)
    .values(insertRows)
    .returning();

  const submissionIds = submissions.map((s) => s.id);

  // 5. 调 Ayrshare
  const config = requireAyrshareConfig();
  const client = new AyrshareClient({
    apiKey: config.apiKey,
    profileKey: config.defaultProfile,
  });

  try {
    const res = await client.post(requestPayload);
    const ayrsharePostId = res.id ?? "";

    // 5.1 按 postIds[].status 分别更新每平台行
    const postIdsByPlatform = indexByPlatform(res.postIds ?? []);

    const updated: ExternalPublicationRow[] = [];
    for (const sub of submissions) {
      const platformResult = postIdsByPlatform.get(sub.platform);
      const isPlatformSuccess =
        !!platformResult &&
        (!platformResult.status || /success/i.test(platformResult.status));

      const [row] = await db
        .update(externalPublications)
        .set({
          ayrsharePostId: ayrsharePostId || null,
          status: isPlatformSuccess ? "success" : "failed",
          platformPostId: platformResult?.id ?? null,
          platformPostUrl: platformResult?.postUrl ?? null,
          errorCode:
            isPlatformSuccess || !platformResult
              ? null
              : String(platformResult.code ?? "platform_error"),
          errorMessage: isPlatformSuccess
            ? null
            : platformResult?.errorMessage ?? "Ayrshare 未返回该平台结果",
          rawResponse: res as unknown as Record<string, unknown>,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(externalPublications.id, sub.id))
        .returning();
      if (row) updated.push(row);
    }

    // 5.2 汇总状态写回 article
    await rollupArticleStatus(article.id);

    return {
      submissions: updated,
      ayrsharePostId,
      success: true,
    };
  } catch (err) {
    const stage = classifyAyrshareError(err);
    const message = err instanceof Error ? err.message : String(err);
    const retriable = isRetriableAyrshareError(err);

    // 6. 整批标记失败
    await db
      .update(externalPublications)
      .set({
        status: "failed",
        errorCode: `ayrshare_${stage}`,
        errorMessage: message,
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          inArray(externalPublications.id, submissionIds),
          eq(externalPublications.status, "submitting"),
        ),
      );

    await rollupArticleStatus(article.id);

    // 7. 派发重试事件（最多 3 次，由 externalPublishRetry 处理）
    if (retriable) {
      for (const subId of submissionIds) {
        await triggerPublishRetry(subId);
      }
    }

    // 顶层异常仍抛出，让 server action 能感知
    if (!(err instanceof AyrshareError)) {
      throw new AyrshareError(`publishToAyrshare failed: ${message}`);
    }
    throw err;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function buildPostText(article: InferSelectModel<typeof articles>): string {
  // 优先 summary（短文案适合社交平台），否则 title + body 首段
  const summary = (article.summary ?? "").trim();
  if (summary) return summary;
  const title = (article.title ?? "").trim();
  const bodyFirstPara = (article.body ?? "")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)[0]
    ?? "";
  return [title, bodyFirstPara].filter(Boolean).join("\n\n");
}

function collectMediaUrls(article: InferSelectModel<typeof articles>): string[] {
  const urls: string[] = [];
  // 仅 schema 中存在的字段；封面、画廊在 v1 阶段不直接拉取（需要 article-assets 联查），
  // 这里只支持 content 里显式列出的 cover/media url。
  const content = article.content as
    | { coverImageUrl?: string; mediaUrls?: string[] }
    | null;
  if (content?.coverImageUrl) urls.push(content.coverImageUrl);
  if (Array.isArray(content?.mediaUrls)) urls.push(...content.mediaUrls);
  return Array.from(new Set(urls)).slice(0, 9);
}

function collectHashtags(article: InferSelectModel<typeof articles>): string[] {
  const tags = Array.isArray(article.tags) ? article.tags : [];
  return tags
    .map((t) => String(t).replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

function indexByPlatform(
  postIds: AyrsharePostIdResult[],
): Map<string, AyrsharePostIdResult> {
  const m = new Map<string, AyrsharePostIdResult>();
  for (const p of postIds) {
    m.set(p.platform, p);
  }
  return m;
}

/**
 * 根据当前 article 关联的全部 external_publications 行，重算 article.externalPublishStatus。
 *
 *   - 全部 success → "published"
 *   - 全部 failed → "failed"
 *   - 至少 1 个 success 且至少 1 个 failed → "partial"
 *   - 否则（含 submitting / retrying） → "pending"
 */
export async function rollupArticleStatus(articleId: string): Promise<void> {
  const rows = await db
    .select({ status: externalPublications.status })
    .from(externalPublications)
    .where(eq(externalPublications.articleId, articleId));

  if (!rows.length) {
    await db
      .update(articles)
      .set({ externalPublishStatus: null, updatedAt: new Date() })
      .where(eq(articles.id, articleId));
    return;
  }

  const success = rows.filter((r) => r.status === "success").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const pending = rows.length - success - failed;

  let next: string;
  if (pending > 0) {
    next = "pending";
  } else if (failed === 0) {
    next = "published";
  } else if (success === 0) {
    next = "failed";
  } else {
    next = "partial";
  }

  await db
    .update(articles)
    .set({ externalPublishStatus: next, updatedAt: new Date() })
    .where(eq(articles.id, articleId));
}

/** 派发 Inngest 重试事件，由 `externalPublishRetry` 函数消费 */
async function triggerPublishRetry(publicationId: string): Promise<void> {
  const { inngest } = await import("@/inngest/client");
  await inngest.send({
    name: "external/publication.retry",
    data: { publicationId },
  });
}
