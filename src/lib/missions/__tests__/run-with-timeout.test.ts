import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runWithTimeout } from "../run-with-timeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("runWithTimeout", () => {
  it("按时完成 → 正常 resolve", async () => {
    await expect(runWithTimeout(Promise.resolve("ok"), 1000, "超时")).resolves.toBe("ok");
  });
  it("超时未完成 → reject 超时错误", async () => {
    const never = new Promise(() => {});
    const p = runWithTimeout(never, 1000, "任务执行超时");
    const assertion = expect(p).rejects.toThrow("任务执行超时");
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });
});
