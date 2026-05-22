/**
 * Ayrshare 对接层统一错误类型。
 *
 * 分类：
 *   auth         — API key 无效 / 401 / 403（不可重试，触发告警）
 *   network      — 超时 / DNS / 连接拒绝（可重试）
 *   business     — Ayrshare 返回 status != "success" 或 HTTP 5xx（5xx 可重试；4xx 仅 408/429 可重试）
 *   schema       — 响应结构异常（不可重试，说明上游 API 变更）
 *   config       — 本地配置错误（不可重试，启动前应发现）
 *
 * 对照 `src/lib/cms/errors.ts` 范式。
 * 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.1
 */

export class AyrshareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AyrshareError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class AyrshareAuthError extends AyrshareError {
  constructor(message: string) {
    super(message);
    this.name = "AyrshareAuthError";
  }
}

export interface AyrshareBusinessErrorMeta {
  state?: number;
  ayrshareMessage?: string;
  rawResponse?: unknown;
}

export class AyrshareBusinessError extends AyrshareError {
  public readonly state?: number;
  public readonly ayrshareMessage?: string;
  public readonly rawResponse?: unknown;

  constructor(message: string, meta: AyrshareBusinessErrorMeta = {}) {
    super(message);
    this.name = "AyrshareBusinessError";
    this.state = meta.state;
    this.ayrshareMessage = meta.ayrshareMessage;
    this.rawResponse = meta.rawResponse;
  }
}

export interface AyrshareNetworkErrorMeta {
  cause?: string;
}

export class AyrshareNetworkError extends AyrshareError {
  public readonly cause?: string;

  constructor(message: string, meta: AyrshareNetworkErrorMeta = {}) {
    super(message);
    this.name = "AyrshareNetworkError";
    this.cause = meta.cause;
  }
}

export interface AyrshareSchemaErrorMeta {
  field?: string;
}

export class AyrshareSchemaError extends AyrshareError {
  public readonly field?: string;

  constructor(message: string, meta: AyrshareSchemaErrorMeta = {}) {
    super(message);
    this.name = "AyrshareSchemaError";
    this.field = meta.field;
  }
}

export class AyrshareConfigError extends AyrshareError {
  constructor(message: string) {
    super(message);
    this.name = "AyrshareConfigError";
  }
}

// —— 分类辅助 ——

export type AyrshareErrorStage =
  | "auth"
  | "network"
  | "business"
  | "schema"
  | "config"
  | "unknown";

export function classifyAyrshareError(err: unknown): AyrshareErrorStage {
  if (err instanceof AyrshareAuthError) return "auth";
  if (err instanceof AyrshareNetworkError) return "network";
  if (err instanceof AyrshareBusinessError) return "business";
  if (err instanceof AyrshareSchemaError) return "schema";
  if (err instanceof AyrshareConfigError) return "config";
  return "unknown";
}

export function isRetriableAyrshareError(err: unknown): boolean {
  if (err instanceof AyrshareNetworkError) return true;
  if (err instanceof AyrshareBusinessError) {
    const s = err.state ?? 0;
    if (s >= 500 && s < 600) return true;
    if (s === 408 || s === 429) return true;
    return false;
  }
  // auth / schema / config / unknown 均不重试
  return false;
}
