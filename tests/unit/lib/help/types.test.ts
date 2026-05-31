import { describe, it, expect } from "vitest";
import { HelpFrontmatterSchema } from "@/lib/help/types";

describe("HelpFrontmatterSchema", () => {
  it("接受合法 frontmatter", () => {
    const r = HelpFrontmatterSchema.safeParse({
      title: "第一个工作流", description: "5 分钟跑通",
      category: "workflows", publishedAt: "2026-05-31",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.toc).toBe(true);  // 默认值
  });
  it("拒绝非法 category", () => {
    expect(HelpFrontmatterSchema.safeParse({
      title: "x", description: "x", category: "foo", publishedAt: "2026-05-31",
    }).success).toBe(false);
  });
  it("拒绝错误日期格式", () => {
    expect(HelpFrontmatterSchema.safeParse({
      title: "x", description: "x", category: "workflows", publishedAt: "31-05-2026",
    }).success).toBe(false);
  });
  it("title 不能空", () => {
    expect(HelpFrontmatterSchema.safeParse({
      title: "", description: "x", category: "workflows", publishedAt: "2026-05-31",
    }).success).toBe(false);
  });
});
