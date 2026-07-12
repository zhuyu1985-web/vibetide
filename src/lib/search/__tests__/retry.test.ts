import { describe, expect, it, vi } from "vitest";

import { isRetryableSearchError, runSearchWithRetry } from "../index";

describe("search retry policy", () => {
  it("retries one timeout and returns the second result", async () => {
    const result = { items: [], responseTime: 0.1, provider: "bocha" as const };
    const search = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("aborted", "AbortError"))
      .mockResolvedValueOnce(result);

    await expect(runSearchWithRetry(search, 0)).resolves.toEqual(result);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("retries 5xx but not authentication or quota errors", () => {
    expect(isRetryableSearchError(new Error("Bocha API returned 503"))).toBe(
      true,
    );
    expect(isRetryableSearchError(new Error("Tavily API returned 401"))).toBe(
      false,
    );
    expect(isRetryableSearchError(new Error("quota exceeded"))).toBe(false);
  });
});
