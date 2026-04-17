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
  "manuscript",
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

export const missedTopicSourceTypeEnum = pgEnum("missed_topic_source_type", [
  "social_hot",
  "sentiment_event",
  "benchmark_media",
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
  "success_pattern",
  "failure_lesson",
  "user_preference",
  "skill_insight",
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

// Article detail / news reader enums
export const annotationColorEnum = pgEnum("annotation_color", [
  "red",
  "yellow",
  "green",
  "blue",
  "purple",
]);

export const aiAnalysisPerspectiveEnum = pgEnum("ai_analysis_perspective", [
  "summary",
  "journalist",
  "quotes",
  "timeline",
  "qa",
  "deep",
]);

export const aiSentimentEnum = pgEnum("ai_sentiment", [
  "neutral",
  "bullish",
  "critical",
  "advertorial",
]);

// Smart Media Asset (智能媒资) module enums

export const libraryTypeEnum = pgEnum("library_type", [
  "personal",
  "product",
  "public",
]);

export const securityLevelEnum = pgEnum("security_level", [
  "public",
  "secret",
  "private",
  "top_secret",
  "confidential",
]);

export const mediaCatalogStatusEnum = pgEnum("media_catalog_status", [
  "uncataloged",
  "cataloged",
]);

export const mediaTranscodeStatusEnum = pgEnum("media_transcode_status", [
  "not_started",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const mediaCdnStatusEnum = pgEnum("media_cdn_status", [
  "not_started",
  "processing",
  "completed",
  "failed",
  "revoked",
]);

export const mediaCmsStatusEnum = pgEnum("media_cms_status", [
  "not_started",
  "processing",
  "completed",
  "failed",
  "revoked",
]);

export const mediaReviewStatusEnum = pgEnum("media_review_status", [
  "not_submitted",
  "pending",
  "reviewing",
  "approved",
  "rejected",
]);

export const shareStatusEnum = pgEnum("share_status", [
  "active",
  "expired",
  "cancelled",
]);

// Category permission enums
export const categoryPermissionTypeEnum = pgEnum("category_permission_type", [
  "read",   // 查看栏目及资源
  "write",  // 上传、编辑、删除资源
  "manage", // 管理栏目设置和权限
]);

export const permissionGranteeTypeEnum = pgEnum("permission_grantee_type", [
  "user",  // 指定用户
  "role",  // 按角色（admin/editor/viewer）
]);

// Cognitive Engine enums

export const verificationLevelEnum = pgEnum("verification_level", [
  "simple",
  "important",
  "critical",
]);

export const verifierTypeEnum = pgEnum("verifier_type", [
  "self_eval",
  "cross_review",
  "human",
]);

export const learningSourceEnum = pgEnum("learning_source", [
  "assigned",
  "discovered",
  "recommended",
]);

// Workflow template enums

export const workflowCategoryEnum = pgEnum("workflow_category", [
  "news",
  "video",
  "analytics",
  "distribution",
  "custom",
]);

export const workflowTriggerTypeEnum = pgEnum("workflow_trigger_type", [
  "manual",
  "scheduled",
]);

// Audit system enums (三级审核体系)

export const auditStageEnum = pgEnum("audit_stage", [
  "review_1",
  "review_2",
  "review_3",
]);

export const auditResultEnum = pgEnum("audit_result", [
  "pass",
  "warning",
  "fail",
]);

export const auditModeEnum = pgEnum("audit_mode", [
  "auto",
  "human",
  "hybrid",
]);

export const trailActionEnum = pgEnum("trail_action", [
  "create",
  "edit",
  "review",
  "approve",
  "reject",
  "publish",
]);

export const trailStageEnum = pgEnum("trail_stage", [
  "planning",
  "writing",
  "review_1",
  "review_2",
  "review_3",
  "publishing",
]);

// Channel integration enums (钉钉 / 企业微信)

export const channelPlatformEnum = pgEnum("channel_platform", [
  "dingtalk",
  "wechat_work",
]);

export const channelMessageDirectionEnum = pgEnum(
  "channel_message_direction",
  ["inbound", "outbound"]
);

export const channelMessageStatusEnum = pgEnum("channel_message_status", [
  "received",
  "processed",
  "sent",
  "failed",
]);
