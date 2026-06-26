import { leaderPlan } from "./leader-plan";
import { scheduledJobsRunner } from "./scheduler/scheduled-jobs-runner";
import { workflowTemplateScheduledLaunch } from "./workflow-template-scheduled-launch";
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
  accountAnalyticsWeeklyReport,
  accountAnalyticsMonthlyReport,
  // 2026-05-25 暂停：AIGC 账号发文标注（区块 C 类型占比+词云）
  // 数据量极小（my_posts 3 + benchmark_posts 17 = 20 条全部标注完成）。
  // 后续如需启用：取消下方两处注释 + 重启 Inngest dev server + 跑 npm run db:backfill-aigc
  // accountAnalyticsAnnotateAccountPosts,
} from "./account-analytics";
import { topicCompareSyncFromCollection } from "./topic-compare/sync-on-run-completed";
import { topicCompareBackfill } from "./topic-compare/backfill";
import { topicCompareFindMatchesOnNew } from "./topic-compare/find-matches-on-new-mypost";
import { missedTopicDetectionDaily } from "./topic-compare/missed-topic-cron";
import { channelLinkIngest, channelLinkIngestFailureHandler } from "./channel-link-ingest";
import { channelVoiceIngest, channelVoiceIngestFailureHandler } from "./channel-voice-ingest";
import { contentLoopStep, contentLoopStepFailureHandler } from "./content-loop-step";
import { channelMissionTerminalNotify } from "./channel-mission-terminal-notify";
import { aigcIllustrate } from "./aigc-illustrate";
import { aigcVideo } from "./aigc-video";
import { aigcPodcast } from "./aigc-podcast";
import {
  coworkLinkImport,
  coworkLinkImportFailureHandler,
} from "./cowork-link-import";
import {
  articleAiAnalyze,
  articleAiAnalyzeFailureHandler,
} from "./article-ai-analyze";
import {
  articleVideoIngest,
  articleVideoIngestFailureHandler,
} from "./article-video-ingest";
import {
  tingwuAnalyze,
  tingwuAnalyzeFailureHandler,
} from "./tingwu-analyze";

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
  accountAnalyticsWeeklyReport,
  accountAnalyticsMonthlyReport,
  // Account Analytics Phase 2: AIGC 账号发文标注 (2026-05-25 修正：从 collected_items 迁到 my_posts + benchmark_posts)
  // ⚠️ 2026-05-25 暂停注册：20 条数据已全量标注完成；后续启用取消注释即可
  // accountAnalyticsAnnotateAccountPosts,
  // Scheduler 调度中枢 (2026-05-26) — 替代各函数硬编码 cron,从 scheduled_jobs 表读配置派发事件
  scheduledJobsRunner,
  // Workflow Template scheduled launch (2026-05-29) — 订阅 scheduledJobsRunner 派的统一
  // event,把 schedule 触发翻译为 mission(走 startMissionFromTemplateScheduled service 入口)
  workflowTemplateScheduledLaunch,
  // Topic Compare real-data pipeline (2026-05-31) — 监听 collection/run.completed,
  // 按 source binding 把采集项同步到 my_posts / benchmark_posts
  topicCompareSyncFromCollection,
  // Topic Compare backfill (2026-05-31) — 手工触发一次性 backfill 历史 30 条帖子
  topicCompareBackfill,
  // Topic Compare find-matches (2026-05-31) — 监听 my-post.created,自动同题匹配 (concurrency=4)
  topicCompareFindMatchesOnNew,
  // Topic Compare missed-topic detection (2026-05-31) — 06:00 SH 每天跑漏题检测
  missedTopicDetectionDaily,
  // Channel inbound link ingest (2026-06-19)
  channelLinkIngest,
  channelLinkIngestFailureHandler,
  channelVoiceIngest,
  channelVoiceIngestFailureHandler,
  contentLoopStep,
  contentLoopStepFailureHandler,
  // Channel mission terminal notify (2026-06-21) — 终态→反查 session→回执
  channelMissionTerminalNotify,
  // AIGC Illustrate (2026-06-22) — IM 机器人配图：出图 → TOS 转存 → 写回 articles.coverImageUrl
  aigcIllustrate,
  // AIGC Video (2026-06-22) — IM 机器人配视频：文生视频 → TOS 转存 → 写回 article_assets
  aigcVideo,
  // AIGC Podcast (2026-06-22) — IM 机器人播客：LLM 双主持脚本 → elevenlabs 多人对话合成 → TOS 转存 → 写回 article_assets
  aigcPodcast,
  // 新闻 URL 导入闭环 (2026-06-26) — cowork 粘贴 URL → 抓取入库 articles → fan-out 分析/视频
  coworkLinkImport,
  coworkLinkImportFailureHandler,
  // 稿件结构化分析 (2026-06-26) — 入库后自动出 摘要/标签/分类/要点 写回字段
  articleAiAnalyze,
  articleAiAnalyzeFailureHandler,
  // 视频稿下载素材库 (2026-06-26) — 解析视频源 → 下载 TOS → article_assets → 派听悟
  articleVideoIngest,
  articleVideoIngestFailureHandler,
  // 通义听悟 (2026-06-26) — 提交视频 → 轮询 → 转写/关键词/章节写回 asset_segments/tags/articles
  tingwuAnalyze,
  tingwuAnalyzeFailureHandler,
];
