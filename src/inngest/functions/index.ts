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
import {
  hotTopicCrawlScheduler,
  hotTopicCrawler,
} from "./hot-topic-crawl";
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
} from "./collection";

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
  // Hot Topics
  hotTopicCrawlScheduler,
  hotTopicCrawler,
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
];
