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
  contentType?: "image_text" | "video" | "short_video" | "image_set" | "audio" | "live";
  attachments?: Array<{
    kind: "video" | "image" | "audio" | "thumbnail";
    url: string;
    thumbnailUrl?: string;
    mimeType?: string;
    durationMs?: number;
    width?: number;
    height?: number;
    fileSizeBytes?: number;
    extra?: Record<string, unknown>;
  }>;

  // ── 舆情/账号身份字段(对齐 docs/data.xlsx 33 列;adapter 可选填) ──
  /** 平台原生帖子 ID(微信文章 sn / 微博 mid / 抖音 aweme_id 等) */
  externalId?: string;
  /** 归一化的平台中文名:微信/今日头条/微博/抖音/B 站/小红书/知乎 ... */
  platform?: string;
  /** 作者昵称 */
  author?: string;
  /** 平台用户 ID(数字 uid / sec_uid / openid 等) */
  accountId?: string;
  /** 账号短 ID / handle(如 gh_xxx) */
  accountHandle?: string;
  /** 采集时刻账号粉丝数快照 */
  authorFollowerCount?: number;

  /** 情感倾向:非敏感 / 中性 / 敏感 / 正面 / 负面 */
  sentiment?: string;
  /** 信息类型:原创 / 转发 / 评论 ... */
  infoType?: string;

  /** 互动指标(舆情系统排序核心维度) */
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  viewCount?: number;
  favoriteCount?: number;
  replyCount?: number;

  /** 作者 IP 属地(省级,"北京市") */
  ipRegion?: string;
  /** 用户填写发布地(可下钻乡镇,如"重庆市,涪陵区") */
  postRegion?: string;
  /** NLP 抽取的提及地多值 */
  mentionedRegions?: string[];

  /** 命中的监测关键词 */
  matchedKeywords?: string[];
  /** 命中的监测地域 */
  matchedRegions?: string[];

  /** 行业分类多值(覆盖 source.defaultCategory 单值) */
  industries?: string[];

  /** 封面图直链 */
  coverImageUrl?: string;
  /** 视频/音频时长(秒) */
  durationSeconds?: number;

  /** OCR 提取文本(图片/视频帧) */
  ocrText?: string;
  /** ASR 转写文本(音视频) */
  asrText?: string;
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
  runMetadata?: Record<string, unknown>;
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
  /** UI 提示:这是个站点 URL 字段,在 wizard 里渲染"从媒体字典选"按钮。
   *  选中后:把选中的 channels[type=website].url 写回此字段,并把所属 outlet 自动绑定到 source。 */
  pickFromOutletWebsite?: boolean;
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
  /** 源的 targetModules / defaultCategory / defaultTags 及 outlet 配置 */
  source: {
    targetModules: string[];
    defaultCategory: string | null;
    defaultTags: string[] | null;
    outletId?: string | null;
    defaultOutletTier?: string | null;
    defaultOutletRegion?: string | null;
  };
  /** Adapter 回报的额外运行指标（如 tikhubCostUsd），合并写入 collection_runs.metadata */
  runMetadata?: Record<string, unknown>;
  /**
   * 去重策略(默认 'url_and_fingerprint',即 URL 优先 + 标题日期兜底)。
   * - 'url_only':只按 URL hash 合并;URL 不命中(或没 URL)就新建,不再用 title+publishedAt fingerprint 去合并。
   *   适用场景:舆情 Excel 导入 — 不同媒体转发同标题应保留为独立条目。
   * - 'url_and_fingerprint':保留原行为,适合常规 adapter(避免同一抓取源短期内重复入库)。
   */
  dedupStrategy?: "url_only" | "url_and_fingerprint";
}

export interface WriteResult {
  inserted: number;
  merged: number;
  failed: number;
  /** ID 列表：本次新增（isNew=true）的 collected_items。供同步 caller 立即桥接到下游模块（hot_topics 等），无需依赖 Inngest fanout。 */
  insertedItemIds: string[];
}
