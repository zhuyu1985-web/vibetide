import { afterEach, describe, expect, it, vi } from "vitest";

import { executeStreamingChat } from "@/lib/chat-utils";

describe("executeStreamingChat cowork events", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("delivers routing results while accumulating streamed Markdown", async () => {
    const encoder = new TextEncoder();
    const responseBody = [
      'event: status\ndata: {"phase":"intent_recognizing","label":"正在识别意图…"}\n\n',
      'event: result\ndata: {"kind":"stream","messageId":"m1"}\n\n',
      'event: status\ndata: {"phase":"generating","label":"正在生成回复…"}\n\n',
      'event: text-delta\ndata: {"text":"**重"}\n\n',
      'event: text-delta\ndata: {"text":"点**"}\n\n',
      'event: done\ndata: {"messageId":"m1"}\n\n',
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            for (const chunk of responseBody) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          },
        }),
      })),
    );
    const onResult = vi.fn();
    const onStatus = vi.fn();
    const onTextDelta = vi.fn();

    const result = await executeStreamingChat(
      "/api/cowork/stream",
      { conversationId: "c1", message: "test" },
      { onResult, onStatus, onTextDelta },
    );

    expect(onStatus).toHaveBeenNthCalledWith(1, {
      phase: "intent_recognizing",
      label: "正在识别意图…",
    });
    expect(onResult).toHaveBeenCalledWith({
      kind: "stream",
      messageId: "m1",
    });
    expect(onTextDelta).toHaveBeenLastCalledWith("点**", "**重点**");
    expect(result.accumulated).toBe("**重点**");
  });
});
