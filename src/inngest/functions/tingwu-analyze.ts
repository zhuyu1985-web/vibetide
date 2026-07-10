import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { db } from "@/db";
import { articles, mediaAssets, assetSegments, assetTags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isTingwuEnabled } from "@/lib/tingwu/config";
import { createTask, getTaskInfo, fetchResultJson } from "@/lib/tingwu/client";
import {
  parseTranscription,
  parseKeywords,
  parseAutoChapters,
} from "@/lib/tingwu/analyze";
import type { TingwuTranscriptionJson, TingwuTaskInfo } from "@/lib/tingwu/types";
import { appendMessage } from "@/lib/dal/cowork-conversations";

type Data = InngestEvents["media/tingwu-analyze.requested"]["data"];

/** 轮询退避：30s/30s/60s/60s/120s/120s/300s/300s（首结果通常分钟级，封顶 5min）。 */
const POLL_DELAYS_MS = [
  30000, 30000, 60000, 60000, 120000, 120000, 300000, 300000,
] as const;

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

export const tingwuAnalyze = inngest.createFunction(
  { id: "tingwu-analyze", name: "[听悟] 视频转写理解", concurrency: { limit: 3 }, retries: 1 },
  { event: "media/tingwu-analyze.requested" },
  async ({ event, step, logger }) => {
    const data = event.data as Data;

    if (!isTingwuEnabled()) {
      logger.info("通义听悟未配置，跳过视频分析");
      return { skipped: true };
    }

    await step.run("mark-processing", async () => {
      await db
        .update(mediaAssets)
        .set({ understandingStatus: "processing" })
        .where(eq(mediaAssets.id, data.assetId));
    });

    const taskId = await step.run("submit", async () => {
      const { taskId } = await createTask({ fileUrl: data.publicUrl });
      const asset = await db.query.mediaAssets.findFirst({
        where: eq(mediaAssets.id, data.assetId),
        columns: { catalogData: true },
      });
      const existing = (asset?.catalogData ?? {}) as Record<string, unknown>;
      await db
        .update(mediaAssets)
        .set({
          catalogData: {
            ...existing,
            tingwu: { taskId, submittedAt: new Date().toISOString() },
          },
        })
        .where(eq(mediaAssets.id, data.assetId));
      return taskId;
    });

    // 轮询
    let result: TingwuTaskInfo["result"] | null = null;
    for (let attempt = 0; attempt < POLL_DELAYS_MS.length; attempt++) {
      await step.sleep(`wait-${attempt + 1}`, `${POLL_DELAYS_MS[attempt]}ms`);
      const info = await step.run(`poll-${attempt + 1}`, () => getTaskInfo(taskId));

      if (info.status === "COMPLETED") {
        result = info.result ?? {};
        break;
      }
      if (info.status === "FAILED" || info.status === "INVALID") {
        await step.run("mark-failed", async () => {
          await db
            .update(mediaAssets)
            .set({ understandingStatus: "failed" })
            .where(eq(mediaAssets.id, data.assetId));
          await card(
            data.conversationId,
            `❌ 听悟分析失败：${info.errorMessage ?? info.status}`,
            { stage: "failed", assetId: data.assetId, articleId: data.articleId },
          );
        });
        return { ok: false, status: info.status };
      }
      // ONGOING → 继续下一轮
    }

    if (!result) {
      await step.run("notify-slow", () =>
        card(data.conversationId, "⏳ 听悟分析较慢，完成后会自动回填", {
          stage: "video_stored",
          assetId: data.assetId,
          articleId: data.articleId,
        }),
      );
      return { ok: false, pending: true };
    }

    await step.run("writeback", async () => {
      const r = result!;
      const [transcriptionJson, summarizationJson, chaptersJson] =
        await Promise.all([
          r.Transcription ? fetchResultJson(r.Transcription) : null,
          r.Summarization ? fetchResultJson(r.Summarization) : null,
          r.AutoChapters ? fetchResultJson(r.AutoChapters) : null,
        ]);

      const segments = transcriptionJson
        ? parseTranscription(transcriptionJson as TingwuTranscriptionJson)
        : [];
      const keywords = [
        ...parseKeywords(summarizationJson ?? {}),
        ...parseKeywords(chaptersJson ?? {}),
      ];
      const uniqKw = [...new Set(keywords)].filter(Boolean);
      const chapters = chaptersJson ? parseAutoChapters(chaptersJson) : [];

      if (segments.length) {
        await db.insert(assetSegments).values(
          segments.map((s) => ({
            assetId: data.assetId,
            transcript: s.transcript,
            startTimeSeconds: s.startTimeSeconds,
            endTimeSeconds: s.endTimeSeconds,
            segmentOrder: s.segmentOrder,
          })),
        );
      }
      if (uniqKw.length) {
        await db.insert(assetTags).values(
          uniqKw.map((label) => ({
            assetId: data.assetId,
            category: "topic" as const,
            label,
            source: "ai_auto" as const,
            confidence: 0.8,
          })),
        );
      }

      const asset = await db.query.mediaAssets.findFirst({
        where: eq(mediaAssets.id, data.assetId),
        columns: { catalogData: true },
      });
      const existing = (asset?.catalogData ?? {}) as Record<string, unknown>;
      const existingTingwu = (existing.tingwu ?? {}) as Record<string, unknown>;
      await db
        .update(mediaAssets)
        .set({
          understandingStatus: "completed",
          understandingProgress: 100,
          totalTags: uniqKw.length,
          processedAt: new Date(),
          catalogData: {
            ...existing,
            tingwu: { ...existingTingwu, completedAt: new Date().toISOString() },
          },
        })
        .where(eq(mediaAssets.id, data.assetId));

      if (data.articleId) {
        await db
          .update(articles)
          .set({ transcript: transcriptionJson ?? segments, chapters })
          .where(eq(articles.id, data.articleId));
      }

      await card(
        data.conversationId,
        `📝 听悟分析完成：转写 ${segments.length} 段${uniqKw.length ? ` · ${uniqKw.length} 关键词` : ""}${chapters.length ? ` · ${chapters.length} 章节` : ""}`,
        { stage: "understood", assetId: data.assetId, articleId: data.articleId },
      );
    });

    return { ok: true, taskId };
  },
);

/** 终态失败（client/网络异常抛出）→ 标 failed。 */
export const tingwuAnalyzeFailureHandler = inngest.createFunction(
  { id: "tingwu-analyze-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const d = event.data as Record<string, unknown>;
    if (d?.function_id !== "tingwu-analyze") return;
    const orig = (d?.event as { data?: Data } | undefined)?.data;
    if (!orig) return;
    await step.run("mark-failed", async () => {
      await db
        .update(mediaAssets)
        .set({ understandingStatus: "failed" })
        .where(eq(mediaAssets.id, orig.assetId));
      await card(orig.conversationId, "❌ 听悟分析失败，可稍后重试", {
        stage: "failed",
        assetId: orig.assetId,
        articleId: orig.articleId,
      });
    });
  },
);
