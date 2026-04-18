/**
 * CMS 对接层统一错误类型。
 *
 * 分类：
 *   auth         — login_cmc_id/tid 失效（不可重试，触发告警）
 *   network      — 超时/DNS/连接拒绝（可重试）
 *   cms_business — CMS 返回 state != 200（5xx 可重试；4xx 除 408/429 外不可重试）
 *   mapping      — Payload 结构错误（不可重试，说明上游 bug）
 *   config       — 本地配置错误（不可重试，启动前应发现）
 *
 * 设计文档：§3.2 HTTP 客户端 / §3.7 幂等策略
 */

export class CmsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CmsError";
    // 保留 V8 stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class CmsAuthError extends CmsError {
  constructor(message: string) {
    super(message);
    this.name = "CmsAuthError";
  }
}

export interface CmsBusinessErrorMeta {
  state?: number;
  cmsMessage?: string;
  rawResponse?: unknown;
}

export class CmsBusinessError extends CmsError {
  public readonly state?: number;
  public readonly cmsMessage?: string;
  public readonly rawResponse?: unknown;

  constructor(message: string, meta: CmsBusinessErrorMeta = {}) {
    super(message);
    this.name = "CmsBusinessError";
    this.state = meta.state;
    this.cmsMessage = meta.cmsMessage;
    this.rawResponse = meta.rawResponse;
  }
}

export interface CmsNetworkErrorMeta {
  cause?: string;
}

export class CmsNetworkError extends CmsError {
  public readonly cause?: string;

  constructor(message: string, meta: CmsNetworkErrorMeta = {}) {
    super(message);
    this.name = "CmsNetworkError";
    this.cause = meta.cause;
  }
}

export interface CmsSchemaErrorMeta {
  field?: string;
}

export class CmsSchemaError extends CmsError {
  public readonly field?: string;

  constructor(message: string, meta: CmsSchemaErrorMeta = {}) {
    super(message);
    this.name = "CmsSchemaError";
    this.field = meta.field;
  }
}

export class CmsConfigError extends CmsError {
  constructor(message: string) {
    super(message);
    this.name = "CmsConfigError";
  }
}

// —— 分类辅助 ——

export type CmsErrorStage =
  | "auth"
  | "network"
  | "cms_business"
  | "mapping"
  | "config"
  | "unknown";

export function classifyCmsError(err: unknown): CmsErrorStage {
  if (err instanceof CmsAuthError) return "auth";
  if (err instanceof CmsNetworkError) return "network";
  if (err instanceof CmsBusinessError) return "cms_business";
  if (err instanceof CmsSchemaError) return "mapping";
  if (err instanceof CmsConfigError) return "config";
  return "unknown";
}

export function isRetriableCmsError(err: unknown): boolean {
  if (err instanceof CmsNetworkError) return true;
  if (err instanceof CmsBusinessError) {
    const s = err.state ?? 0;
    // 5xx 可重试；4xx 仅 408/429 可重试
    if (s >= 500 && s < 600) return true;
    if (s === 408 || s === 429) return true;
    return false;
  }
  // auth / schema / config / unknown 均不重试
  return false;
}
