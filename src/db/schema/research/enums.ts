// src/db/schema/research/enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * 媒体层级（四级分类）
 *  - central: 中央级，如人民日报、新华社
 *  - provincial_municipal: 省/市级（含直辖市），如重庆日报、华龙网
 *  - industry: 行业级，如中国环境报、健康报
 *  - district_media: 区县融媒体，如涪陵发布
 */
export const mediaTierEnum = pgEnum("research_media_tier", [
  "central",
  "provincial_municipal",
  "industry",
  "district_media",
]);

/** 媒体源生命周期 */
export const mediaOutletStatusEnum = pgEnum("research_media_outlet_status", [
  "active",
  "archived",
]);

/** 文章采集通道 */
export const newsSourceChannelEnum = pgEnum("research_news_source_channel", [
  "tavily",          // Tavily 全网搜索
  "whitelist_crawl", // 媒体白名单常态采集
  "manual_url",      // 老师手动粘贴 URL
]);

/** 研究任务状态机 */
export const researchTaskStatusEnum = pgEnum("research_task_status", [
  "pending",
  "crawling",
  "analyzing",
  "done",
  "failed",
  "cancelled",
]);

/** 主题命中方式 */
export const topicMatchTypeEnum = pgEnum("research_topic_match_type", [
  "keyword",
  "semantic",
  "both",
]);

/** 任务级去重口径 */
export const researchDedupLevelEnum = pgEnum("research_dedup_level", [
  "keyword",   // 仅按主题去重（同一文章多主题分别计）
  "district",  // 跨主题去重，按文章去重
  "both",      // 跨区县也去重（按 url_hash）
]);

/** 向量化状态 — 复用 KB 模块同名设计 */
export const researchEmbeddingStatusEnum = pgEnum(
  "research_embedding_status",
  ["pending", "processing", "done", "failed"],
);
