import "server-only";
import { inngest } from "@/inngest/client";
import { appendMessage } from "@/lib/dal/cowork-conversations";

/**
 * cowork 对话粘贴 URL → 落「正在导入」乐观卡片 + 派 cowork/link-import.requested 事件。
 * 后续抓取/分析/视频/听悟全部异步，由各 Inngest 函数往对话追加里程碑卡片。
 */
export async function dispatchCoworkLinkImport(input: {
  organizationId: string;
  conversationId: string;
  userId: string;
  urls: string[];
  userName?: string;
}): Promise<void> {
  await appendMessage(input.conversationId, {
    role: "assistant",
    kind: "import_card",
    content:
      input.urls.length > 1
        ? `⏳ 正在抓取 ${input.urls.length} 条稿件…`
        : "⏳ 正在抓取稿件…",
    meta: { stage: "queued", urls: input.urls },
  });

  await Promise.all(
    input.urls.map((url, i) =>
      inngest.send({
        // 去重 id：同会话同 url 不重复跑
        id: `cowork-import:${input.conversationId}:${Buffer.from(url)
          .toString("base64url")
          .slice(0, 40)}:${i}`,
        name: "cowork/link-import.requested",
        data: {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          userId: input.userId,
          url,
          sourceName: `对话导入·${input.userName ?? "用户"}`,
        },
      }),
    ),
  );
}
