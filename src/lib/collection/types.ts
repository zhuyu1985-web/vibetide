import type { ZodTypeAny } from "zod";

// ───────────────────────────────────────────────────────────
// 采集原材料 — Adapter 产出,Writer 消费
// ───────────────────────────────────────────────────────────
export interface RawItem {
  title: string;
  url?: string;
  content?: string;
  summary?: string;
  publishedAt?: Date;
  /** e.g. "tophub/weibo", "rss/36kr", "tavily" */
  channel: string;
  rawMetadata?: Record<string, unknown>;
}

// ───────────────────────────────────────────────────────────
// Adapter 执行上下文
// ───────────────────────────────────────────────────────────
export type LogLevel = "info" | "warn" | "error";

export interface AdapterContext<TConfig = unknown> {
  config: TConfig;
  sourceId: string;
  organizationId: string;
  runId: string;
  log: (level: LogLevel, message: string, meta?: Record<string, unknown>) => void;
}

export interface AdapterResult {
  items: RawItem[];
  partialFailures?: { message: string; meta?: Record<string, unknown> }[];
}

// ───────────────────────────────────────────────────────────
// 配置表单字段声明(后台 UI 自动渲染,Phase 1 才用)
// ───────────────────────────────────────────────────────────
export type ConfigFieldType =
  | "text"
  | "url"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "boolean"
  | "kv";

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  validation?: { pattern?: string; min?: number; max?: number };
}

// ───────────────────────────────────────────────────────────
// Adapter 主接口
// ───────────────────────────────────────────────────────────
export type AdapterCategory =
  | "aggregator"
  | "search"
  | "url"
  | "list"
  | "feed";

export interface SourceAdapter<TConfig = unknown> {
  readonly type: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: AdapterCategory;
  readonly configSchema: ZodTypeAny;
  readonly configFields: ConfigField[];
  execute(ctx: AdapterContext<TConfig>): Promise<AdapterResult>;
  /** Optional 试运行预览(V2 才用) */
  preview?(config: TConfig): Promise<RawItem[]>;
}

// ───────────────────────────────────────────────────────────
// Writer 入口参数
// ───────────────────────────────────────────────────────────
export interface WriteArgs {
  runId: string;
  sourceId: string;
  organizationId: string;
  items: RawItem[];
  /** 源的 targetModules / defaultCategory / defaultTags */
  source: {
    targetModules: string[];
    defaultCategory: string | null;
    defaultTags: string[] | null;
  };
}

export interface WriteResult {
  inserted: number;
  merged: number;
  failed: number;
}
