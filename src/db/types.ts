import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  organizations,
  userProfiles,
  roles,
  userRoles,
  aiEmployees,
  employeeMemories,
  workflowArtifacts,
  skills,
  skillFiles,
  skillVersions,
  skillUsageRecords,
  employeeSkills,
  missions,
  missionTasks,
  missionMessages,
  missionArtifacts,
  workflowTemplates,
  workflowTemplateTabOrder,
  tasks,
  knowledgeBases,
  employeeKnowledgeBases,
  categories,
  mediaAssets,
  articles,
  articleAssets,
  assetSegments,
  assetTags,
  detectedFaces,
  knowledgeNodes,
  knowledgeRelations_,
  channelAdvisors,
  channelDnaProfiles,
  knowledgeItems,
  knowledgeSyncLogs,
  reviveRecommendations,
  reviveRecords,
  styleAdaptations,
  internationalAdaptations,
  // Module 3: Omnichannel Distribution
  channels,
  publishPlans,
  channelMetrics,
  reviewResults,
  caseLibrary,
  hitPredictions,
  competitorHits,
  // Module 2: Smart Content Production
  hotTopics,
  topicAngles,
  competitorResponses,
  commentInsights,
  creationSessions,
  contentVersions,
  creationChatMessages,
  competitors,
  missedTopics,
  weeklyReports,
  monitoredPlatforms,
  benchmarkAlerts,
  batchJobs,
  batchItems,
  conversionTasks,
  events,
  eventHighlights,
  eventOutputs,
  eventTranscriptions,
  hotTopicCrawlLogs,
  savedConversations,
} from "./schema";

// RBAC
export type RoleRow = InferSelectModel<typeof roles>;
export type UserRoleRow = InferSelectModel<typeof userRoles>;
export type NewRole = InferInsertModel<typeof roles>;
export type NewUserRole = InferInsertModel<typeof userRoles>;

// Select types (query results)
export type Organization = InferSelectModel<typeof organizations>;
export type UserProfile = InferSelectModel<typeof userProfiles>;
export type AIEmployeeRow = InferSelectModel<typeof aiEmployees>;
export type SkillRow = InferSelectModel<typeof skills>;
export type EmployeeSkillRow = InferSelectModel<typeof employeeSkills>;
export type MissionRow = InferSelectModel<typeof missions>;
export type MissionTaskRow = InferSelectModel<typeof missionTasks>;
export type MissionMessageRow = InferSelectModel<typeof missionMessages>;
export type WorkflowTemplateRow = InferSelectModel<typeof workflowTemplates>;
export type TaskRow = InferSelectModel<typeof tasks>;
export type KnowledgeBaseRow = InferSelectModel<typeof knowledgeBases>;
export type EmployeeKnowledgeBaseRow = InferSelectModel<
  typeof employeeKnowledgeBases
>;
export type CategoryRow = InferSelectModel<typeof categories>;
export type MediaAssetRow = InferSelectModel<typeof mediaAssets>;
export type ArticleRow = InferSelectModel<typeof articles>;
export type ArticleAssetRow = InferSelectModel<typeof articleAssets>;
export type AssetSegmentRow = InferSelectModel<typeof assetSegments>;
export type AssetTagRow = InferSelectModel<typeof assetTags>;
export type DetectedFaceRow = InferSelectModel<typeof detectedFaces>;
export type KnowledgeNodeRow = InferSelectModel<typeof knowledgeNodes>;
export type KnowledgeRelationRow = InferSelectModel<typeof knowledgeRelations_>;
export type ChannelAdvisorRow = InferSelectModel<typeof channelAdvisors>;
export type ChannelDnaProfileRow = InferSelectModel<typeof channelDnaProfiles>;
export type KnowledgeItemRow = InferSelectModel<typeof knowledgeItems>;
export type KnowledgeSyncLogRow = InferSelectModel<typeof knowledgeSyncLogs>;
export type ReviveRecommendationRow = InferSelectModel<
  typeof reviveRecommendations
>;
export type ReviveRecordRow = InferSelectModel<typeof reviveRecords>;
export type StyleAdaptationRow = InferSelectModel<typeof styleAdaptations>;
export type InternationalAdaptationRow = InferSelectModel<
  typeof internationalAdaptations
>;

// Insert types (for creating records)
export type NewOrganization = InferInsertModel<typeof organizations>;
export type NewUserProfile = InferInsertModel<typeof userProfiles>;
export type NewAIEmployee = InferInsertModel<typeof aiEmployees>;
export type NewSkill = InferInsertModel<typeof skills>;
export type NewEmployeeSkill = InferInsertModel<typeof employeeSkills>;
export type NewMission = InferInsertModel<typeof missions>;
export type NewMissionTask = InferInsertModel<typeof missionTasks>;
export type NewMissionMessage = InferInsertModel<typeof missionMessages>;
export type MissionArtifactRow = InferSelectModel<typeof missionArtifacts>;
export type NewMissionArtifact = InferInsertModel<typeof missionArtifacts>;
export type NewWorkflowTemplate = InferInsertModel<typeof workflowTemplates>;
export type NewTask = InferInsertModel<typeof tasks>;
export type NewKnowledgeBase = InferInsertModel<typeof knowledgeBases>;
export type NewCategory = InferInsertModel<typeof categories>;
export type NewMediaAsset = InferInsertModel<typeof mediaAssets>;
export type NewArticle = InferInsertModel<typeof articles>;
export type NewArticleAsset = InferInsertModel<typeof articleAssets>;
export type NewAssetSegment = InferInsertModel<typeof assetSegments>;
export type NewAssetTag = InferInsertModel<typeof assetTags>;
export type NewDetectedFace = InferInsertModel<typeof detectedFaces>;
export type NewKnowledgeNode = InferInsertModel<typeof knowledgeNodes>;
export type NewKnowledgeRelation = InferInsertModel<typeof knowledgeRelations_>;
export type NewChannelAdvisor = InferInsertModel<typeof channelAdvisors>;
export type NewChannelDnaProfile = InferInsertModel<typeof channelDnaProfiles>;
export type NewKnowledgeItem = InferInsertModel<typeof knowledgeItems>;
export type NewKnowledgeSyncLog = InferInsertModel<typeof knowledgeSyncLogs>;
export type NewReviveRecommendation = InferInsertModel<
  typeof reviveRecommendations
>;
export type NewReviveRecord = InferInsertModel<typeof reviveRecords>;
export type NewStyleAdaptation = InferInsertModel<typeof styleAdaptations>;
export type NewInternationalAdaptation = InferInsertModel<
  typeof internationalAdaptations
>;

// Module 3: Omnichannel Distribution
export type ChannelRow = InferSelectModel<typeof channels>;
export type PublishPlanRow = InferSelectModel<typeof publishPlans>;
export type ChannelMetricRow = InferSelectModel<typeof channelMetrics>;
export type ReviewResultRow = InferSelectModel<typeof reviewResults>;
export type CaseLibraryRow = InferSelectModel<typeof caseLibrary>;
export type HitPredictionRow = InferSelectModel<typeof hitPredictions>;
export type CompetitorHitRow = InferSelectModel<typeof competitorHits>;
export type NewChannel = InferInsertModel<typeof channels>;
export type NewPublishPlan = InferInsertModel<typeof publishPlans>;
export type NewChannelMetric = InferInsertModel<typeof channelMetrics>;
export type NewReviewResult = InferInsertModel<typeof reviewResults>;
export type NewCaseLibraryItem = InferInsertModel<typeof caseLibrary>;
export type NewHitPrediction = InferInsertModel<typeof hitPredictions>;
export type NewCompetitorHit = InferInsertModel<typeof competitorHits>;

// Module 2: Smart Content Production
// Hot Topics (2.3)
export type HotTopicRow = InferSelectModel<typeof hotTopics>;
export type TopicAngleRow = InferSelectModel<typeof topicAngles>;
export type CompetitorResponseRow = InferSelectModel<typeof competitorResponses>;
export type CommentInsightRow = InferSelectModel<typeof commentInsights>;
export type NewHotTopic = InferInsertModel<typeof hotTopics>;
export type NewTopicAngle = InferInsertModel<typeof topicAngles>;
export type NewCompetitorResponse = InferInsertModel<typeof competitorResponses>;
export type NewCommentInsight = InferInsertModel<typeof commentInsights>;

// Creation (2.1)
export type CreationSessionRow = InferSelectModel<typeof creationSessions>;
export type ContentVersionRow = InferSelectModel<typeof contentVersions>;
export type CreationChatMessageRow = InferSelectModel<typeof creationChatMessages>;
export type NewCreationSession = InferInsertModel<typeof creationSessions>;
export type NewContentVersion = InferInsertModel<typeof contentVersions>;
export type NewCreationChatMessage = InferInsertModel<typeof creationChatMessages>;

// Benchmarking (legacy tables — benchmark_analyses / platform_content drop 在 topic-compare v2 重构中)
export type CompetitorRow = InferSelectModel<typeof competitors>;
export type MissedTopicRow = InferSelectModel<typeof missedTopics>;
export type WeeklyReportRow = InferSelectModel<typeof weeklyReports>;
export type NewCompetitor = InferInsertModel<typeof competitors>;
export type NewMissedTopic = InferInsertModel<typeof missedTopics>;
export type NewWeeklyReport = InferInsertModel<typeof weeklyReports>;

// Benchmarking Deep-Dive
export type MonitoredPlatformRow = InferSelectModel<typeof monitoredPlatforms>;
export type BenchmarkAlertRow = InferSelectModel<typeof benchmarkAlerts>;
export type NewMonitoredPlatform = InferInsertModel<typeof monitoredPlatforms>;
export type NewBenchmarkAlert = InferInsertModel<typeof benchmarkAlerts>;

// Batch Production (2.4)
export type BatchJobRow = InferSelectModel<typeof batchJobs>;
export type BatchItemRow = InferSelectModel<typeof batchItems>;
export type ConversionTaskRow = InferSelectModel<typeof conversionTasks>;
export type NewBatchJob = InferInsertModel<typeof batchJobs>;
export type NewBatchItem = InferInsertModel<typeof batchItems>;
export type NewConversionTask = InferInsertModel<typeof conversionTasks>;

// Events (2.5)
export type EventRow = InferSelectModel<typeof events>;
export type EventHighlightRow = InferSelectModel<typeof eventHighlights>;
export type EventOutputRow = InferSelectModel<typeof eventOutputs>;
export type EventTranscriptionRow = InferSelectModel<typeof eventTranscriptions>;
export type NewEvent = InferInsertModel<typeof events>;
export type NewEventHighlight = InferInsertModel<typeof eventHighlights>;
export type NewEventOutput = InferInsertModel<typeof eventOutputs>;
export type NewEventTranscription = InferInsertModel<typeof eventTranscriptions>;

// Employee Memories
export type EmployeeMemoryRow = InferSelectModel<typeof employeeMemories>;
export type NewEmployeeMemory = InferInsertModel<typeof employeeMemories>;

// Workflow Artifacts
export type WorkflowArtifactRow = InferSelectModel<typeof workflowArtifacts>;
export type NewWorkflowArtifact = InferInsertModel<typeof workflowArtifacts>;

// Homepage Template Tab Order (per-tab drag / pin state for /home)
export type WorkflowTemplateTabOrderRow = InferSelectModel<
  typeof workflowTemplateTabOrder
>;
export type NewWorkflowTemplateTabOrder = InferInsertModel<
  typeof workflowTemplateTabOrder
>;

// Skill Files
export type SkillFileRow = InferSelectModel<typeof skillFiles>;
export type NewSkillFile = InferInsertModel<typeof skillFiles>;

// Skill Versions
export type SkillVersionRow = InferSelectModel<typeof skillVersions>;
export type NewSkillVersion = InferInsertModel<typeof skillVersions>;

// Skill Usage Records
export type SkillUsageRecordRow = InferSelectModel<typeof skillUsageRecords>;
export type NewSkillUsageRecord = InferInsertModel<typeof skillUsageRecords>;

// Hot Topic Crawl Logs
export type HotTopicCrawlLogRow = InferSelectModel<typeof hotTopicCrawlLogs>;
export type NewHotTopicCrawlLog = InferInsertModel<typeof hotTopicCrawlLogs>;

// Saved Conversations
export type SavedConversationRow = InferSelectModel<typeof savedConversations>;
export type NewSavedConversation = InferInsertModel<typeof savedConversations>;
