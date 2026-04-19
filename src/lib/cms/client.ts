import {
  CmsAuthError,
  CmsBusinessError,
  CmsNetworkError,
  CmsSchemaError,
  isRetriableCmsError,
} from "./errors";
import {
  CmsResponseEnvelopeSchema,
  type CmsResponseEnvelope,
} from "./types";

export interface CmsClientConfig {
  host: string;
  loginCmcId: string;
  loginCmcTid: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
}

export interface CmsRequestOptions {
  timeoutMs?: number;
  /** 覆盖 header（除鉴权三件套外） */
  extraHeaders?: Record<string, string>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CmsClient {
  private readonly host: string;
  private readonly loginCmcId: string;
  private readonly loginCmcTid: string;
  private readonly defaultTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;

  constructor(config: CmsClientConfig) {
    this.host = config.host.replace(/\/$/, "");
    this.loginCmcId = config.loginCmcId;
    this.loginCmcTid = config.loginCmcTid;
    this.defaultTimeoutMs = config.timeoutMs ?? 15000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBackoffMs = config.retryBackoffMs ?? 1000;
  }

  /** 带重试的 post —— 外部调用使用这个 */
  async post<TReq, TRes>(
    path: string,
    body: TReq,
    options: CmsRequestOptions = {},
  ): Promise<CmsResponseEnvelope<TRes>> {
    return this.withRetry(() => this.postOnce<TReq, TRes>(path, body, options));
  }

  async get<TRes>(
    path: string,
    query: Record<string, string | number> = {},
    options: CmsRequestOptions = {},
  ): Promise<CmsResponseEnvelope<TRes>> {
    return this.withRetry(() => this.getOnce<TRes>(path, query, options));
  }

  private buildUrl(path: string): string {
    const safePath = path.startsWith("/") ? path : `/${path}`;
    return `${this.host}${safePath}`;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!isRetriableCmsError(err)) throw err;
        if (attempt === this.maxRetries) break;
        const backoff = this.retryBackoffMs * 2 ** attempt;
        await delay(backoff);
      }
    }
    throw lastErr;
  }

  private async postOnce<TReq, TRes>(
    path: string,
    body: TReq,
    options: CmsRequestOptions = {},
  ): Promise<CmsResponseEnvelope<TRes>> {
    const url = this.buildUrl(path);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          login_cmc_id: this.loginCmcId,
          login_cmc_tid: this.loginCmcTid,
          ...(options.extraHeaders ?? {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new CmsNetworkError(`CMS 请求超时：${path}`, { cause: "AbortError" });
      }
      if (err instanceof Error) {
        throw new CmsNetworkError(`CMS 网络错误：${err.message}`, { cause: err.name });
      }
      throw new CmsNetworkError(`CMS 未知网络错误：${String(err)}`);
    } finally {
      clearTimeout(timer);
    }

    return this.parseResponse<TRes>(response, path);
  }

  private async getOnce<TRes>(
    path: string,
    query: Record<string, string | number> = {},
    options: CmsRequestOptions = {},
  ): Promise<CmsResponseEnvelope<TRes>> {
    const url = new URL(this.buildUrl(path));
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          login_cmc_id: this.loginCmcId,
          login_cmc_tid: this.loginCmcTid,
          ...(options.extraHeaders ?? {}),
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new CmsNetworkError(`CMS 请求超时：${path}`, { cause: "AbortError" });
      }
      throw new CmsNetworkError(
        `CMS 网络错误：${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    return this.parseResponse<TRes>(response, path);
  }

  private async parseResponse<TRes>(
    response: Response,
    path: string,
  ): Promise<CmsResponseEnvelope<TRes>> {
    // HTTP 层 5xx / 非 JSON
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new CmsBusinessError(
        `CMS HTTP ${response.status} at ${path}`,
        { state: response.status, cmsMessage: text.slice(0, 500) },
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      throw new CmsSchemaError(
        `CMS 响应非 JSON：${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = CmsResponseEnvelopeSchema.safeParse(json);
    if (!parsed.success) {
      throw new CmsSchemaError(
        `CMS 响应不符合 envelope 结构：${parsed.error.message}`,
      );
    }

    const envelope = parsed.data as CmsResponseEnvelope<TRes>;

    // 鉴权错误（优先级高于其他业务错误）
    if (
      envelope.state === 401 ||
      envelope.state === 403 ||
      /未登录|token.*(失效|过期)|login.*(failed|expired)/i.test(envelope.message)
    ) {
      throw new CmsAuthError(
        `CMS 鉴权失败：state=${envelope.state} message="${envelope.message}"`,
      );
    }

    // 业务成功
    if (envelope.state === 200 && envelope.success) {
      return envelope;
    }

    // 业务错误
    throw new CmsBusinessError(
      `CMS 业务错误 at ${path}：state=${envelope.state} message="${envelope.message}"`,
      {
        state: envelope.state,
        cmsMessage: envelope.message,
        rawResponse: envelope,
      },
    );
  }
}
