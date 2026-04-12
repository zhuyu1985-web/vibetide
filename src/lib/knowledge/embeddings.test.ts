import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock process.env before importing the module
vi.stubEnv("JINA_API_KEY", "test-key");
vi.stubEnv("JINA_EMBEDDING_MODEL", "test-model");

import { generateEmbeddings, generateQueryEmbedding, getEmbeddingModel } from "./embeddings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponse(embeddings: number[][], status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: () => Promise.resolve("error body"),
    json: () =>
      Promise.resolve({
        data: embeddings.map((e, i) => ({ index: i, embedding: e })),
        model: "test-model",
        usage: { total_tokens: 100 },
      }),
  });
}

function mockFetchError(message: string) {
  return vi.fn().mockRejectedValue(new Error(message));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getEmbeddingModel", () => {
  it("returns env variable when set", () => {
    expect(getEmbeddingModel()).toBe("test-model");
  });
});

describe("generateEmbeddings", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns empty array for empty input", async () => {
    const result = await generateEmbeddings([]);
    expect(result).toEqual([]);
  });

  it("calls Jina API and returns embeddings", async () => {
    const expected = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
    global.fetch = mockFetchResponse(expected);

    const result = await generateEmbeddings(["text1", "text2"]);
    expect(result).toEqual(expected);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = vi.mocked(global.fetch).mock.calls[0];
    expect(call[0]).toBe("https://api.jina.ai/v1/embeddings");

    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.input).toEqual(["text1", "text2"]);
    expect(body.model).toBe("test-model");
    expect(body.task).toBe("retrieval.passage");
  });

  it("sorts results by index to match input order", async () => {
    // Return out-of-order
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { index: 1, embedding: [0.4, 0.5] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
        }),
    });

    const result = await generateEmbeddings(["a", "b"]);
    expect(result[0]).toEqual([0.1, 0.2]);
    expect(result[1]).toEqual([0.4, 0.5]);
  });

  it("throws on missing JINA_API_KEY", async () => {
    vi.stubEnv("JINA_API_KEY", "");
    // Re-import to pick up new env — but since module is already loaded,
    // we test via the function which reads env at call time
    await expect(generateEmbeddings(["test"])).rejects.toThrow("JINA_API_KEY");
    vi.stubEnv("JINA_API_KEY", "test-key");
  });

  it("throws on non-OK response after retries", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: () => Promise.resolve("rate limited"),
    });

    await expect(generateEmbeddings(["test"])).rejects.toThrow("已重试");
    // Should have retried 3 times
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("retries on transient errors then succeeds", async () => {
    const expected = [[0.1, 0.2]];
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("network timeout");
      }
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ index: 0, embedding: [0.1, 0.2] }],
          }),
      };
    });

    const result = await generateEmbeddings(["test"]);
    expect(result).toEqual(expected);
    expect(callCount).toBe(3);
  });

  it("batches large input into chunks of 100", async () => {
    const inputs = Array.from({ length: 150 }, (_, i) => `text-${i}`);
    const embedding = [0.1];

    global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse((opts as RequestInit).body as string);
      const batchEmbeddings = body.input.map((_: string, i: number) => ({
        index: i,
        embedding,
      }));
      return {
        ok: true,
        json: () => Promise.resolve({ data: batchEmbeddings }),
      };
    });

    const result = await generateEmbeddings(inputs);
    expect(result).toHaveLength(150);
    // Should have made 2 API calls (100 + 50)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws on malformed API response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ something: "unexpected" }),
    });

    await expect(generateEmbeddings(["test"])).rejects.toThrow("格式异常");
  });
});

describe("generateQueryEmbedding", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns a single embedding vector", async () => {
    const expected = [0.1, 0.2, 0.3];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ index: 0, embedding: expected }],
        }),
    });

    const result = await generateQueryEmbedding("test query");
    expect(result).toEqual(expected);

    const body = JSON.parse(
      (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.task).toBe("retrieval.query");
  });

  it("throws when API key is missing", async () => {
    vi.stubEnv("JINA_API_KEY", "");
    await expect(generateQueryEmbedding("test")).rejects.toThrow("JINA_API_KEY");
    vi.stubEnv("JINA_API_KEY", "test-key");
  });

  it("throws on empty embedding response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await expect(generateQueryEmbedding("test")).rejects.toThrow("为空");
  });
});
