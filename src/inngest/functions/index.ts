import { leaderPlan } from "./leader-plan";
import { executeMissionTask, executeMissionTaskFailureHandler } from "./execute-mission-task";
import { checkTaskDependencies } from "./check-task-dependencies";
import { handleTaskFailure } from "./handle-task-failure";
import { leaderConsolidate } from "./leader-consolidate";
import { weeklyAnalyticsReport } from "./analytics-report";
import { dailyPerformanceSnapshot } from "./daily-performance-snapshot";
import { learningEngine } from "./learning-engine";
import {
  onReviewCompleted,
  onPlanStatusChanged,
  onAnomalyDetected,
} from "./publishing-events";
import {
  benchmarkingCrawlScheduler,
  benchmarkingPlatformCrawler,
} from "./benchmarking-crawl";
import { benchmarkingAnalysisPipeline } from "./benchmarking-analysis";
import { hotTopicEnrichmentPipeline } from "./hot-topic-enrichment";
import { employeeStatusGuard } from "./employee-status-guard";
import { knowledgeBaseVectorize } from "./knowledge-base-vectorize";
import {
  researchTaskStart,
  researchTavilyCrawl,
  researchWhitelistCrawl,
  researchManualUrlIngest,
} from "./research";
import {
  runCollectionSource,
  collectionSmokeConsumer,
  collectionHotTopicCron,
  collectionHotTopicBridge,
  collectionResearchBridge,
} from "./collection";
import {
  cmsCatalogSyncDaily,
  cmsCatalogSyncOnDemand,
} from "./cms-catalog-sync";
import { cmsStatusPoll } from "./cms-status-poll";
import { cmsPublishRetry } from "./cms-publish-retry";
import { skillConsistencyCheck } from "./skill-consistency-check";
import { dailyHotBriefingCron } from "./daily-hot-briefing";

export const functions = [
  // Mission-based multi-agent collaboration
  leaderPlan,
  executeMissionTask,
  executeMissionTaskFailureHandler,
  checkTaskDependencies,
  handleTaskFailure,
  leaderConsolidate,
  // Analytics & performance
  weeklyAnalyticsReport,
  dailyPerformanceSnapshot,
  // Learning
  learningEngine,
  // Publishing events
  onReviewCompleted,
  onPlanStatusChanged,
  onAnomalyDetected,
  // Benchmarking
  benchmarkingCrawlScheduler,
  benchmarkingPlatformCrawler,
  benchmarkingAnalysisPipeline,
  // Hot Topics (enrichment; crawler migrated to Collection Hub — see below)
  hotTopicEnrichmentPipeline,
  // Status guard
  employeeStatusGuard,
  // Knowledge base
  knowledgeBaseVectorize,
  // News Research (S2)
  researchTaskStart,
  researchTavilyCrawl,
  researchWhitelistCrawl,
  researchManualUrlIngest,
  // Collection Hub (2026-04-18)
  runCollectionSource,
  collectionSmokeConsumer,
  collectionHotTopicCron,
  collectionHotTopicBridge,
  collectionResearchBridge,
  // CMS P1 (2026-04-18)
  cmsCatalogSyncDaily,
  cmsCatalogSyncOnDemand,
  cmsStatusPoll,
  cmsPublishRetry,
  // Skill / Workflow MD ↔ DB consistency check (2026-04-20)
  skillConsistencyCheck,
  // Daily Hot Briefing (2026-04-20) — 每日 8:00 自动生成简报 + 推 CMS
  dailyHotBriefingCron,
];
