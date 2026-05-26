import { describe, it, expect } from "vitest";
import { extractArchiveData } from "../archive-to-drafts-renderer";

describe("extractArchiveData", () => {
  it("happy path: created + skipped 都有", () => {
    const out = extractArchiveData({
      totalRequested: 3,
      totalCreated: 2,
      totalSkipped: 1,
      created: [
        { articleId: "a1", title: "Story A", sourceUrl: "https://x.com/1" },
        { articleId: "a2", title: "Story B", sourceUrl: "https://x.com/2" },
      ],
      skipped: [
        { sourceUrl: "https://x.com/dup", existingArticleId: "a99", reason: "duplicate_source_url" },
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.totalCreated).toBe(2);
    expect(out!.totalSkipped).toBe(1);
    expect(out!.created).toHaveLength(2);
    expect(out!.skipped).toHaveLength(1);
  });

  it("无相关字段 → null (让上层 fallback)", () => {
    expect(extractArchiveData({ summary: "..." })).toBeNull();
    expect(extractArchiveData(null)).toBeNull();
    expect(extractArchiveData("string")).toBeNull();
  });

  it("只有 totalRequested 也能识别 (兼容 dryRun shape)", () => {
    const out = extractArchiveData({ totalRequested: 0 });
    expect(out).not.toBeNull();
    expect(out!.totalRequested).toBe(0);
  });

  it("只有 created 字段也能识别", () => {
    const out = extractArchiveData({ created: [] });
    expect(out).not.toBeNull();
    expect(out!.created).toEqual([]);
  });

  it("totalCreated 字段为 0 也能识别 (字段存在的 truthiness 不能用 ?.)", () => {
    const out = extractArchiveData({ totalCreated: 0, totalSkipped: 0 });
    expect(out).not.toBeNull();
    expect(out!.totalCreated).toBe(0);
  });
});
