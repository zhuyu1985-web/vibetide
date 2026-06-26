import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { fetchAndClassifyUrl, ingestArticleFromUrl } from "@/lib/articles/import";
import { appendMessage } from "@/lib/dal/cowork-conversations";

type Data = InngestEvents["cowork/link-import.requested"]["data"];

/** 核心逻辑（可单测）：抓取 → 分类 → 入库 → 收录卡 → fan-out 下游。 */
export async function runCoworkLinkImport(data: Data): Promise<void> {
  const classified = await fetchAndClassifyUrl(data.url);
  const r = await ingestArticleFromUrl({
    organizationId: data.organizationId,
    url: data.url,
    sourceName: data.sourceName,
    classified,
    importedFrom: {
      channel: "cowork",
      conversationId: data.conversationId,
      userId: data.userId,
    },
  });

  await appendMessage(data.conversationId, {
    role: "assistant",
    kind: "import_card",
    content: r.skipped ? `该链接已收录过《${r.title}》` : `✅ 已收录《${r.title}》`,
    meta: {
      stage: "ingested",
      articleId: r.articleId,
      title: r.title,
      mediaType: r.mediaType,
      sourceUrl: data.url,
    },
  });

  if (!r.articleId) return;

  // fan-out：结构化分析永远派（P2）；视频稿另派下载（P3）
  await inngest.send({
    name: "article/ai-analysis.requested",
    data: {
      organizationId: data.organizationId,
      articleId: r.articleId,
      conversationId: data.conversationId,
    },
  });

  if (classified.mediaType === "video") {
    await inngest.send({
      name: "article/video-ingest.requested",
      data: {
        organizationId: data.organizationId,
        articleId: r.articleId,
        conversationId: data.conversationId,
        url: data.url,
        videoSourceHint: classified.videoSourceHint,
      },
    });
  }
}

export const coworkLinkImport = inngest.createFunction(
  { id: "cowork-link-import", retries: 2 },
  { event: "cowork/link-import.requested" },
  async ({ event, step }) => {
    await step.run("import", () => runCoworkLinkImport(event.data));
    return { ok: true };
  },
);

/** 终态失败 → 往对话推失败卡片（镜像 channelLinkIngestFailureHandler）。 */
export const coworkLinkImportFailureHandler = inngest.createFunction(
  { id: "cowork-link-import-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const d = event.data as Record<string, unknown>;
    if (d?.function_id !== "cowork-link-import") return;
    const orig = (d?.event as { data?: Data } | undefined)?.data;
    const msg =
      ((d?.error as { message?: string } | undefined)?.message) ?? "未知错误";
    if (!orig) return;
    await step.run("notify", () =>
      appendMessage(orig.conversationId, {
        role: "assistant",
        kind: "import_card",
        content: `❌ 导入失败：${msg}`,
        meta: { stage: "failed", sourceUrl: orig.url },
      }),
    );
  },
);
