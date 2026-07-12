import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/app/actions/cowork-submit", () => ({
  submitCoworkMessage: vi.fn(),
}));

import { ConversationThread } from "../conversation-thread";
import type {
  Conversation,
  ConversationMessage,
} from "@/db/schema/conversations";

describe("ConversationThread assistant messages", () => {
  it("renders Markdown syntax as formatted HTML", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
        active: {
          conversation: {
            id: "conversation-1",
            title: "测试会话",
          } as Conversation,
          messages: [
            {
              id: "message-1",
              conversationId: "conversation-1",
              role: "assistant",
              kind: "text",
              content: "## 标题\n\n这是 **重点**",
              meta: null,
            } as ConversationMessage,
          ],
        },
        focusedMissionId: null,
        onMissionFocus: vi.fn(),
      }),
    );

    expect(html).toContain("<h2>标题</h2>");
    expect(html).toContain("<strong>重点</strong>");
  });

  it("renders fenced JSON as a formatted code preview", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
        active: {
          conversation: {
            id: "conversation-1",
            title: "测试会话",
          } as Conversation,
          messages: [
            {
              id: "message-1",
              conversationId: "conversation-1",
              role: "assistant",
              kind: "text",
              content: "```json\n{\"title\":\"稿件\",\"meta\":{\"score\":92}}\n```",
              meta: null,
            } as ConversationMessage,
          ],
        },
        focusedMissionId: null,
        onMissionFocus: vi.fn(),
      }),
    );

    expect(html).toContain("<pre");
    expect(html).toContain("language-json");
    expect(html).toContain("&quot;title&quot;: &quot;稿件&quot;");
    expect(html).toContain("&quot;score&quot;: 92");
  });

  it("renders the growing streamed reply with a typewriter cursor", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
          active: {
            conversation: {
              id: "conversation-1",
              title: "测试会话",
            } as Conversation,
            messages: [
              {
                id: "assistant-1",
                conversationId: "conversation-1",
                role: "assistant",
                kind: "text",
                content: "",
                meta: { streaming: true },
                createdAt: new Date(),
                missionId: null,
                executedByEmployeeId: null,
              } as ConversationMessage,
            ],
          },
          focusedMissionId: null,
          onMissionFocus: vi.fn(),
          streamingReply: {
            messageId: "assistant-1",
            content: "正在生成 **重点",
            active: true,
          },
      }),
    );

    expect(html).toContain("正在生成");
    expect(html).toContain("data-streaming-cursor");
  });

  it("shows intent-recognition status before any token arrives", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
        active: {
          conversation: {
            id: "conversation-1",
            title: "测试会话",
          } as Conversation,
          messages: [
            {
              id: "user-1",
              conversationId: "conversation-1",
              role: "user",
              kind: "text",
              content: "你好",
              meta: null,
              createdAt: new Date(),
              missionId: null,
              executedByEmployeeId: null,
            } as ConversationMessage,
          ],
        },
        focusedMissionId: null,
        onMissionFocus: vi.fn(),
        streamingReply: {
          messageId: null,
          content: "",
          active: true,
          statusLabel: "正在识别意图…",
        },
      }),
    );

    expect(html).toContain("正在识别意图…");
  });

  it("prefers the active streaming status over the initial processing fallback", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
        active: {
          conversation: {
            id: "conversation-1",
            title: "测试会话",
          } as Conversation,
          messages: [
            {
              id: "user-1",
              conversationId: "conversation-1",
              role: "user",
              kind: "text",
              content: "写一篇文章",
              meta: null,
              createdAt: new Date(),
              missionId: null,
              executedByEmployeeId: null,
            } as ConversationMessage,
          ],
        },
        focusedMissionId: null,
        onMissionFocus: vi.fn(),
        initialProcessing: {
          status: "running",
          prompt: "写一篇文章",
          attempt: 1,
          updatedAt: new Date().toISOString(),
        },
        streamingReply: {
          messageId: null,
          content: "",
          active: true,
          statusLabel: "正在识别意图…",
        },
      }),
    );

    expect(html).toContain("正在识别意图…");
    expect(html).not.toContain("正在解析意图并安排 AI 团队处理");
    expect(html.match(/animate-spin/g) ?? []).toHaveLength(1);
  });

  it("does not render a naked loader for an empty unpersisted streaming reply", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
        active: {
          conversation: {
            id: "conversation-1",
            title: "测试会话",
          } as Conversation,
          messages: [
            {
              id: "user-1",
              conversationId: "conversation-1",
              role: "user",
              kind: "text",
              content: "写一篇文章",
              meta: null,
              createdAt: new Date(),
              missionId: null,
              executedByEmployeeId: null,
            } as ConversationMessage,
          ],
        },
        focusedMissionId: null,
        onMissionFocus: vi.fn(),
        streamingReply: {
          messageId: "assistant-1",
          content: "",
          active: true,
        },
      }),
    );

    expect(html).not.toContain("animate-spin");
    expect(html).not.toContain("data-streaming-cursor");
  });
});
