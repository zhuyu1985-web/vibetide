import { tikhubRateLimiter } from "./rate-limiter";
import pricingJson from "./pricing.json";

const TIKHUB_BASE_URL = process.env.TIKHUB_API_BASE_URL ?? "https://api.tikhub.io";

interface FetchOptions {
  endpoint: string;
  params?: Record<string, string | number | boolean | undefined>;
  retryOn5xx?: boolean;
  /** 默认 true。TikHub 上游(weibo/douyin)瞬时抖动会回 400 + "Please retry",且不扣费,可安全重试 */
  retryOn400Retryable?: boolean;
}

export interface TikhubFetchResult<T = unknown> {
  data: T;
  costUsd: number;
  endpoint: string;
}

const TIKHUB_RETRYABLE_400_PATTERN = /Please retry|请求失败.*请重试|won.?t be charged|不会被扣费/i;

export async function tikhubFetch<T = unknown>(opts: FetchOptions): Promise<TikhubFetchResult<T>> {
  const apiKey = process.env.TIKHUB_API_KEY;
  if (!apiKey) throw new Error("TIKHUB_API_KEY not set in env");

  const url = new URL(opts.endpoint, TIKHUB_BASE_URL);
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  await tikhubRateLimiter.acquire();
  const pricing = pricingJson as unknown as Record<string, { basePrice: number }>;
  const cost = pricing[opts.endpoint]?.basePrice ?? 0.005;

  const fetchOnce = () =>
    fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

  let response = await fetchOnce();

  if (response.status === 429) {
    await new Promise<void>((r) => setTimeout(r, 5 * 60 * 1000));
    response = await fetchOnce();
  }

  if (response.status >= 500 && opts.retryOn5xx !== false) {
    await new Promise<void>((r) => setTimeout(r, 5000));
    response = await fetchOnce();
  }

  // TikHub 上游(weibo/douyin)瞬时抖动 400:错误体里带 "Please retry" 字样,
  // 且 TikHub 明确不扣费,可安全重试一次,避免账号分析多页抓取因一页失败而 break 整次任务
  if (
    response.status === 400 &&
    opts.retryOn400Retryable !== false
  ) {
    const bodyText = await response.clone().text().catch(() => "");
    if (TIKHUB_RETRYABLE_400_PATTERN.test(bodyText)) {
      await new Promise<void>((r) => setTimeout(r, 3000));
      response = await fetchOnce();
    }
  }

  if (!response.ok) {
    throw new Error(
      `tikhub ${opts.endpoint} returned ${response.status}: ${await response.text().catch(() => "")}`,
    );
  }

  const data = (await response.json()) as T;
  return { data, costUsd: cost, endpoint: opts.endpoint };
}
