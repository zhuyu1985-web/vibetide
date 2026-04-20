import type { EmployeeId } from "./constants";

export type AnyEmployeeId = EmployeeId | (string & {});

export type EmployeeStatus = "working" | "idle" | "learning" | "reviewing";

export interface AIEmployee {
  id: EmployeeId;
  dbId: string;
  name: string;
  nickname: string;
  title: string;
  motto: string;
  status: EmployeeStatus;
  currentTask?: string;
  skills: Skill[];
  stats: {
    tasksCompleted: number;
    accuracy: number;
    avgResponseTime: string;
    satisfaction: number;
  };
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  version: string;
  level: number;
  type: "builtin" | "custom" | "plugin";
  description: string;
  bindingType?: "core" | "extended" | "knowledge";
}

export type SkillCategory =
  | "perception"
  | "analysis"
  | "generation"
  | "production"
  | "management"
  | "knowledge";

export type TopicPriority = "P0" | "P1" | "P2";
export type TopicTrend = "rising" | "surging" | "plateau" | "declining";

export interface HotTopic {
  id: string;
  title: string;
  priority: TopicPriority;
  heatScore: number;
  trend: TopicTrend;
  source: string;
  category: string;
  discoveredAt: string;
  heatCurve: { time: string; value: number }[];
  suggestedAngles: string[];
  competitorResponse: string[];
  relatedAssets: string[];
  summary: string;
}

export type MessageType =
  | "alert"
  | "decision_request"
  | "status_update"
  | "work_output";

export interface TeamMessage {
  id: string;
  employeeId: EmployeeId;
  type: MessageType;
  content: string;
  timestamp: string;
  actions?: MessageAction[];
  attachments?: MessageAttachment[];
  workflowInstanceId?: string;
  workflowStepId?: string;
}

export interface MessageAction {
  label: string;
  variant: "default" | "primary" | "destructive";
  stepId?: string;
}

export interface MessageAttachment {
  type: "topic_card" | "draft_preview" | "chart" | "asset";
  title: string;
  description?: string;
}

export interface CreationTask {
  id: string;
  title: string;
  mediaType: "article" | "video" | "audio" | "h5";
  status: "drafting" | "reviewing" | "approved" | "published";
  assignee: EmployeeId;
  content: {
    headline: string;
    body: string;
    imageNotes?: string[];
  };
  advisorNotes?: string[];
  createdAt: string;
  wordCount: number;
}

export interface MediaAsset {
  id: string;
  type: "image" | "video" | "audio" | "document";
  title: string;
  source: string;
  tags: string[];
  usageCount: number;
  addedAt: string;
}

export interface ChannelConfig {
  id: string;
  name: string;
  platform: string;
  icon: string;
  followers: number;
  status: "active" | "paused" | "setup";
}

export interface PublishPlan {
  id: string;
  taskId?: string;
  channelId: string;
  channelName?: string;
  scheduledAt: string;
  publishedAt?: string;
  status: "scheduled" | "publishing" | "published" | "failed";
  title: string;
  adaptedContent?: {
    headline?: string;
    body?: string;
    coverImage?: string;
    tags?: string[];
    format?: string;
  };
}

export interface ChannelMetrics {
  id?: string;
  channelId: string;
  channelName?: string;
  date: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  followers: number;
  engagement: number;
}

// ---------------------------------------------------------------------------
// Module 3: Omnichannel Distribution
// ---------------------------------------------------------------------------

export type ReviewStatus = "pending" | "approved" | "rejected" | "escalated";

export interface ReviewResult {
  id: string;
  contentId: string;
  contentType: string;
  reviewerEmployeeId: string;
  reviewerName?: string;
  status: ReviewStatus;
  issues: ReviewIssue[];
  score: number | null;
  channelRules?: {
    channelId?: string;
    strictnessLevel?: string;
    customRules?: string[];
  };
  escalatedAt?: string;
  escalationReason?: string;
  createdAt: string;
}

export interface ReviewIssue {
  type: string;
  severity: "high" | "medium" | "low";
  location: string;
  description: string;
  suggestion: string;
  resolved: boolean;
}

export interface CaseLibraryItem {
  id: string;
  contentId: string;
  title: string;
  channel: string | null;
  score: number;
  successFactors: {
    titleStrategy?: string;
    topicAngle?: string;
    contentStructure?: string;
    emotionalResonance?: string;
  } | null;
  tags: string[];
  publishedAt?: string;
  createdAt: string;
}

export interface HitPrediction {
  id: string;
  contentId: string;
  predictedScore: number;
  actualScore: number | null;
  dimensions: {
    titleAppeal?: number;
    topicRelevance?: number;
    contentDepth?: number;
    emotionalHook?: number;
    timingFit?: number;
  } | null;
  suggestions: HitSuggestion[];
  suggestionsAdopted: number;
  createdAt: string;
}

export interface HitSuggestion {
  area: string;
  current: string;
  recommended: string;
  impact: string;
}

export interface CompetitorHit {
  id: string;
  competitorName: string;
  title: string;
  platform: string;
  metrics: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  } | null;
  successFactors: {
    titleStrategy?: string;
    topicAngle?: string;
    contentStructure?: string;
    emotionalResonance?: string;
  } | null;
  analyzedAt: string;
}

export interface SixDimensionScore {
  dimension: string;
  score: number;
}

export interface ContentEffectScore {
  contentId: string;
  title: string;
  score: number;
  breakdown: {
    views: number;
    likes: number;
    shares: number;
    comments: number;
    followers: number;
  };
}

export interface WeeklyAnalyticsStats {
  totalViews: number;
  totalViewsChange: number;
  avgEngagement: number;
  avgEngagementChange: number;
  totalFollowersGain: number;
  totalFollowersGainChange: number;
  contentPublished: number;
  contentPublishedChange: number;
  hitRate: number;
  hitRateChange: number;
  avgReadTime: string;
}

export interface TopContentItem {
  title: string;
  channel: string;
  views: number;
  likes: number;
  date: string;
  score?: number;
}

export interface Competitor {
  id: string;
  name: string;
  platform: string;
  followers: number;
  avgViews: number;
  publishFreq: string;
  strengths: string[];
  gaps: string[];
}

export interface ChannelAdvisor {
  id: string;
  name: string;
  personality: string;
  channelType: string;
  avatar: string;
  style: string;
  strengths: string[];
  catchphrase: string;
  status: "active" | "training" | "draft";
}

// ---------------------------------------------------------------------------
// Scenario Workbench
// ---------------------------------------------------------------------------

export interface ScenarioCardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  welcomeMessage?: string | null;
  inputFields: InputFieldDef[];
  toolsHint: string[];
}

export type InputFieldOption = string | { value: string; label: string };

export interface InputFieldDef {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "multiselect"
    | "date"
    | "daterange"
    | "url"
    | "number"
    | "toggle";
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: InputFieldOption[];
  helpText?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export function normalizeFieldOption(opt: InputFieldOption): { value: string; label: string } {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

export type AuthorityLevel = "observer" | "advisor" | "executor" | "coordinator";

export interface WorkPreferences {
  proactivity: string;
  reportingFrequency: string;
  autonomyLevel: number;
  communicationStyle: string;
  workingHours: string;
}

export interface KnowledgeBaseInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  documentCount: number;
}

// ---------------------------------------------------------------------------
// Knowledge Base Management Module (full management UI)
// ---------------------------------------------------------------------------

export type KBVectorizationStatus = "pending" | "processing" | "done" | "failed";

export type KBType = "general" | "channel_style" | "sensitive_topics" | "domain_specific";

export interface KBSummary {
  id: string;
  name: string;
  description: string;
  type: string;
  documentCount: number;
  chunkCount: number;
  vectorizationStatus: KBVectorizationStatus;
  boundEmployeeCount: number;
  lastSyncAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface KBDetail extends KBSummary {
  sourceType: string;
  sourceUrl: string | null;
}

export interface KBItemRow {
  id: string;
  title: string;
  snippet: string;
  fullContent: string;
  sourceDocument: string | null;
  sourceType: string;
  tags: string[];
  chunkIndex: number;
  hasEmbedding: boolean;
  createdAt: string;
}

export interface KBSyncLogRow {
  id: string;
  action: string;
  status: "success" | "error" | "warning";
  detail: string;
  documentsProcessed: number;
  chunksGenerated: number;
  errorsCount: number;
  createdAt: string;
}

export interface KBBindingRow {
  employeeDbId: string;
  employeeSlug: string;
  employeeName: string;
  employeeNickname: string;
}

export interface KBItemListResult {
  items: KBItemRow[];
  total: number;
  page: number;
  pageSize: number;
}

export type LearnedPatterns = Record<
  string,
  {
    source: "human_feedback" | "quality_review" | "self_reflection";
    count: number;
    lastSeen: string;
  }
>;

export interface EmployeeFullProfile extends AIEmployee {
  dbId: string;
  roleType: string;
  authorityLevel: AuthorityLevel;
  autoActions: string[];
  needApprovalActions: string[];
  workPreferences: WorkPreferences | null;
  learnedPatterns: LearnedPatterns;
  isPreset: boolean;
  disabled: boolean;
  knowledgeBases: KnowledgeBaseInfo[];
}

// ---------------------------------------------------------------------------
// Mission System (multi-agent collaboration)
// ---------------------------------------------------------------------------

export type MissionStatus =
  | "queued"
  | "planning"
  | "executing"
  | "coordinating"
  | "consolidating"
  | "completed"
  | "failed"
  | "cancelled";

export type MissionTaskStatus =
  | "pending"
  | "ready"
  | "claimed"
  | "in_progress"
  | "in_review"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked";

export type MissionPhase =
  | "assembling"
  | "decomposing"
  | "executing"
  | "coordinating"
  | "delivering";

export type MissionMessageType =
  | "chat"
  | "question"
  | "answer"
  | "data_handoff"
  | "progress_update"
  | "task_completed"
  | "task_failed"
  | "help_request"
  | "status_update"
  | "result"
  | "coordination";

export interface Mission {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  scenario: string;
  userInstruction: string;
  leaderEmployeeId: string;
  teamMembers: string[];
  status: MissionStatus;
  phase?: MissionPhase;
  progress: number;
  config?: { max_retries: number; task_timeout: number; max_agents: number; archived?: boolean; archivedAt?: string };
  finalOutput: unknown | null;
  tokenBudget: number;
  tokensUsed: number;
  sourceModule?: string | null;
  sourceEntityId?: string | null;
  sourceEntityType?: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface MissionTask {
  id: string;
  missionId: string;
  title: string;
  description: string;
  expectedOutput: string | null;
  acceptanceCriteria?: string;
  assignedEmployeeId: string | null;
  assignedRole?: string;
  assignedEmployee?: AIEmployee;
  status: MissionTaskStatus;
  dependencies: string[];
  priority: number;
  phase?: number;
  progress: number;
  inputContext: unknown | null;
  outputData: unknown | null;
  outputSummary?: string;
  errorMessage: string | null;
  errorRecoverable: boolean;
  retryCount: number;
  claimedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MissionMessage {
  id: string;
  missionId: string;
  fromEmployeeId: string;
  fromEmployee?: AIEmployee;
  toEmployeeId: string | null;
  messageType: MissionMessageType;
  content: string;
  channel: string;
  structuredData?: unknown;
  priority: string;
  replyTo?: string;
  relatedTaskId: string | null;
  createdAt: string;
}

export interface MissionArtifact {
  id: string;
  missionId: string;
  taskId: string | null;
  producedBy: string;
  type: string;
  title: string;
  content: string | null;
  fileUrl: string | null;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: string;
}

export interface MissionWithDetails extends Mission {
  tasks: MissionTask[];
  messages: MissionMessage[];
  artifacts: MissionArtifact[];
  leader: AIEmployee;
  team: AIEmployee[];
  /** Phase 4A: server-resolved scenario display info (mirrors
   *  MissionSummary.scenarioLabel/… so the mission console can render the
   *  scenario pill without reaching into SCENARIO_CONFIG). */
  scenarioLabel: string;
  scenarioCategory: string | null;
  scenarioIcon: string | null;
  workflowTemplateId: string | null;
}

// ---------------------------------------------------------------------------
// 智能媒资 - 页面1: 媒资智能理解
// ---------------------------------------------------------------------------

export type AssetTagCategory =
  | "topic"
  | "event"
  | "emotion"
  | "person"
  | "location"
  | "shotType"
  | "quality"
  | "object"
  | "action";

export interface AssetTag {
  id: string;
  category: AssetTagCategory;
  label: string;
  confidence: number;
}

export interface DetectedFace {
  id: string;
  name: string;
  role: string;
  confidence: number;
  appearances: number;
}

export interface VideoSegment {
  id: string;
  startTime: string;
  endTime: string;
  transcript: string;
  ocrTexts: string[];
  nluSummary: string;
  tags: AssetTag[];
  detectedFaces: DetectedFace[];
  sceneType: string;
  visualQuality: number;
}

export interface IntelligentAsset {
  id: string;
  title: string;
  type: MediaAssetType;
  duration: string;
  fileSize: string;
  thumbnailPlaceholder: string;
  status: AssetProcessingStatus;
  progress: number;
  segments: VideoSegment[];
  totalTags: number;
  createdAt: string;
  processedAt: string;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: "topic" | "person" | "event" | "location" | "organization";
  connections: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface SemanticSearchResult {
  assetId: string;
  assetTitle: string;
  segmentId: string;
  timestamp: string;
  matchedText: string;
  relevanceScore: number;
  tags: string[];
}

// ---------------------------------------------------------------------------
// 智能媒资 - 页面2: 频道知识库
// ---------------------------------------------------------------------------

export type KnowledgeSourceType = "upload" | "cms" | "subscription";
export type KnowledgeSourceStatus = "active" | "syncing" | "error" | "pending";

export interface KnowledgeSource {
  id: string;
  name: string;
  type: KnowledgeSourceType;
  status: KnowledgeSourceStatus;
  documentCount: number;
  chunkCount: number;
  lastSyncAt: string;
  format: string;
  sizeDisplay: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  source: string;
  sourceType: KnowledgeSourceType;
  snippet: string;
  tags: string[];
  relevanceScore: number;
  createdAt: string;
  chunkIndex: number;
}

export interface ChannelDNA {
  dimension: string;
  score: number;
}

export interface KnowledgeSyncLog {
  id: string;
  action: string;
  timestamp: string;
  status: "success" | "error" | "warning";
  detail: string;
}

// ---------------------------------------------------------------------------
// 智能媒资 - 页面3: 资产盘活中心
// ---------------------------------------------------------------------------

export type ReviveScenario =
  | "topic_match"
  | "hot_match"
  | "daily_push"
  | "intl_broadcast"
  | "style_adapt";

export interface ReviveRecommendation {
  id: string;
  scenario: ReviveScenario;
  originalAsset: string;
  reason: string;
  matchScore: number;
  matchedTopic: string;
  suggestedAction: string;
  estimatedReach: string;
  status: "pending" | "adopted" | "rejected";
}

export interface HotTopicMatch {
  hotTopic: string;
  heatScore: number;
  matchedAssets: {
    assetTitle: string;
    matchScore: number;
    suggestedAngle: string;
  }[];
}

export interface StyleVariant {
  style: string;
  styleLabel: string;
  title: string;
  excerpt: string;
  tone: string;
}

export interface InternationalAdaptation {
  language: string;
  languageCode: string;
  flag: string;
  title: string;
  excerpt: string;
  adaptationNotes: string;
  status: "completed" | "in_progress" | "pending";
}

export interface ReviveMetrics {
  reuseRate: number;
  reuseRateChange: number;
  adoptionRate: number;
  adoptionRateChange: number;
  secondaryCreationCount: number;
  secondaryCreationCountChange: number;
  reachMultiplier: number;
  reachMultiplierChange: number;
}

// ---------------------------------------------------------------------------
// CMS: Media Asset Library
// ---------------------------------------------------------------------------

export type MediaAssetType = "video" | "image" | "audio" | "document" | "manuscript";
export type MediaLibraryType = "personal" | "product" | "public" | "copyright" | "knowledge" | "sharing" | "recycle";
export type SecurityLevel = "public" | "secret" | "private" | "top_secret" | "confidential";
export type MediaReviewStatus = "not_submitted" | "pending" | "reviewing" | "approved" | "rejected";
export type CatalogStatus = "uncataloged" | "cataloged";
export type TranscodeStatus = "not_started" | "processing" | "completed" | "failed" | "cancelled";
export type CdnCmsStatus = "not_started" | "processing" | "completed" | "failed" | "revoked";
export type AssetProcessingStatus = "queued" | "processing" | "completed" | "failed";

export interface MediaAssetListItem {
  id: string;
  title: string;
  type: MediaAssetType;
  duration?: string;
  fileSize: number;
  fileSizeDisplay?: string;
  thumbnailUrl?: string;
  understandingStatus: AssetProcessingStatus;
  tags: string[];
  usageCount: number;
  categoryName?: string;
  createdAt: string;
}

// Keep backwards-compatible alias for existing code
export type MediaAssetTypeCompat = "video" | "image" | "audio" | "document";

export interface MediaAssetFull extends MediaAssetListItem {
  libraryType: "personal" | "product" | "public";
  isPublic: boolean;
  securityLevel: SecurityLevel;
  reviewStatus: MediaReviewStatus;
  catalogStatus: CatalogStatus;
  transcodeStatus: TranscodeStatus;
  cdnStatus: CdnCmsStatus;
  cmsStatus: CdnCmsStatus;
  versionNumber: number;
  uploaderName?: string;
  description?: string;
  fileName?: string;
  width?: number;
  height?: number;
  tosObjectKey?: string;
  mimeType?: string;
}

export interface PaginatedAssets {
  items: MediaAssetFull[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UploadFileItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  contentType: string;
  status: "pending" | "uploading" | "uploaded" | "transcoding" | "completed" | "failed";
  progress: number;
  objectKey?: string;
  error?: string;
}

export interface MediaCategoryNode extends CategoryNode {
  workflowId?: string;
  videoTranscodeGroup?: string;
  audioTranscodeGroup?: string;
  mediaAssetCount: number;
}

export type CategoryPermissionType = "read" | "write" | "manage";
export type PermissionGranteeType = "user" | "role";

export interface CategoryPermissionItem {
  id: string;
  categoryId: string;
  granteeType: PermissionGranteeType;
  granteeId: string;
  granteeLabel: string;
  permissionType: CategoryPermissionType;
  inherited: boolean;
  createdAt: string;
}

export interface AssetDetailFull {
  id: string;
  title: string;
  type: MediaAssetType;
  description?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize: number;
  fileSizeDisplay?: string;
  mimeType?: string;
  duration?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  tosObjectKey?: string;
  tosBucket?: string;
  source?: string;
  tags: string[];
  libraryType: "personal" | "product" | "public";
  isPublic: boolean;
  securityLevel: SecurityLevel;
  reviewStatus: MediaReviewStatus;
  catalogStatus: CatalogStatus;
  transcodeStatus: TranscodeStatus;
  cdnStatus: CdnCmsStatus;
  cmsStatus: CdnCmsStatus;
  understandingStatus: AssetProcessingStatus;
  understandingProgress: number;
  totalTags: number;
  versionNumber: number;
  catalogData?: Record<string, unknown>;
  categoryId?: string;
  categoryPath?: string;
  uploaderName?: string;
  uploadedBy?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  segments?: VideoSegment[];
}

export interface MediaAssetStats {
  totalCount: number;
  videoCount: number;
  imageCount: number;
  audioCount: number;
  documentCount: number;
  manuscriptCount?: number;
  totalStorageDisplay: string;
}

// ---------------------------------------------------------------------------
// CMS: Article Management
// ---------------------------------------------------------------------------

export interface ArticleListItem {
  id: string;
  title: string;
  headline?: string;
  mediaType: string;
  status: "draft" | "reviewing" | "approved" | "published" | "archived";
  assigneeId?: string;
  assigneeName?: string;
  categoryId?: string;
  categoryName?: string;
  wordCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArticleDetail extends ArticleListItem {
  body?: string;
  summary?: string;
  videoUrl?: string;
  imageNotes?: string[];
  advisorNotes?: string[];
  sourceAssetId?: string;
  taskId?: string;
  publishedAt?: string;
}

export interface ArticleStats {
  totalCount: number;
  draftCount: number;
  reviewingCount: number;
  approvedCount: number;
  publishedCount: number;
  todayCount: number;
}

// ---------------------------------------------------------------------------
// CMS: Category Tree
// ---------------------------------------------------------------------------

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  sortOrder: number;
  articleCount: number;
  children?: CategoryNode[];
}

// ---------------------------------------------------------------------------
// Asset Intelligence additions
// ---------------------------------------------------------------------------

export interface ProcessingQueueItem {
  id: string;
  title: string;
  type: MediaAssetType;
  status: AssetProcessingStatus;
  progress: number;
  duration?: string;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface TagDistributionItem {
  name: string;
  value: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Channel Advisor additions
// ---------------------------------------------------------------------------

export interface ChannelAdvisorDetail extends ChannelAdvisor {
  systemPrompt?: string;
  aiEmployeeId?: string;
  knowledgeBaseIds: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Asset Revive additions
// ---------------------------------------------------------------------------

export interface ReviveRecord {
  id: string;
  asset: string;
  scenario: ReviveScenario;
  matchScore: number;
  status: string;
  date: string;
  reach: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface ScenarioDistribution {
  name: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Module 2: Smart Content Production
// ---------------------------------------------------------------------------

// 2.3 - Hot Topic Sensing / Inspiration
export interface InspirationTopic {
  id: string;
  title: string;
  sourceUrl?: string;
  priority: "P0" | "P1" | "P2";
  heatScore: number;
  aiScore: number;
  trend: "rising" | "surging" | "plateau" | "declining";
  source: string;
  category: string;
  discoveredAt: string;
  heatCurve: { time: string; value: number }[];
  suggestedAngles: string[];
  competitorResponse: string[];
  relatedAssets: string[];
  summary: string;
  platforms: string[];
  commentInsight: {
    positive: number;
    neutral: number;
    negative: number;
    hotComments: string[];
  };
  enrichedOutlines: Array<{
    angle: string;
    points: string[];
    wordCount: string;
    style: string;
  }>;
  relatedMaterials: Array<{
    type: "report" | "data" | "comment";
    title: string;
    source: string;
    url?: string;
    snippet: string;
  }>;
  isRead: boolean;
  missionId?: string;
}

export interface PlatformMonitor {
  name: string;
  icon: string;
  status: "online" | "offline";
  lastScan: string;
  topicsFound: number;
}

export interface EditorialMeeting {
  p0Count: number;
  p1Count: number;
  p2Count: number;
  totalTopics: number;
  activePlatforms: number;
  topCategories: { name: string; count: number }[];
  aiSummary: string;
  generatedAt: string;
  delta?: InspirationDelta;
}

export interface CalendarEvent {
  id: string;
  name: string;
  category: string;
  eventType: "festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial";
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  recurrence: "once" | "yearly" | "custom";
  source: "builtin" | "manual" | "ai_discovered";
  status: "confirmed" | "pending_review";
  aiAngles: string[];
  reminderDaysBefore: number;
}

export interface UserTopicSubscription {
  subscribedCategories: string[];
  subscribedEventTypes: string[];
}

export interface TopicReadState {
  lastViewedAt: string;
  readTopicIds: string[];
}

export interface InspirationDelta {
  timeSinceLastView: string;
  newTopicsCount: number;
  newP0Count: number;
  newP1Count: number;
  newP2Count: number;
  significantChanges: string[];
  subscribedChannelUpdates: string;
}

// 2.1 - Super Creation Center
export interface CreationGoal {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
}

export interface SuperCreationTask {
  id: string;
  title: string;
  mediaType: "article" | "video" | "audio" | "h5";
  status: "queued" | "drafting" | "reviewing" | "approved" | "published";
  assignee: EmployeeId;
  progress: number;
  aiResponsible: string;
  wordCount: number;
  content: {
    headline: string;
    body: string;
    imageNotes?: string[];
  };
  advisorNotes?: string[];
}

export interface ChatMessage {
  id: string;
  role: "editor" | "ai";
  employeeId?: EmployeeId;
  name: string;
  content: string;
  timestamp: string;
}

// 2.1 - Premium Content
export interface PipelineNode {
  id: string;
  label: string;
  employeeId: EmployeeId;
  status: "completed" | "active" | "pending";
  progress: number;
  subTasks: { name: string; done: boolean }[];
  output?: string;
}

export interface HitTemplate {
  id: string;
  name: string;
  structure: string[];
  usageCount: number;
  hitRate: number;
  bestPerformance: { views: number; likes: number; shares: number };
  category: string;
  description: string;
}

export interface EDLProject {
  id: string;
  title: string;
  duration: string;
  tracks: {
    name: string;
    color: string;
    clips: { start: number; end: number; label: string }[];
  }[];
  formats: string[];
}

export interface ActivityLog {
  time: string;
  employeeId: EmployeeId;
  action: string;
}

export interface BenchmarkAISummary {
  centralMediaReport: string;
  otherMediaReport: string;
  highlights: string;
  overallSummary: string;
  sourceArticles: {
    title: string;
    url: string;
    platform: string;
    mediaLevel: "central" | "provincial" | "municipal" | "industry" | "unknown";
    publishedAt?: string;
    excerpt?: string;
  }[];
  generatedAt: string;
}

export interface BenchmarkArticleUI {
  id: string;
  title: string;
  summary?: string;
  status: string;
  publishedAt?: string;
  publishChannels: string[];
  spreadData: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  };
  categoryName?: string;
}

// 2.2 - Benchmarking
export interface BenchmarkTopic {
  id: string;
  title: string;
  category: string;
  mediaScores: {
    media: string;
    isUs: boolean;
    scores: { dimension: string; score: number }[];
    total: number;
    publishTime: string;
  }[];
  radarData: { dimension: string; us: number; best: number }[];
  improvements: string[];
  aiSummary?: BenchmarkAISummary;
  sourceArticleId?: string;
}

export interface MissedTopic {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  discoveredAt: string;
  competitors: string[];
  heatScore: number;
  category: string;
  type: "breaking" | "trending" | "analysis";
  status: "missed" | "tracking" | "resolved";
  sourceType?: "social_hot" | "sentiment_event" | "benchmark_media";
  sourceUrl?: string;
  sourcePlatform?: string;
  matchedArticleId?: string;
  matchedArticleTitle?: string;
  aiSummary?: BenchmarkAISummary;
  pushedAt?: string;
  pushedToSystem?: string;
}

export interface WeeklyReport {
  period: string;
  overallScore: number;
  missedRate: number;
  responseSpeed: string;
  coverageRate: number;
  trends: { week: string; score: number; missedRate: number }[];
  gapList: { area: string; gap: string; suggestion: string }[];
}

// 2.2b - Topic Compare & Missing Topics (redesigned benchmarking)

/** 同题对比 - 作品列表项 */
export interface TopicCompareArticle {
  id: string;
  title: string;
  publishedAt: string;
  channels: string[];
  contentType: "text" | "video" | "live" | "short_video";
  readCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  benchmarkCount: number;
  hasAnalysis: boolean;
}

/** 同题对比 - 详情页全网报道概览 */
export interface TopicCompareDetail {
  article: TopicCompareArticle;
  stats: {
    totalReports: number;
    centralCount: number;
    provincialCount: number;
    otherCount: number;
    earliestTime: string;
    latestTime: string;
    trendDelta: number;
  };
  aiSummary: BenchmarkAISummary | null;
  lastAnalyzedAt: string | null;
}

/** 同题对比 - 全网报道文章 */
export interface NetworkReport {
  id: string;
  title: string;
  sourceOutlet: string;
  mediaLevel: "central" | "provincial" | "city" | "industry" | "self_media";
  publishedAt: string;
  author: string;
  summary: string;
  sourceUrl: string;
  contentType: string;
  aiInterpretation: ArticleAIInterpretation | null;
}

/** 单篇文章AI解读 */
export interface ArticleAIInterpretation {
  coreAngle: string;
  keyInformation: string[];
  uniqueContent: string;
  writingTechnique: string;
  sourceAnalysis: string;
  referenceValue: { level: "high" | "medium" | "low"; reason: string };
}

/** 竞品媒体对标 - 分组数据 */
export interface CompetitorGroup {
  level: "central" | "provincial" | "city" | "other";
  levelLabel: string;
  levelColor: string;
  outlets: CompetitorOutlet[];
}

export interface CompetitorOutlet {
  outletName: string;
  articles: {
    /** Optional: platform_content.id — required for AI interpretation lookup.
     *  Absent when the row comes from demo/mock data. */
    contentId?: string;
    title: string;
    subject: string;
    publishedAt: string;
    channel: string;
    sourceUrl: string;
  }[];
}

/** 漏题筛查 - AI 分析（4个通用板块 + 补充报道建议） */
export interface MissingTopicAIAnalysis extends BenchmarkAISummary {
  supplementAdvice: {
    /** 建议紧急度 */
    urgency: "immediate" | "today" | "scheduled" | "skip";
    /** 紧急度说明（如："最佳报道窗口 < 2 小时"） */
    urgencyReason: string;
    /** 建议报道角度（2-3 条） */
    angles: Array<{ title: string; description: string }>;
    /** 风险提示（政策敏感、事实待核实等） */
    risks: string;
  };
}

/** 漏题筛查 - KPI 看板数据 */
export interface MissingTopicKPIs {
  totalClues: number;
  suspectedMissed: number;
  confirmedMissed: number;
  handled: number;
  coverageRate: number;
}

/** 漏题筛查 - 线索列表项 */
export interface MissingTopicClue {
  id: string;
  title: string;
  sourceType: "social_hot" | "sentiment_event" | "benchmark_media";
  sourceDetail: string;
  heatScore: number;
  discoveredAt: string;
  status: "covered" | "suspected" | "confirmed" | "excluded" | "pushed";
  urgency: "urgent" | "normal" | "watch";
  isMultiSource: boolean;
  competitors: string[];
}

/** 漏题详情 - 完整数据 */
export interface MissingTopicDetail {
  id: string;
  title: string;
  sourceType: "social_hot" | "sentiment_event" | "benchmark_media";
  sourceDetail: string;
  sourceTags: string[];
  sourceUrl: string;
  heatScore: number;
  discoveredAt: string;
  publishedAt: string;
  status: "covered" | "suspected" | "confirmed" | "excluded" | "pushed";
  urgency: "urgent" | "normal" | "watch";
  isMultiSource: boolean;
  contentSummary: string;
  contentLength: number;
  reportedBy: {
    name: string;
    level: "central" | "provincial" | "city" | "industry" | "self_media";
  }[];
  aiAnalysis: MissingTopicAIAnalysis | null;
  linkedArticleId: string | null;
  linkedArticleTitle: string | null;
  pushedAt: string | null;
  pushedToSystem: string | null;
}

// 2.4 - Batch Production
export interface BatchTopic {
  id: string;
  title: string;
  progress: number;
  channels: {
    channel: string;
    status: "done" | "processing" | "pending";
    format: string;
  }[];
}

export interface BatchStats {
  todayOutput: number;
  inProgress: number;
  published: number;
  pendingReview: number;
}

export interface ConversionTaskItem {
  id: string;
  title: string;
  sourceRatio: string;
  targetRatio: string;
  status: "done" | "processing" | "pending";
  settings: {
    smartFocus: boolean;
    facePriority: boolean;
    subtitleReflow: boolean;
  };
}

export interface DigitalHumanConfig {
  id: string;
  name: string;
  avatar: string;
  style: "formal" | "friendly" | "energetic";
  voiceType: string;
}

// 2.5 - Event Auto
export interface SportEvent {
  id: string;
  name: string;
  teams: { name: string; score: number; logo: string }[];
  status: "live" | "upcoming" | "finished";
  time: string;
  period: string;
  highlights: {
    time: string;
    type: "goal" | "slam_dunk" | "save" | "foul" | "highlight";
    description: string;
    autoClipped: boolean;
  }[];
  autoOutputs: {
    id: string;
    title: string;
    type: "clip" | "summary" | "graphic";
    status: "done" | "processing" | "pending";
    progress: number;
    duration?: string;
  }[];
  stats: { produced: number; published: number; totalViews: number };
}

export interface ConferenceEvent {
  id: string;
  name: string;
  speaker: string;
  speakerTitle: string;
  status: "live" | "upcoming" | "finished";
  time: string;
  transcription: string[];
  goldenQuotes: string[];
  outputs: {
    id: string;
    title: string;
    type: "flash" | "summary" | "quote_card";
    status: "done" | "processing";
  }[];
  stats: {
    transcribedWords: number;
    quotesExtracted: number;
    outputsGenerated: number;
  };
}

export interface FestivalEvent {
  id: string;
  name: string;
  date: string;
  phases: {
    name: string;
    status: "completed" | "active" | "pending";
    progress: number;
    outputs: string[];
  }[];
}

export interface ExhibitionEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  booths: {
    company: string;
    visited: boolean;
    reports: number;
    keyProducts: string[];
  }[];
  autoProducts: {
    company: string;
    product: string;
    summary: string;
  }[];
}

// ---------------------------------------------------------------------------
// Benchmarking Deep-Dive Types
// ---------------------------------------------------------------------------

export type AlertPriority = "urgent" | "high" | "medium" | "low";
export type AlertType = "missed_topic" | "competitor_highlight" | "gap_warning" | "trend_alert";
export type AlertStatus = "new" | "acknowledged" | "actioned" | "dismissed";
export type PlatformCategory = "central" | "provincial" | "municipal" | "industry";
export type CrawlStatus = "active" | "paused" | "error";

export interface MonitoredPlatformUI {
  id: string;
  name: string;
  url: string;
  category: PlatformCategory;
  province?: string;
  crawlFrequencyMinutes: number;
  status: CrawlStatus;
  crawlConfig: {
    rssUrl?: string;
    searchQuery?: string;
    urlPatterns?: string[];
    categories?: string[];
  };
  lastCrawledAt?: string;
  lastErrorMessage?: string;
  totalContentCount: number;
}

export interface PlatformContentUI {
  id: string;
  platformId: string;
  platformName?: string;
  title: string;
  summary?: string;
  sourceUrl: string;
  author?: string;
  publishedAt?: string;
  topics: string[];
  category?: string;
  sentiment?: string;
  importance: number;
  coverageStatus?: string;
  gapAnalysis?: string;
  crawledAt: string;
  analyzedAt?: string;
  aiInterpretation?: string;
}

export interface BenchmarkAlertUI {
  id: string;
  title: string;
  description: string;
  priority: AlertPriority;
  type: AlertType;
  status: AlertStatus;
  platformContentIds: string[];
  relatedPlatforms: string[];
  relatedTopics: string[];
  analysisData: {
    heatScore?: number;
    coverageGap?: string;
    competitorCount?: number;
    suggestedAngle?: string;
    suggestedAction?: string;
    estimatedUrgencyHours?: number;
    sourceExcerpts?: string[];
  };
  actionNote?: string;
  workflowInstanceId?: string;
  createdAt: string;
}

export interface PlatformComparisonRow {
  platformName: string;
  category: PlatformCategory;
  totalContent: number;
  coveredCount: number;
  missedCount: number;
  coverageRate: number;
  avgImportance: number;
}

export interface CoverageOverview {
  totalExternal: number;
  covered: number;
  missed: number;
  coverageRate: number;
  byPlatformCategory: {
    category: PlatformCategory;
    total: number;
    covered: number;
    missed: number;
  }[];
}

// ---------------------------------------------------------------------------
// Legacy Team type (stub — teams migrated to mission system)
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
  scenario: string;
  members: string[];
  humanMembers: string[];
  createdAt: string;
}

export interface TeamWithMembers extends Team {
  rules: {
    approvalRequired: boolean;
    reportFrequency: string;
    sensitiveTopics: string[];
    approvalSteps?: string[];
  };
  memberDetails: {
    id: string;
    memberType: "ai" | "human";
    displayName: string;
    teamRole: string;
    employee?: AIEmployee;
  }[];
}
