import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ingestArticle } from "../article-ingest";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq } from "drizzle-orm";

let ORG_ID: string;
const TEST_URL = `https://test-${Date.now()}.example.com/article/1`;

beforeAll(async () => {
  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (orgs.length === 0) throw new Error("No organization for tests");
  ORG_ID = orgs[0].id;
});

afterAll(async () => {
  await db.delete(newsArticles).where(eq(newsArticles.url, TEST_URL));
});

describe("ingestArticle", () => {
  it("inserts on first call", async () => {
    const r = await ingestArticle({
      url: TEST_URL,
      title: "测试文章",
      sourceChannel: "tavily",
      organizationId: ORG_ID,
    });
    expect(r.inserted).toBe(true);
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is idempotent on second call (same url)", async () => {
    const r = await ingestArticle({
      url: TEST_URL,
      title: "测试文章",
      sourceChannel: "tavily",
      organizationId: ORG_ID,
    });
    expect(r.inserted).toBe(false);
  });

  it("treats normalized-equivalent URLs as same article", async () => {
    const r = await ingestArticle({
      url: `${TEST_URL}?utm_source=test`,
      title: "测试文章",
      sourceChannel: "tavily",
      organizationId: ORG_ID,
    });
    expect(r.inserted).toBe(false);
  });
});
