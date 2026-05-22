/**
 * Ayrshare HTTP client。
 *
 * 单一职责：POST https://api.ayrshare.com/api/post，header Authorization: Bearer ${API_KEY}。
 * 错误分类对照 `src/lib/cms/client.ts`：网络层异常 → AyrshareNetworkError；
 * HTTP 4xx/5xx → AyrshareBusinessError；401/403 → AyrshareAuthError；JSON / schema 异常 → AyrshareSchemaError。
 *
 * 不做内部重试 —— 重试由 Inngest `external-publish-retry` 函数统一管理。
 */

import {
  AyrshareAuthError,
  AyrshareBusinessError,
  AyrshareConfigError,
  AyrshareNetworkError,
  AyrshareSchemaError,
} from "./errors";
import {
  AyrsharePostResponseSchema,
  type AyrsharePostRequest,
  type AyrsharePostResponse,
} from "./types";

const AYRSHARE_API_BASE = "https://api.ayrshare.com/api";
const DEFAULT_TIMEOUT_MS = 10_000;

export interface AyrshareClientConfig {
  apiKey: string;
  /** 多账号场景下绑定的 profile key（可选） */
  profileKey?: string;
  timeoutMs?: number;
  /** 用于单测 mock —— 默认 globalThis.fetch */
  fetchImpl?: typeof fetch;
}

export class AyrshareClient {
  private readonly apiKey: string;
  private readonly profileKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AyrshareClientConfig) {
    if (!config.apiKey) {
      throw new AyrshareConfigError("AyrshareClient: apiKey 必填");
    }
    this.apiKey = config.apiKey;
    this.profileKey = config.profileKey;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * POST /api/post — 发起一次跨平台发布。
   *
   * @throws {AyrshareNetworkError} 超时 / 网络错误
   * @throws {AyrshareAuthError} 401 / 403
   * @throws {AyrshareBusinessError} 其他 HTTP 非 2xx / status="error"
   * @throws {AyrshareSchemaError} JSON 解析失败 / 响应结构异常
   */
  async post(body: AyrsharePostRequest): Promise<AyrsharePostResponse> {
    const url = `${AYRSHARE_API_BASE}/post`;

    const finalBody: AyrsharePostRequest = this.profileKey
      ? { ...body, profileKey: body.profileKey ?? this.profileKey }
      : body;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(finalBody),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new AyrshareNetworkError(`Ayrshare 请求超时 (${this.timeoutMs}ms)`, {
          cause: "AbortError",
        });
      }
      if (err instanceof Error) {
        throw new AyrshareNetworkError(`Ayrshare 网络错误：${err.message}`, {
          cause: err.name,
        });
      }
      throw new AyrshareNetworkError(`Ayrshare 未知网络错误：${String(err)}`);
    } finally {
      clearTimeout(timer);
    }

    return this.parseResponse(response);
  }

  private async parseResponse(response: Response): Promise<AyrsharePostResponse> {
    const text = await response.text().catch(() => "");

    // 鉴权错误优先
    if (response.status === 401 || response.status === 403) {
      throw new AyrshareAuthError(
        `Ayrshare 鉴权失败 HTTP ${response.status}: ${text.slice(0, 300)}`,
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      // 非 JSON 响应：HTTP 非 2xx 归类为 business（含状态码），HTTP 2xx 归类为 schema
      if (!response.ok) {
        throw new AyrshareBusinessError(
          `Ayrshare HTTP ${response.status}（非 JSON）`,
          { state: response.status, ayrshareMessage: text.slice(0, 500) },
        );
      }
      throw new AyrshareSchemaError(
        `Ayrshare 响应非 JSON：${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = AyrsharePostResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new AyrshareSchemaError(
        `Ayrshare 响应结构异常：${parsed.error.message}`,
      );
    }
    const envelope = parsed.data;

    // HTTP 层错误
    if (!response.ok) {
      throw new AyrshareBusinessError(
        `Ayrshare HTTP ${response.status}：${envelope.message ?? envelope.status}`,
        {
          state: response.status,
          ayrshareMessage: envelope.message ?? envelope.status,
          rawResponse: envelope,
        },
      );
    }

    // 业务层错误：顶层 status != "success"
    if (envelope.status && envelope.status !== "success") {
      throw new AyrshareBusinessError(
        `Ayrshare 业务错误：status=${envelope.status} message=${envelope.message ?? ""}`,
        {
          state: response.status,
          ayrshareMessage: envelope.message ?? envelope.status,
          rawResponse: envelope,
        },
      );
    }

    return envelope;
  }
}

// ─── 配置读取 ─────────────────────────────────────────────────────────────

export interface AyrshareEnvConfig {
  apiKey: string;
  webhookSecret: string;
  defaultProfile?: string;
}

export function requireAyrshareConfig(): AyrshareEnvConfig {
  const apiKey = process.env.AYRSHARE_API_KEY;
  const webhookSecret = process.env.AYRSHARE_WEBHOOK_SECRET;
  if (!apiKey) {
    throw new AyrshareConfigError(
      "[ayrshare] 缺少 AYRSHARE_API_KEY；请在 .env.local 配置",
    );
  }
  if (!webhookSecret) {
    throw new AyrshareConfigError(
      "[ayrshare] 缺少 AYRSHARE_WEBHOOK_SECRET；请在 .env.local 配置",
    );
  }
  return {
    apiKey,
    webhookSecret,
    defaultProfile: process.env.AYRSHARE_DEFAULT_PROFILE || undefined,
  };
}
