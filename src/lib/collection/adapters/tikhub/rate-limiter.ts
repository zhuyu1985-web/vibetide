export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(private readonly capacity: number, private readonly refillPerSec: number) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }

  async acquire(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil((1 - this.tokens) / this.refillPerSec * 1000);
      await new Promise<void>((r) => setTimeout(r, waitMs));
    }
  }

  private refill() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillMs;
    this.tokens = Math.min(this.capacity, this.tokens + (elapsedMs / 1000) * this.refillPerSec);
    this.lastRefillMs = now;
  }
}

export const tikhubRateLimiter = new TokenBucket(8, 8);
