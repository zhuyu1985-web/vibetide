import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/lib/dal/knowledge-bases", () => ({
  loadEmbeddedKnowledgeItems: vi.fn(),
}));

vi.mock("./embeddings", () => ({
  generateQueryEmbedding: vi.fn(),
}));

import { searchKnowledgeBases } from "./retrieval";
import { loadEmbeddedKnowledgeItems } from "@/lib/dal/knowledge-bases";
import { generateQueryEmbedding } from "./embeddings";

const mockedLoad = vi.mocked(loadEmbeddedKnowledgeItems);
const mockedEmbed = vi.mocked(generateQueryEmbedding);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a unit vector in dimension `dim` pointing along axis `axis`. */
function unitVector(dim: number, axis: number): number[] {
  return Array.from({ length: dim }, (_, i) => (i === axis ? 1 : 0));
}

/** Normalize a vector to unit length. */
function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return mag === 0 ? v : v.map((x) => x / mag);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("searchKnowledgeBases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when kbIds is empty", async () => {
    const result = await searchKnowledgeBases("query", []);
    expect(result).toEqual([]);
    expect(mockedLoad).not.toHaveBeenCalled();
    expect(mockedEmbed).not.toHaveBeenCalled();
  });

  it("returns empty array when query is blank", async () => {
    const result = await searchKnowledgeBases("  ", ["kb-1"]);
    expect(result).toEqual([]);
  });

  it("returns empty array when no candidates have embeddings", async () => {
    mockedEmbed.mockResolvedValue([1, 0, 0]);
    mockedLoad.mockResolvedValue([]);

    const result = await searchKnowledgeBases("query", ["kb-1"]);
    expect(result).toEqual([]);
  });

  it("ranks results by cosine similarity descending", async () => {
    // Query points in direction [1, 0, 0]
    const queryVec = unitVector(3, 0);
    mockedEmbed.mockResolvedValue(queryVec);

    mockedLoad.mockResolvedValue([
      {
        id: "item-a",
        knowledgeBaseId: "kb-1",
        title: "A",
        snippet: "snippet A",
        embedding: unitVector(3, 1), // orthogonal to query → similarity 0
      },
      {
        id: "item-b",
        knowledgeBaseId: "kb-1",
        title: "B",
        snippet: "snippet B",
        embedding: unitVector(3, 0), // parallel to query → similarity 1
      },
      {
        id: "item-c",
        knowledgeBaseId: "kb-1",
        title: "C",
        snippet: "snippet C",
        embedding: normalize([1, 1, 0]), // 45° → similarity ~0.707
      },
    ]);

    const result = await searchKnowledgeBases("query", ["kb-1"], 10);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("item-b");
    expect(result[0].relevance).toBeCloseTo(1.0, 3);
    expect(result[1].id).toBe("item-c");
    expect(result[1].relevance).toBeCloseTo(0.707, 2);
    expect(result[2].id).toBe("item-a");
    expect(result[2].relevance).toBeCloseTo(0, 3);
  });

  it("respects topK limit", async () => {
    mockedEmbed.mockResolvedValue([1, 0]);

    mockedLoad.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        id: `item-${i}`,
        knowledgeBaseId: "kb-1",
        title: `Title ${i}`,
        snippet: `Snippet ${i}`,
        embedding: normalize([1, i * 0.1]),
      }))
    );

    const result = await searchKnowledgeBases("query", ["kb-1"], 3);
    expect(result).toHaveLength(3);
    // First result should have highest similarity
    expect(result[0].relevance).toBeGreaterThanOrEqual(result[1].relevance);
    expect(result[1].relevance).toBeGreaterThanOrEqual(result[2].relevance);
  });

  it("caps topK at 50", async () => {
    mockedEmbed.mockResolvedValue([1]);
    mockedLoad.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({
        id: `item-${i}`,
        knowledgeBaseId: "kb-1",
        title: `T${i}`,
        snippet: `S${i}`,
        embedding: [Math.random()],
      }))
    );

    const result = await searchKnowledgeBases("query", ["kb-1"], 100);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("passes kbIds to loadEmbeddedKnowledgeItems correctly", async () => {
    mockedEmbed.mockResolvedValue([1, 0]);
    mockedLoad.mockResolvedValue([]);

    await searchKnowledgeBases("query", ["kb-1", "kb-2"]);

    expect(mockedLoad).toHaveBeenCalledWith(["kb-1", "kb-2"]);
  });

  it("handles candidates from multiple KBs", async () => {
    mockedEmbed.mockResolvedValue([1, 0]);

    mockedLoad.mockResolvedValue([
      {
        id: "item-a",
        knowledgeBaseId: "kb-1",
        title: "From KB1",
        snippet: "A",
        embedding: [1, 0],
      },
      {
        id: "item-b",
        knowledgeBaseId: "kb-2",
        title: "From KB2",
        snippet: "B",
        embedding: [0.9, 0.1],
      },
    ]);

    const result = await searchKnowledgeBases("query", ["kb-1", "kb-2"]);
    expect(result).toHaveLength(2);
    // Both KBs represented
    expect(result.map((r) => r.knowledgeBaseId)).toContain("kb-1");
    expect(result.map((r) => r.knowledgeBaseId)).toContain("kb-2");
  });

  it("handles zero vectors gracefully (returns 0 similarity)", async () => {
    mockedEmbed.mockResolvedValue([0, 0, 0]);
    mockedLoad.mockResolvedValue([
      {
        id: "item-a",
        knowledgeBaseId: "kb-1",
        title: "A",
        snippet: "A",
        embedding: [1, 0, 0],
      },
    ]);

    const result = await searchKnowledgeBases("query", ["kb-1"]);
    expect(result).toHaveLength(1);
    expect(result[0].relevance).toBe(0);
  });

  it("returns result shape with correct fields", async () => {
    mockedEmbed.mockResolvedValue([1]);
    mockedLoad.mockResolvedValue([
      {
        id: "item-1",
        knowledgeBaseId: "kb-1",
        title: "Test Title",
        snippet: "Test Snippet",
        embedding: [1],
      },
    ]);

    const result = await searchKnowledgeBases("query", ["kb-1"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "item-1",
      knowledgeBaseId: "kb-1",
      title: "Test Title",
      snippet: "Test Snippet",
      relevance: expect.any(Number),
    });
  });
});
