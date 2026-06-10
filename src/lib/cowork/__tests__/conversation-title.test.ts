import { describe, it, expect } from "vitest";
import { deriveConversationTitle } from "@/lib/cowork/conversation-title";

describe("deriveConversationTitle", () => {
  it("短文本原样返回", () => {
    expect(deriveConversationTitle("写一篇快讯")).toBe("写一篇快讯");
  });

  it("压缩换行与多余空白为单空格", () => {
    expect(deriveConversationTitle("写一篇\n\n关于  AI 的快讯")).toBe(
      "写一篇 关于 AI 的快讯",
    );
  });

  it("超长截断到 24 字并加省略号", () => {
    const long = "重庆".repeat(20); // 40 字
    const out = deriveConversationTitle(long);
    expect(out.endsWith("…")).toBe(true);
    expect([...out].length).toBe(25); // 24 + …
  });

  it("空或纯空白回退为新对话", () => {
    expect(deriveConversationTitle("   \n ")).toBe("新对话");
    expect(deriveConversationTitle("")).toBe("新对话");
  });
});
