import { beforeEach, describe, expect, it, vi } from "vitest";

const submitMock = vi.hoisted(() => vi.fn());
const streamTextMock = vi.hoisted(() => vi.fn());
const claimMock = vi.hoisted(() => vi.fn());
const finishMock = vi.hoisted(() => vi.fn());
const updateMessageMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/cowork-submit", () => ({
  submitCoworkMessage: submitMock,
}));
vi.mock("ai", () => ({ streamText: streamTextMock }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/lib/dal/auth", () => ({
  getCurrentUserOrg: vi.fn(async () => "org-1"),
}));
vi.mock("@/lib/dal/cowork-conversations", () => ({
  claimInitialConversationProcessing: claimMock,
  finishInitialConversationProcessing: finishMock,
  updateConversationTextMessage: updateMessageMock,
}));
vi.mock("@/lib/agent/model-router", () => ({
  getDefaultModel: vi.fn(() => "test-model"),
  getLanguageModel: vi.fn(() => ({ modelId: "test" })),
}));

import { POST } from "../route";

describe("POST /api/cowork/stream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("streams text deltas and persists the complete Markdown reply", async () => {
    submitMock.mockResolvedValue({
      ok: true,
      kind: "stream",
      messageId: "assistant-1",
    });
    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        yield "## 标题\n";
        yield "**正文**";
      })(),
    });

    const response = await POST(
      new Request("http://localhost/api/cowork/stream", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conversation-1",
          message: "测试",
        }),
      }),
    );
    const body = await response.text();

    expect(body).toContain(
      'event: status\ndata: {"phase":"intent_recognizing","label":"正在识别意图…"}',
    );
    expect(body).toContain(
      'event: status\ndata: {"phase":"generating","label":"正在生成回复…"}',
    );
    expect(body).toContain('event: text-delta\ndata: {"text":"## 标题\\n"}');
    expect(body).toContain('event: text-delta\ndata: {"text":"**正文**"}');
    expect(updateMessageMock).toHaveBeenCalledWith(
      "conversation-1",
      "assistant-1",
      "## 标题\n**正文**",
      "completed",
    );
  });

  it("emits intent status before slow recognition finishes, then streams tokens", async () => {
    let resolveSubmit: (value: unknown) => void = () => {};
    submitMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        yield "首";
        yield "字";
      })(),
    });

    const response = await POST(
      new Request("http://localhost/api/cowork/stream", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conversation-1",
          message: "你好",
        }),
      }),
    );
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // 意图识别未完成前就必须已经读到 status 事件
    while (!buffer.includes("intent_recognizing")) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    expect(buffer).toContain(
      'event: status\ndata: {"phase":"intent_recognizing","label":"正在识别意图…"}',
    );
    expect(streamTextMock).not.toHaveBeenCalled();

    resolveSubmit({
      ok: true,
      kind: "stream",
      messageId: "assistant-1",
    });

    while (!buffer.includes("text-delta")) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    expect(buffer).toContain(
      'event: status\ndata: {"phase":"generating","label":"正在生成回复…"}',
    );
    expect(buffer).toContain('event: text-delta\ndata: {"text":"首"}');
    expect(streamTextMock).toHaveBeenCalledTimes(1);

    // 排空剩余流，避免未消费 Promise
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  });

  it("claims an initial message and completes its persistent state", async () => {
    claimMock.mockResolvedValue({
      status: "running",
      prompt: "首条消息",
      attempt: 1,
      updatedAt: new Date().toISOString(),
    });
    submitMock.mockResolvedValue({
      ok: true,
      kind: "mission",
      missionId: "mission-1",
      intentSummary: "执行任务",
    });

    const response = await POST(
      new Request("http://localhost/api/cowork/stream", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conversation-1",
          initial: true,
        }),
      }),
    );
    const body = await response.text();

    expect(submitMock).toHaveBeenCalledWith("conversation-1", "首条消息", {
      userMessageAlreadyPersisted: true,
    });
    expect(body).toContain('"kind":"mission"');
    expect(finishMock).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      "conversation-1",
      "completed",
    );
  });

  it("persists a visible failure when generation is interrupted", async () => {
    claimMock.mockResolvedValue({
      status: "running",
      prompt: "首条消息",
      attempt: 1,
      updatedAt: new Date().toISOString(),
    });
    submitMock.mockResolvedValue({
      ok: true,
      kind: "stream",
      messageId: "assistant-1",
    });
    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        throw new Error("模型连接中断");
      })(),
    });

    const response = await POST(
      new Request("http://localhost/api/cowork/stream", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conversation-1",
          initial: true,
        }),
      }),
    );
    const body = await response.text();

    expect(body).toContain(
      'event: error\ndata: {"message":"模型连接中断"}',
    );
    expect(updateMessageMock).toHaveBeenCalledWith(
      "conversation-1",
      "assistant-1",
      "生成失败：模型连接中断",
      "failed",
      "模型连接中断",
    );
    expect(finishMock).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      "conversation-1",
      "failed",
      "模型连接中断",
    );
  });
});
