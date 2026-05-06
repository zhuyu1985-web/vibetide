// src/db/schema/research/enums.ts
// A3 Phase 1: newsSourceChannelEnum removed (research_news_articles table dropped)
import { pgEnum } from "drizzle-orm/pg-core";

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
