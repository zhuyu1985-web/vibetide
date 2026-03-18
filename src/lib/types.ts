import type { EmployeeId } from "./constants";

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

export type WorkflowStepStatus =
  | "completed"
  | "active"
  | "pending"
  | "skipped"
  | "waiting_approval"
  | "failed";

export interface WorkflowInstance {
  id: string;
  topicId: string;
  topicTitle: string;
  steps: WorkflowStepState[];
  startedAt: string;
  estimatedCompletion: string;
}

export interface WorkflowStepState {
  key: string;
  label: string;
  employeeId: EmployeeId;
  status: WorkflowStepStatus;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  output?: string;
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

export interface Team {
  id: string;
  name: string;
  scenario: string;
  members: EmployeeId[];
  humanMembers: string[];
  rules: {
    approvalRequired: boolean;
    reportFrequency: string;
    sensitiveTopics: string[];
    approvalSteps?: string[];
  };
  createdAt: string;
}

export interface TeamWithMembers extends Team {
  memberDetails: {
    id: string;
    memberType: "ai" | "human";
    aiEmployeeId?: string;
    displayName: string;
    teamRole: string;
    employee?: AIEmployee;
  }[];
}

// ---------------------------------------------------------------------------
// 智能媒资 - 页面1: 媒资智能理解
// ---------------------------------------------------------------------------

export type AssetProcessingStatus = "queued" | "processing" | "completed" | "failed";

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
  type: "video" | "audio" | "image" | "document";
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

export interface MediaAssetListItem {
  id: string;
  title: string;
  type: "video" | "image" | "audio" | "document";
  duration?: string;
  fileSize: number;
  fileSizeDisplay?: string;
  thumbnailUrl?: string;
  understandingStatus: "queued" | "processing" | "completed" | "failed";
  tags: string[];
  usageCount: number;
  categoryName?: string;
  createdAt: string;
}

export interface MediaAssetStats {
  totalCount: number;
  videoCount: number;
  imageCount: number;
  audioCount: number;
  documentCount: number;
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
  type: "video" | "image" | "audio" | "document";
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
  outputMatrix: { type: string; count: number }[];
  generatedAt: string;
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
