export interface FetchPolicy {
  timeoutMs: number;
  maxAttempts: number;
  backoff: "exponential" | "linear" | "none";
  baseDelayMs: number;
  jitter: boolean;
}

export const DEFAULT_FETCH_POLICY: FetchPolicy = {
  timeoutMs: 10_000,
  maxAttempts: 3,
  backoff: "exponential",
  baseDelayMs: 500,
  jitter: true,
};

export interface FetchContext {
  signal: AbortSignal;
  attempt: number;
}

export type FetchFn<T> = (ctx: FetchContext) => Promise<T>;

export type AttemptCallback = (attempt: number, err?: Error) => void;

/**
 * Wraps any async operation with retry/timeout/backoff.
 * The wrapped fn receives an AbortSignal so it can cancel long-running work
 * on timeout.
 *
 * Retry behavior:
 * - On thrown error, retry up to `maxAttempts` unless `err.nonRetryable === true`.
 * - Backoff between attempts per policy.
 * - Timeout triggers AbortController + counts as a failed attempt.
 */
export async function fetchWithPolicy<T>(
  fn: FetchFn<T>,
  policy: FetchPolicy = DEFAULT_FETCH_POLICY,
  onAttempt?: AttemptCallback,
): Promise<T> {
  let lastErr: Error | undefined;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), policy.timeoutMs);
    try {
      const result = await fn({ signal: ac.signal, attempt });
      onAttempt?.(attempt, undefined);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      lastErr = e;
      onAttempt?.(attempt, e);
      if ((e as unknown as { nonRetryable?: boolean }).nonRetryable) throw e;
      if (attempt >= policy.maxAttempts) throw e;
      const delay = computeBackoff(policy, attempt);
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("fetchWithPolicy exhausted with no error");
}

function computeBackoff(policy: FetchPolicy, attempt: number): number {
  let base: number;
  switch (policy.backoff) {
    case "exponential":
      base = policy.baseDelayMs * 2 ** (attempt - 1);
      break;
    case "linear":
      base = policy.baseDelayMs * attempt;
      break;
    default:
      base = policy.baseDelayMs;
  }
  if (policy.jitter) base *= 0.5 + Math.random();
  return Math.floor(base);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper: mark a thrown Error as non-retryable (e.g., 4xx that's not 429).
 */
export function markNonRetryable(err: Error): Error {
  (err as unknown as { nonRetryable: boolean }).nonRetryable = true;
  return err;
}
