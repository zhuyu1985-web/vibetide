// src/db/schema/research/enums.ts
// A3 Phase 1: newsSourceChannelEnum removed (research_news_articles table dropped)
// 2026-05-13: researchTaskStatusEnum + researchDedupLevelEnum removed
// (/research/admin/tasks 整体下线,采集任务统一到 Collection Hub)
import { pgEnum } from "drizzle-orm/pg-core";

/** 主题命中方式 */
export const topicMatchTypeEnum = pgEnum("research_topic_match_type", [
  "keyword",
  "semantic",
  "both",
]);

/** 向量化状态 — 复用 KB 模块同名设计 */
export const researchEmbeddingStatusEnum = pgEnum(
  "research_embedding_status",
  ["pending", "processing", "done", "failed"],
);
