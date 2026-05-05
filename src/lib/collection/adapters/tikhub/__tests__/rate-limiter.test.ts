import { describe, expect, it } from "vitest";
import { TokenBucket } from "../rate-limiter";

describe("TokenBucket", () => {
  it("初始有 capacity 个 token，可立即获取", async () => {
    const bucket = new TokenBucket(3, 1);
    const start = Date.now();
    await bucket.acquire();
    await bucket.acquire();
    await bucket.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("token 用尽后等待 refill", async () => {
    const bucket = new TokenBucket(2, 10);
    await bucket.acquire();
    await bucket.acquire();
    const start = Date.now();
    await bucket.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80);
    expect(elapsed).toBeLessThan(200);
  });

  it("8 RPS 限速实测：8 个调用 1 秒内完成，第 9-16 个第二秒完成", async () => {
    const bucket = new TokenBucket(8, 8);
    const start = Date.now();
    await Promise.all(Array.from({ length: 8 }, () => bucket.acquire()));
    const phase1 = Date.now() - start;
    expect(phase1).toBeLessThan(100);

    await Promise.all(Array.from({ length: 8 }, () => bucket.acquire()));
    const phase2 = Date.now() - start;
    expect(phase2).toBeGreaterThanOrEqual(900);
    expect(phase2).toBeLessThan(1500);
  }, 5000);
});
