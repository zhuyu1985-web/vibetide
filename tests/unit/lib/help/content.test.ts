import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";

beforeAll(() => {
  process.env.HELP_CONTENT_ROOT = path.resolve(__dirname, "../../../fixtures/help-content");
});

describe("listAllDocs", () => {
  it("扫所有非 changelog mdx", async () => {
    const { listAllDocs } = await import("@/lib/help/content");
    const docs = await listAllDocs();
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.slug).sort()).toEqual(["concepts", "start"]);
  });
});

describe("getDocBySlug", () => {
  it("返回带 toc 与 readingTime 的 doc", async () => {
    const { getDocBySlug } = await import("@/lib/help/content");
    const doc = await getDocBySlug("workflows", "start");
    expect(doc).not.toBeNull();
    expect(doc!.toc.length).toBeGreaterThan(0);
    expect(doc!.readingTime).toMatch(/^约 \d+ 分钟$/);
  });
  it("不存在的 slug 返回 null", async () => {
    const { getDocBySlug } = await import("@/lib/help/content");
    expect(await getDocBySlug("workflows", "nonexistent")).toBeNull();
  });
});

describe("listCategories", () => {
  it("跳过空分类", async () => {
    const { listCategories } = await import("@/lib/help/content");
    const cats = await listCategories();
    expect(cats.map((c) => c.slug)).toEqual(["workflows"]);   // creation 空,被过滤
  });
});

describe("listPopularDocs", () => {
  it("按 frontmatter.popular 过滤", async () => {
    const { listPopularDocs } = await import("@/lib/help/content");
    const pops = await listPopularDocs();
    expect(pops).toHaveLength(1);
    expect(pops[0].slug).toBe("start");
  });
});
