import { pgEnum } from "drizzle-orm/pg-core";

export const employeeStatusEnum = pgEnum("employee_status", [
  "working",
  "idle",
  "learning",
  "reviewing",
]);

export const authorityLevelEnum = pgEnum("authority_level", [
  "observer",
  "advisor",
  "executor",
  "coordinator",
]);

export const skillCategoryEnum = pgEnum("skill_category", [
  "perception",
  "analysis",
  "generation",
  "production",
  "management",
  "knowledge",
]);

export const skillTypeEnum = pgEnum("skill_type", [
  "builtin",
  "custom",
  "plugin",
]);

// Mission system enums (multi-agent collaboration)
export const missionStatusEnum = pgEnum("mission_status", [
  "queued",
  "planning",
  "executing",
  "coordinating",
  "consolidating",
  "completed",
  "failed",
  "cancelled",
]);

export const missionTaskStatusEnum = pgEnum("mission_task_status", [
  "pending",
  "ready",
  "claimed",
  "in_progress",
  "in_review",
  "completed",
  "failed",
  "cancelled",
  "blocked",
]);

export const missionMessageTypeEnum = pgEnum("mission_message_type", [
  "chat",
  "question",
  "answer",
  "data_handoff",
  "progress_update",
  "task_completed",
  "task_failed",
  "help_request",
  "status_update",
  "result",
  "coordination",
]);

export const missionPhaseEnum = pgEnum("mission_phase", [
  "assembling",
  "decomposing",
  "executing",
  "coordinating",
  "delivering",
]);

// Note: workflowStepStatusEnum and memberTypeEnum removed — replaced by mission system

// CMS & AI Asset Restructuring enums
export const mediaAssetTypeEnum = pgEnum("media_asset_type", [
  "video",
  "image",
  "audio",
  "document",
]);

export const assetProcessingStatusEnum = pgEnum("asset_processing_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const assetTagCategoryEnum = pgEnum("asset_tag_category", [
  "topic",
  "event",
  "emotion",
  "person",
  "location",
  "shotType",
  "quality",
  "object",
  "action",
]);

export const tagSourceEnum = pgEnum("tag_source", ["ai_auto", "human_correct"]);

export const entityTypeEnum = pgEnum("entity_type", [
  "topic",
  "person",
  "event",
  "location",
  "organization",
]);

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "reviewing",
  "approved",
  "published",
  "archived",
]);

export const advisorStatusEnum = pgEnum("advisor_status", [
  "active",
  "training",
  "draft",
]);

export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", [
  "upload",
  "cms",
  "subscription",
]);

export const vectorizationStatusEnum = pgEnum("vectorization_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const syncLogStatusEnum = pgEnum("sync_log_status", [
  "success",
  "error",
  "warning",
]);

export const reviveScenarioEnum = pgEnum("revive_scenario", [
  "topic_match",
  "hot_match",
  "daily_push",
  "intl_broadcast",
  "style_adapt",
]);

export const reviveStatusEnum = pgEnum("revive_status", [
  "pending",
  "adopted",
  "rejected",
]);

export const adaptationStatusEnum = pgEnum("adaptation_status", [
  "completed",
  "in_progress",
  "pending",
]);

// Module 2: Smart Content Production enums

// Hot Topic Sensing (2.3)
export const topicPriorityEnum = pgEnum("topic_priority", ["P0", "P1", "P2"]);

export const topicTrendEnum = pgEnum("topic_trend", [
  "rising",
  "surging",
  "plateau",
  "declining",
]);

export const topicAngleStatusEnum = pgEnum("topic_angle_status", [
  "suggested",
  "accepted",
  "rejected",
]);

// Inspiration Pool: Calendar Events
export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "festival",
  "competition",
  "conference",
  "exhibition",
  "launch",
  "memorial",
]);

export const calendarRecurrenceEnum = pgEnum("calendar_recurrence", [
  "once",
  "yearly",
  "custom",
]);

export const calendarSourceEnum = pgEnum("calendar_source", [
  "builtin",
  "manual",
  "ai_discovered",
]);

export const calendarStatusEnum = pgEnum("calendar_status", [
  "confirmed",
  "pending_review",
]);

// Super Creation Center (2.1)
export const creationSessionStatusEnum = pgEnum("creation_session_status", [
  "active",
  "completed",
  "cancelled",
]);

export const editorTypeEnum = pgEnum("editor_type", ["ai", "human"]);

export const creationChatRoleEnum = pgEnum("creation_chat_role", [
  "editor",
  "ai",
]);

// Benchmarking (2.2)
export const missedTopicPriorityEnum = pgEnum("missed_topic_priority", [
  "high",
  "medium",
  "low",
]);

export const missedTopicTypeEnum = pgEnum("missed_topic_type", [
  "breaking",
  "trending",
  "analysis",
]);

export const missedTopicStatusEnum = pgEnum("missed_topic_status", [
  "missed",
  "tracking",
  "resolved",
]);

// Batch Production (2.4)
export const batchJobStatusEnum = pgEnum("batch_job_status", [
  "pending",
  "processing",
  "completed",
  "cancelled",
  "failed",
]);

export const batchItemStatusEnum = pgEnum("batch_item_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const conversionTaskStatusEnum = pgEnum("conversion_task_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

// Event Auto (2.5)
export const eventTypeEnum = pgEnum("event_type", [
  "sport",
  "conference",
  "festival",
  "exhibition",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "upcoming",
  "live",
  "finished",
]);

export const highlightTypeEnum = pgEnum("highlight_type", [
  "goal",
  "slam_dunk",
  "save",
  "foul",
  "highlight",
  "speech",
  "announcement",
]);

export const eventOutputTypeEnum = pgEnum("event_output_type", [
  "clip",
  "summary",
  "graphic",
  "flash",
  "quote_card",
]);

export const eventOutputStatusEnum = pgEnum("event_output_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

// Module 3: Omnichannel Distribution enums

export const channelStatusEnum = pgEnum("channel_status", [
  "active",
  "paused",
  "setup",
]);

export const publishStatusEnum = pgEnum("publish_status", [
  "scheduled",
  "publishing",
  "published",
  "failed",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
  "escalated",
]);

// Agent Architecture Optimization enums

export const skillBindingTypeEnum = pgEnum("skill_binding_type", [
  "core",
  "extended",
  "knowledge",
]);

export const memoryTypeEnum = pgEnum("memory_type", [
  "feedback",
  "pattern",
  "preference",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "topic_brief",
  "angle_list",
  "material_pack",
  "article_draft",
  "video_plan",
  "review_report",
  "publish_plan",
  "analytics_report",
  "generic",
]);

// Benchmarking deep-dive enums
export const platformCategoryEnum = pgEnum("platform_category", [
  "central",
  "provincial",
  "municipal",
  "industry",
]);

export const crawlStatusEnum = pgEnum("crawl_status", [
  "active",
  "paused",
  "error",
]);

export const benchmarkAlertPriorityEnum = pgEnum("benchmark_alert_priority", [
  "urgent",
  "high",
  "medium",
  "low",
]);

export const benchmarkAlertTypeEnum = pgEnum("benchmark_alert_type", [
  "missed_topic",
  "competitor_highlight",
  "gap_warning",
  "trend_alert",
]);

export const benchmarkAlertStatusEnum = pgEnum("benchmark_alert_status", [
  "new",
  "acknowledged",
  "actioned",
  "dismissed",
]);
