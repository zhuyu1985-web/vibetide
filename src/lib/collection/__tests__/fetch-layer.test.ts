import { describe, it, expect, vi } from "vitest";
import { fetchWithPolicy, DEFAULT_FETCH_POLICY } from "../fetch-layer";

describe("fetchWithPolicy", () => {
  it("returns result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await fetchWithPolicy(fn, DEFAULT_FETCH_POLICY);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on thrown error up to maxAttempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");
    const result = await fetchWithPolicy(fn, {
      ...DEFAULT_FETCH_POLICY,
      baseDelayMs: 1,
      jitter: false,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after maxAttempts exceeded", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent"));
    await expect(
      fetchWithPolicy(fn, { ...DEFAULT_FETCH_POLICY, maxAttempts: 2, baseDelayMs: 1, jitter: false }),
    ).rejects.toThrow("persistent");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry when error is marked non-retryable", async () => {
    const err = new Error("400 Bad Request");
    (err as any).nonRetryable = true;
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      fetchWithPolicy(fn, { ...DEFAULT_FETCH_POLICY, maxAttempts: 5, baseDelayMs: 1, jitter: false }),
    ).rejects.toThrow("400 Bad Request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onAttempt callback for each attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("e1"))
      .mockResolvedValue("ok");
    const onAttempt = vi.fn();
    await fetchWithPolicy(
      fn,
      { ...DEFAULT_FETCH_POLICY, baseDelayMs: 1, jitter: false },
      onAttempt,
    );
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onAttempt).toHaveBeenNthCalledWith(2, 2, undefined);
  });

  it("respects timeoutMs via AbortController", async () => {
    const fn = ({ signal }: { signal: AbortSignal }) =>
      new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => resolve("late"), 500);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        });
      });
    await expect(
      fetchWithPolicy(
        ({ signal }) => fn({ signal }),
        { ...DEFAULT_FETCH_POLICY, timeoutMs: 50, maxAttempts: 1, baseDelayMs: 1 },
      ),
    ).rejects.toThrow();
  });
});
