import { describe, it, expect } from "vitest";
import { renderDraftCard } from "../cards";

describe("renderDraftCard", () => {
  const shortBody = "这是一段不到两百字的正文。";

  it("正文超 220 字只放预览 + 省略号（IM 卡片不塞全文）", () => {
    const longBody = "甲".repeat(500);
    const card = renderDraftCard("标题", 500, longBody);
    expect(card).toContain("甲".repeat(220));
    expect(card).toContain("…");
    expect(card).not.toContain("甲".repeat(221));
    // 字数仍按真实值显示（修复 word_count=0 后口径一致）
    expect(card).toContain("500 字");
  });

  it("传 articleUrl 时附「看全文」链接", () => {
    const card = renderDraftCard("标题", 12, shortBody, "https://app.example.com/articles/abc");
    expect(card).toContain("看全文");
    expect(card).toContain("https://app.example.com/articles/abc");
  });

  it("不传 articleUrl 时不出现链接行（避免 IM 里出现无效相对路径）", () => {
    const card = renderDraftCard("标题", 12, shortBody);
    expect(card).not.toContain("看全文");
    expect(card).not.toContain("http");
  });

  it("引导文案反映当前能力，不再是过时的「将在后续阶段开放」", () => {
    const card = renderDraftCard("标题", 12, shortBody);
    expect(card).not.toContain("将在后续阶段开放");
    expect(card).toContain("改稿");
    expect(card).toContain("提交审核");
  });
});
