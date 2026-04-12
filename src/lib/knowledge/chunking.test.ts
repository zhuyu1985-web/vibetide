import { describe, it, expect } from "vitest";
import { chunkText, buildSnippet } from "./chunking";

// ---------------------------------------------------------------------------
// chunkText — basic behavior
// ---------------------------------------------------------------------------

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns single chunk for short text (< minChars)", () => {
    const text = "这是一段短文本，不需要切分。";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("returns single chunk for text exactly at minChars boundary", () => {
    const text = "a".repeat(499);
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
  });

  it("splits by paragraph when text has \\n\\n separators", () => {
    const para1 = "第一段内容。".repeat(50); // ~300 chars
    const para2 = "第二段内容。".repeat(50);
    const para3 = "第三段内容。".repeat(50);
    const text = `${para1}\n\n${para2}\n\n${para3}`;

    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Each chunk should be within bounds (allowing some flexibility for overlap)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1200); // maxChars * 1.5
    }
  });

  it("splits long paragraphs by sentence punctuation", () => {
    // Create a long paragraph with Chinese sentences
    const sentence = "这是一句话。";
    const longPara = sentence.repeat(200); // ~1200 chars, > maxChars
    const chunks = chunkText(longPara);

    expect(chunks.length).toBeGreaterThan(1);
    // Should not split mid-sentence
    for (const chunk of chunks) {
      // Each chunk should end with punctuation or be the tail
      const lastChar = chunk.trim().slice(-1);
      expect(["。", "！", "？", ".", "!", "?"]).toContain(lastChar);
    }
  });

  it("hard-splits extremely long text without any punctuation", () => {
    // A single "word" with no sentence delimiters
    const text = "无标点长文本".repeat(200); // ~1200 chars
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("preserves overlap between consecutive chunks", () => {
    const sentence = "这是一句完整的话。";
    // Build text that will produce multiple chunks
    const text = (sentence.repeat(15) + "\n\n").repeat(5);
    const chunks = chunkText(text, { overlap: 50 });

    // For each pair of consecutive chunks, the tail of chunk[i] should appear
    // at the head of chunk[i+1]
    for (let i = 0; i < chunks.length - 1; i++) {
      const tail = chunks[i].slice(-30); // last 30 chars of current
      const headOfNext = chunks[i + 1].slice(0, 80); // first 80 chars of next
      // Overlap should make at least part of the tail appear in next head
      expect(headOfNext).toContain(tail.slice(-15));
    }
  });

  it("handles \\r\\n line endings correctly", () => {
    const text = "第一段。\r\n\r\n第二段。";
    const chunks = chunkText(text);
    // Should normalize and not leave \r artifacts
    for (const chunk of chunks) {
      expect(chunk).not.toContain("\r");
    }
  });

  it("respects custom options", () => {
    const sentence = "短句。";
    const text = sentence.repeat(100);
    const chunks = chunkText(text, { minChars: 100, maxChars: 200, overlap: 20 });
    for (const chunk of chunks) {
      // Allow some flexibility (1.5x maxChars for edge packing)
      expect(chunk.length).toBeLessThanOrEqual(300);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("produces non-empty trimmed chunks", () => {
    const text = "段落一。\n\n\n\n段落二。\n\n段落三。".repeat(30);
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it("handles English text with periods", () => {
    const text =
      "This is the first sentence. This is the second sentence. ".repeat(30);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // Should not produce empty chunks
    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });

  it("handles mixed Chinese and English", () => {
    const text =
      "中文内容 English content。Mixed sentence here. 另一句中文话。".repeat(30);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// buildSnippet
// ---------------------------------------------------------------------------

describe("buildSnippet", () => {
  it("returns full text when under maxLength", () => {
    const text = "短文本";
    expect(buildSnippet(text)).toBe("短文本");
  });

  it("truncates long text with ellipsis", () => {
    const text = "很长的文本内容".repeat(100);
    const snippet = buildSnippet(text, 50);
    expect(snippet.length).toBeLessThanOrEqual(51); // 50 + "…"
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("collapses whitespace", () => {
    const text = "多个   空格  和\n换行\t制表符";
    const snippet = buildSnippet(text);
    expect(snippet).not.toContain("  ");
    expect(snippet).not.toContain("\n");
    expect(snippet).not.toContain("\t");
  });

  it("handles empty string", () => {
    expect(buildSnippet("")).toBe("");
    expect(buildSnippet("  ")).toBe("");
  });

  it("uses default maxLength of 200", () => {
    const text = "x".repeat(300);
    const snippet = buildSnippet(text);
    expect(snippet.length).toBeLessThanOrEqual(201); // 200 + "…"
  });
});
