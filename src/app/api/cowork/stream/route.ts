import { streamText } from "ai";

import { submitCoworkMessage } from "@/app/actions/cowork-submit";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  claimInitialConversationProcessing,
  finishInitialConversationProcessing,
  updateConversationTextMessage,
} from "@/lib/dal/cowork-conversations";
import { getDefaultModel, getLanguageModel } from "@/lib/agent/model-router";

export const maxDuration = 120;

function sseResponse(
  run: (
    send: (event: string, data: Record<string, unknown>) => void,
  ) => Promise<void>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // 客户端离开后仍让模型完成并持久化，避免留下空占位消息。
        }
      };
      try {
        await run(send);
      } finally {
        try {
          controller.close();
        } catch {
          // 流已由客户端关闭。
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const orgId = await getCurrentUserOrg();
  if (!orgId) return new Response("Organization not found", { status: 403 });

  const body = (await request.json()) as {
    conversationId?: string;
    message?: string;
    initial?: boolean;
  };
  const conversationId = body.conversationId?.trim();
  if (!conversationId) return new Response("缺少会话 ID", { status: 400 });

  // 立刻进入 SSE：先推阶段状态，再做意图识别（仍保留 15 秒超时）与正文流式生成。
  return sseResponse(async (send) => {
    let assistantMessageId: string | null = null;
    try {
      send("status", {
        phase: "intent_recognizing",
        label: "正在识别意图…",
      });

      let prompt = body.message?.trim() ?? "";
      if (body.initial) {
        const claimed = await claimInitialConversationProcessing(
          orgId,
          user.id,
          conversationId,
        );
        if (!claimed) {
          send("result", { kind: "noop" });
          send("done", {});
          return;
        }
        prompt = claimed.prompt;
      }
      if (!prompt) throw new Error("消息不能为空");

      const prepared = await submitCoworkMessage(conversationId, prompt, {
        userMessageAlreadyPersisted: body.initial === true,
      });
      if (!prepared.ok) throw new Error(prepared.error);

      if (prepared.kind !== "stream") {
        if (body.initial) {
          await finishInitialConversationProcessing(
            orgId,
            user.id,
            conversationId,
            "completed",
          );
        }
        send("result", prepared);
        send("done", {});
        return;
      }

      assistantMessageId = prepared.messageId;
      send("result", prepared);
      send("stream-start", { messageId: assistantMessageId });
      send("status", {
        phase: "generating",
        label: "正在生成回复…",
      });

      // 意图识别完成后立刻开正文 token 流；客户端边收边渲染，不等待完整正文。
      const result = streamText({
        model: getLanguageModel({
          provider: "openai",
          model: getDefaultModel(),
          temperature: 0.7,
          maxTokens: 800,
        }),
        system: "你是融媒云的 AI 助手，用简洁专业的中文回答用户。",
        prompt,
        maxOutputTokens: 800,
      });

      let fullText = "";
      for await (const delta of result.textStream) {
        fullText += delta;
        send("text-delta", { text: delta });
      }
      if (!fullText.trim()) {
        fullText = "好的，我在。需要我帮你执行什么任务吗？";
        send("text-delta", { text: fullText });
      }

      await updateConversationTextMessage(
        conversationId,
        assistantMessageId,
        fullText,
        "completed",
      );
      if (body.initial) {
        await finishInitialConversationProcessing(
          orgId,
          user.id,
          conversationId,
          "completed",
        );
      }
      send("done", { messageId: assistantMessageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (assistantMessageId) {
        await updateConversationTextMessage(
          conversationId,
          assistantMessageId,
          `生成失败：${message}`,
          "failed",
          message,
        );
      }
      if (body.initial) {
        await finishInitialConversationProcessing(
          orgId,
          user.id,
          conversationId,
          "failed",
          message,
        );
      }
      send("error", { message });
    }
  });
}
