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
import { hotTopicEnrichmentPipeline } from "./hot-topic-enrichment";
import { employeeStatusGuard } from "./employee-status-guard";
import { knowledgeBaseVectorize } from "./knowledge-base-vectorize";
import {
  annotateCollectedItem,
  backfillAnnotate,
  researchReportGenerate,
} from "./research";
import {
  runCollectionSource,
  collectionHotTopicCron,
  collectionHotTopicBridge,
  outletBatchRecognize,
  tikhubBudgetReset,
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
  // Hot Topics (enrichment; crawler 在 Collection Hub 中)
  hotTopicEnrichmentPipeline,
  // Status guard
  employeeStatusGuard,
  // Knowledge base
  knowledgeBaseVectorize,
  // News Research (S2) — A3: 自采分支已迁至 Collection Hub Adapter 架构
  // researchTaskStart 已于 2026-05-13 删除(/research/admin/tasks 整体下线)
  // Research auto-annotation (A3 Phase 3) — 直接读 collected_items,不再走 research_news_articles 桥接
  annotateCollectedItem,
  backfillAnnotate,
  // A5 报告生成 (Phase 4)
  researchReportGenerate,
  // Collection Hub (2026-04-18)
  runCollectionSource,
  collectionHotTopicCron,
  collectionHotTopicBridge,
  // Outlet batch recognition (2026-05-05)
  outletBatchRecognize,
  // tikhub 月度预算重置 cron (2026-05-05)
  tikhubBudgetReset,
  // CMS P1 (2026-04-18)
  cmsCatalogSyncDaily,
  cmsCatalogSyncOnDemand,
  cmsStatusPoll,
  cmsPublishRetry,
  // Skill / Workflow MD ↔ DB consistency check (2026-04-20)
  skillConsistencyCheck,
  // Daily Hot Briefing (2026-04-20)
  dailyHotBriefingCron,
];
