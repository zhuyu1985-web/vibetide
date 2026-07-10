import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { db } from "@/db";
import { articles, articleAssets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { detectVideoSource } from "@/lib/articles/video-source";
import { storeRemoteMediaToTos } from "@/lib/aigc/store-media";
import { isTingwuEnabled } from "@/lib/tingwu/config";
import { appendMessage } from "@/lib/dal/cowork-conversations";

type Data = InngestEvents["article/video-ingest.requested"]["data"];

/** 单文件下载上限：超过仅标记 + 存源链接（避免全量进内存 OOM）。 */
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

async function card(
  conversationId: string | undefined,
  content: string,
  meta: Record<string, unknown>,
): Promise<void> {
  if (!conversationId) return;
  await appendMessage(conversationId, {
    role: "assistant",
    kind: "import_card",
    content,
    meta,
  });
}

/** 核心逻辑：解析视频源 → 大小护栏 → 下载到素材库 → 关联 → 派听悟。 */
export async function runArticleVideoIngest(data: Data): Promise<void> {
  await db
    .update(articles)
    .set({ transcodingStatus: "processing" })
    .where(eq(articles.id, data.articleId));

  const vs = await detectVideoSource(data.url, data.videoSourceHint);

  // 流媒体 / 无直链 / 平台 JS 渲染拿不到 → 降级：标记 + 存源链接 + 提示
  if (vs.kind !== "direct" || !vs.videoUrl) {
    await db
      .update(articles)
      .set({ transcodingStatus: "failed" })
      .where(eq(articles.id, data.articleId));
    await card(
      data.conversationId,
      vs.kind === "stream"
        ? "🎬 检测到视频但为流媒体(m3u8)，未自动下载，已保留源链接"
        : "🎬 未能解析出可下载视频源，已保留源链接",
      {
        stage: "video_skipped",
        articleId: data.articleId,
        sourceUrl: data.url,
        platform: vs.platform,
      },
    );
    return;
  }

  // 大小护栏：HEAD 探 content-length
  try {
    const head = await fetch(vs.videoUrl, { method: "HEAD" });
    const len = Number(head.headers.get("content-length") || 0);
    if (len > MAX_VIDEO_BYTES) {
      await db
        .update(articles)
        .set({ transcodingStatus: "failed" })
        .where(eq(articles.id, data.articleId));
      await card(
        data.conversationId,
        `🎬 视频过大（${(len / 1024 / 1024).toFixed(0)}MB > 500MB），未自动下载，已保留源链接`,
        { stage: "video_skipped", articleId: data.articleId, sourceUrl: data.url },
      );
      return;
    }
  } catch {
    // HEAD 失败不阻断，继续尝试下载
  }

  const article = await db.query.articles.findFirst({
    where: eq(articles.id, data.articleId),
    columns: { title: true },
  });
  const title = article?.title ?? "视频稿";

  const { assetId, publicUrl } = await storeRemoteMediaToTos(
    vs.videoUrl,
    {
      organizationId: data.organizationId,
      articleId: data.articleId,
      title,
      mediaType: "video",
    },
    {
      keyPrefix: "imported",
      source: "article_video",
      thumbnailUrl: vs.thumbnailUrl,
      durationSeconds: vs.durationMs ? Math.round(vs.durationMs / 1000) : undefined,
    },
  );

  await db
    .insert(articleAssets)
    .values({ articleId: data.articleId, assetId, usageType: "video" });
  await db
    .update(articles)
    .set({ transcodingStatus: "done" })
    .where(eq(articles.id, data.articleId));

  await card(data.conversationId, "🎬 视频已入素材库", {
    stage: "video_stored",
    articleId: data.articleId,
    assetId,
    sourceUrl: data.url,
  });

  // 听悟就绪才派；未配置则到此为止（视频已入库）
  if (isTingwuEnabled()) {
    await inngest.send({
      name: "media/tingwu-analyze.requested",
      data: {
        organizationId: data.organizationId,
        assetId,
        articleId: data.articleId,
        conversationId: data.conversationId,
        publicUrl,
      },
    });
  }
}

export const articleVideoIngest = inngest.createFunction(
  { id: "article-video-ingest", retries: 2 },
  { event: "article/video-ingest.requested" },
  async ({ event, step }) => {
    await step.run("ingest-video", () => runArticleVideoIngest(event.data));
    return { ok: true };
  },
);

export const articleVideoIngestFailureHandler = inngest.createFunction(
  { id: "article-video-ingest-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const d = event.data as Record<string, unknown>;
    if (d?.function_id !== "article-video-ingest") return;
    const orig = (d?.event as { data?: Data } | undefined)?.data;
    if (!orig) return;
    await step.run("mark-failed", async () => {
      await db
        .update(articles)
        .set({ transcodingStatus: "failed" })
        .where(eq(articles.id, orig.articleId));
      await card(orig.conversationId, "❌ 视频下载失败，已保留源链接", {
        stage: "failed",
        articleId: orig.articleId,
        sourceUrl: orig.url,
      });
    });
  },
);
