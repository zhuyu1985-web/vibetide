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
  reannotateTopic,
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
import { ayrshareWebhookHandler } from "./ayrshare-webhook-handler";
import { externalPublishRetry } from "./external-publish-retry";
import {
  accountAnalyticsDailySnapshot,
  accountAnalyticsReportGenerator,
  accountAnalyticsReportReanalyze,
  accountAnalyticsCrawlOnDemand,
  accountAnalyticsCrawlCron,
  // 2026-05-25 暂停：AIGC 账号发文标注（区块 C 类型占比+词云）
  // 数据量极小（my_posts 3 + benchmark_posts 17 = 20 条全部标注完成）。
  // 后续如需启用：取消下方两处注释 + 重启 Inngest dev server + 跑 npm run db:backfill-aigc
  // accountAnalyticsAnnotateAccountPosts,
} from "./account-analytics";

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
  reannotateTopic,
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
  // 海外英文发布 — Ayrshare 集成 (2026-05-22)
  ayrshareWebhookHandler,
  externalPublishRetry,
  // Account Analytics (账号数据分析, 2026-05-23)
  accountAnalyticsDailySnapshot,
  accountAnalyticsReportGenerator,
  accountAnalyticsReportReanalyze,
  accountAnalyticsCrawlOnDemand,
  accountAnalyticsCrawlCron,
  // Account Analytics Phase 2: AIGC 账号发文标注 (2026-05-25 修正：从 collected_items 迁到 my_posts + benchmark_posts)
  // ⚠️ 2026-05-25 暂停注册：20 条数据已全量标注完成；后续启用取消注释即可
  // accountAnalyticsAnnotateAccountPosts,
];
