import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { ingestLinkToArticle } from "@/lib/channels/ingest-link-to-article";
import { postToSessionWebhook } from "@/lib/channels/session-webhook";
import { recordOutboundMessage } from "@/app/actions/channels";
import { setSessionLastArticleId } from "@/lib/dal/channel-sessions";

type LinkIngestData = InngestEvents["channel/link-ingest.requested"]["data"];

/** 核心逻辑（可单测）：抓取入库 + 成功/去重回执。 */
export async function runIngestAndReply(data: LinkIngestData): Promise<void> {
  const result = await ingestLinkToArticle({
    organizationId: data.organizationId,
    url: data.url,
    sourceName: data.sourceName,
    channelContext: {
      platform: data.platform,
      configId: data.configId,
      chatId: data.chatId,
      externalUserId: data.externalUserId,
      externalMessageId: data.externalMessageId,
    },
  });

  // 收稿成功（新建或去重命中已有稿）→ 把 articleId 写回会话，供后续配图/发布分支使用
  if (result.articleId) {
    // fire-and-forget：不阻断回执，失败静默（会话少了 articleId 顶多降级提示）
    setSessionLastArticleId(
      { configId: data.configId, chatId: data.chatId, externalUserId: data.externalUserId },
      result.articleId,
    ).catch(() => undefined);
  }

  if (!data.replyWebhook) return;

  const link = result.articleId
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/articles/${result.articleId}`
    : undefined;
  const content = result.skipped
    ? `该链接已收录过《${result.title}》`
    : `✅ 已收录《${result.title}》`;

  await postToSessionWebhook(data.replyWebhook, {
    type: link ? "card" : "text",
    title: "收稿结果",
    content,
    actions: link ? [{ label: "查看稿件", url: link }] : undefined,
  });
}

/** 终态失败回执（重试耗尽后调用）：推 ❌ 到群 + 记 failed 日志。 */
export async function notifyIngestFailure(
  data: LinkIngestData,
  errorMsg: string
): Promise<void> {
  const content = `❌ 抓取失败：${errorMsg}，可手动在系统添加。`;
  if (data.replyWebhook) {
    await postToSessionWebhook(data.replyWebhook, { type: "text", title: "收稿结果", content });
  }
  await recordOutboundMessage({
    organizationId: data.organizationId,
    configId: data.configId,
    platform: data.platform,
    externalUserId: data.externalUserId || undefined,
    chatId: data.chatId || undefined,
    content: { text: content },
    status: "failed",
  });
}

export const channelLinkIngest = inngest.createFunction(
  { id: "channel-link-ingest", retries: 2 },
  { event: "channel/link-ingest.requested" },
  async ({ event, step }) => {
    await step.run("ingest-and-reply", () => runIngestAndReply(event.data));
    return { ok: true };
  }
);

/**
 * 终态失败处理 —— 订阅 inngest/function.failed，仅认领本函数的失败。
 * 镜像本仓 executeMissionTaskFailureHandler 的写法。
 */
export const channelLinkIngestFailureHandler = inngest.createFunction(
  { id: "channel-link-ingest-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const fnId = (event.data as Record<string, unknown>)?.function_id;
    if (fnId !== "channel-link-ingest") return;
    const originalEvent = (event.data as Record<string, unknown>)?.event as
      | { data?: LinkIngestData }
      | undefined;
    const errorMsg =
      ((event.data as Record<string, unknown>)?.error as { message?: string })?.message ??
      "未知错误";
    const data = originalEvent?.data;
    if (!data) return;
    await step.run("notify-failure", () => notifyIngestFailure(data, errorMsg));
  }
);
