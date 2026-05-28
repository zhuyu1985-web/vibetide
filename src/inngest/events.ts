export type InngestEvents = {
  // ─── Mission System Events ───

  "mission/created": {
    data: {
      missionId: string;
      organizationId: string;
    };
  };
  "mission/task-ready": {
    data: {
      missionId: string;
      taskId: string;
      organizationId: string;
    };
  };
  "mission/task-completed": {
    data: {
      missionId: string;
      taskId: string;
      employeeId: string;
      organizationId: string;
    };
  };
  "mission/task-failed": {
    data: {
      missionId: string;
      taskId: string;
      employeeId: string;
      error: string;
      organizationId: string;
    };
  };
  "mission/all-tasks-done": {
    data: {
      missionId: string;
      organizationId: string;
    };
  };
  "mission/cancelled": {
    data: {
      missionId: string;
      cancelledBy: string;
    };
  };

  // ─── Module 3: Omnichannel Distribution Events ───

  // F3.1.08-12: Review completed
  "publishing/review-completed": {
    data: {
      organizationId: string;
      reviewId: string;
      contentId: string;
      status: "approved" | "rejected" | "escalated";
      score: number | null;
      reviewerEmployeeId: string;
    };
  };

  // F3.1.04: Publishing completed/failed
  "publishing/plan-status-changed": {
    data: {
      organizationId: string;
      planId: string;
      title: string;
      channelName: string;
      status: "published" | "failed";
    };
  };

  // F3.1.16: Scheduled analytics report (cron trigger)
  "analytics/generate-report": {
    data: {
      organizationId?: string;
      period: "daily" | "weekly" | "monthly";
    };
  };

  // ─── M4: Employee Learning ───

  "employee/learn": {
    data: {
      employeeId: string;
      organizationId: string;
      trigger: "workflow_completion" | "manual" | "cron";
    };
  };

  // ─── F3.1.17: Anomaly Detection ───

  "analytics/anomaly-detected": {
    data: {
      organizationId: string;
      channel: string;
      metric: string;
      severity: "critical" | "warning";
      message: string;
      changePercent: number;
    };
  };

  // ─── Hot Topics Crawl Pipeline ───

  "hot-topics/crawl-triggered": {
    data: {
      organizationId: string;
      triggeredBy: "cron" | "manual";
    };
  };
  "hot-topics/enrich-requested": {
    data: {
      organizationId: string;
      topicIds: string[];
      calendarEventId?: string;
    };
  };

  // ─── Knowledge Base Vectorization Pipeline ───

  "kb/document-created": {
    data: {
      knowledgeBaseId: string;
      organizationId: string;
    };
  };
  "kb/document-updated": {
    data: {
      knowledgeBaseId: string;
      itemId: string;
      organizationId: string;
    };
  };
  "kb/reindex-requested": {
    data: {
      knowledgeBaseId: string;
      organizationId: string;
    };
  };

  // ─── Research Module Events ───

  "research/topic.sample.changed": {
    data: {
      sampleId: string;
      topicId: string;
      operation: "created" | "updated" | "deleted";
    };
  };
  // research/task.submitted / research/task.cancelled — deleted 2026-05-13
  // (/research/admin/tasks 整体下线,采集任务统一到 Collection Hub)
  // research/tavily.crawl — deleted A3 Phase 5 (走 Collection Hub tavily Adapter)
  // research/whitelist.crawl — deleted A3 Phase 5 (走 list_scraper Adapter)
  // research/manual-url.ingest — deleted A3 Phase 5 (走 jina_url Adapter)
  // research/article.ingested — deleted A3 Phase 5 (无消费方)

  // ─── Collection Hub Events (2026-04-18) ───

  "collection/source.run-requested": {
    data: {
      sourceId: string;
      organizationId: string;
      trigger: "cron" | "manual" | "event";
      /** optional override of source.config (used when triggering via UI "试运行") */
      configOverride?: Record<string, unknown>;
    };
  };
  "collection/item.created": {
    data: {
      itemId: string;
      sourceId: string;
      organizationId: string;
      targetModules: string[];
      firstSeenChannel: string;
    };
  };

  // ─── CMS Adapter Events (2026-04-18, Phase 1) ───

  "cms/catalog-sync.trigger": {
    data: {
      organizationId: string;
      triggerSource?: "manual" | "scheduled" | "auto_repair" | "first_time_setup";
      operatorId?: string;
      deleteMissing?: boolean;
    };
  };

  /** 发布入库成功后触发状态轮询（Task 35 的 `cms-status-poll` 消费） */
  "cms/publication.submitted": {
    data: {
      publicationId: string;
      cmsArticleId: string;
    };
  };

  /** 可重试失败后触发发布重试（Task 36 的 `cms-publish-retry` 消费） */
  "cms/publication.retry": {
    data: {
      publicationId: string;
    };
  };

  // ─── Research Bridge Events (2026-04-21) ───

  /** 研究文章正文异步拉取事件（Jina Reader 消费） */
  "research/article.content-fetch": {
    data: {
      articleId: string;
    };
  };

  /** 一次性回溯触发：把存量 collected_items 桥接到 research_news_articles */
  "research/bridge.backfill.trigger": {
    data: {
      organizationId?: string;
      limit?: number;
    };
  };

  // ─── Media Outlet Dictionary Events (2026-05-05) ───

  /** 批量回填历史采集项的媒体识别 */
  "collection/outlet-batch-recognize.requested": {
    data: {
      organizationId: string;
    };
  };

  // ─── Research Annotation Events (A3 Phase 3, 2026-05-06) ───

  /** 一次性手工触发：对存量 collected_items 批量回填 topic/district annotation */
  "research/backfill-annotate.requested": {
    data: {
      organizationId: string;
    };
  };

  /**
   * 单个 topic 词库变更触发回算 — 2026-05-14:
   * 词库新增/删除关键词 或 topic 改名时派发。处理函数会先 DELETE 该 topic 的
   * 所有旧命中(scope 该 org),再用最新的 keywords 跑全量 items 重新匹配。
   * (deleteTopic 不需要派发 — FK ON DELETE CASCADE 自动清掉命中)
   */
  "research/topic.changed": {
    data: {
      topicId: string;
      organizationId: string;
      reason: "topic-renamed" | "keyword-added" | "keyword-updated" | "keyword-removed";
    };
  };

  // ─── Research Report Events (A5 Phase 4, 2026-05-07) ───

  /** 报告生成入口：A5 7-step Inngest pipeline */
  "research/report.generate": {
    data: {
      reportId: string;
      organizationId: string;
    };
  };

  // ─── Ecological Index Report Events (P3.7, 2026-05-28) ───

  /**
   * 生态文明传播指数报告生成入口 — 由 createEcologicalIndexReportAction 派发,
   * 由 P3.8 的 7 步 Inngest 流水线消费(matcher → compute → charts → docx → xlsx → content-export → finalize)。
   */
  "research/ecological-index.generate": {
    data: {
      reportId: string;
      organizationId: string;
    };
  };

  /** 流水线成功完成 — 供 UI/告警订阅(P3.8 末步派发) */
  "research/ecological-index.completed": {
    data: {
      reportId: string;
      organizationId: string;
    };
  };

  /** 流水线失败 — 任意一步 throw 时派发,记录 errorMessage */
  "research/ecological-index.failed": {
    data: {
      reportId: string;
      organizationId: string;
      error: string;
    };
  };

  // ─── External Publish Events (海外英文发布, 2026-05-22) ───

  /**
   * Ayrshare webhook 收到平台终态回执后派发。
   * 由 `ayrshareWebhookHandler` 消费，更新 `articles.externalPublishStatus` 汇总。
   */
  "external/publication.completed": {
    data: {
      articleId: string;
      ayrsharePostId: string;
      /** webhook 整体状态（按平台已经写回 external_publications 表），这里只是触发汇总刷新 */
      status: "success" | "failed" | "partial";
    };
  };

  /** Ayrshare 发布可重试失败后派发；由 `externalPublishRetry` 消费，3 次指数退避 */
  "external/publication.retry": {
    data: {
      publicationId: string;
    };
  };

  // ─── Account Analytics Events (账号数据分析, 2026-05-23) ───

  /**
   * 日报生成请求 — 由 cron 派发或 Server Action 手动派发。
   * 由 accountAnalyticsReportGenerator 消费：拉 Top N collected_items →
   * LLM 跑 viral attribution → distill patterns + recommendations →
   * 写 account_analytics_reports + viral_content_attributions。
   */
  "account-analytics/daily-report.requested": {
    data: {
      organizationId: string;
      accountId: string;
      accountSource: "my" | "benchmark";
      /** 'YYYY-MM-DD' Asia/Shanghai 业务日 */
      periodStart: string;
      periodEnd: string;
      reportType: "daily" | "weekly" | "monthly" | "custom";
      /** 强制重算（忽略已存在的同 key 报告） */
      forceRefresh?: boolean;
    };
  };

  /**
   * 仅重跑指定报告的 LLM 归因，不重新抓取 collected_items。
   */
  "account-analytics/report.reanalyze": {
    data: {
      organizationId: string;
      reportId: string;
    };
  };

  /**
   * 账号即时抓取请求 — 给一个账号触发 Collection Hub TikHub Account 模式。
   * Phase 2 直接派发 collection/source.run-requested 给 collection adapter；
   * 此事件作为"上游意图"层，方便审计 + 后续按账号分级控频。
   */
  "account-analytics/crawl.requested": {
    data: {
      organizationId: string;
      accountId: string;
      accountSource: "my" | "benchmark";
      /** 默认抓最近 1 天，可覆盖（例如周报抓 7 天） */
      sinceDays?: number;
    };
  };

  /**
   * Phase 2 - 批量 AIGC 标注（LLM 给 collected_items 打 aigc_content_category + aigc_keywords）
   * - cron 触发时 data 可全空，函数会 fan-out 到每个 org 派发独立事件
   * - 直接派发时建议指定 orgId 限定范围
   * - chainDepth 由函数自递归时递增，单次 cron 最多链 20 次防失控
   */
  "account-analytics/aigc-annotate.requested": {
    data: {
      orgId?: string;
      accountId?: string;
      batchSize?: number;
      chainDepth?: number;
    };
  };

  // ─── Scheduled Jobs Events (2026-05-26) ───
  // scheduledJobsRunner 每分钟扫 scheduled_jobs 表派发的事件。
  // 业务函数订阅这些事件而不是 cron,cron 表达式由 DB / UI 管理。
  // 13 条 event 对应 13 个原 cron 函数 + 1 个新增 monthly-report。
  "scheduled-jobs/account-analytics-crawl.run": ScheduledJobPayload;
  "scheduled-jobs/account-analytics-daily-snapshot.run": ScheduledJobPayload;
  "scheduled-jobs/account-analytics-annotate-posts.run": ScheduledJobPayload;
  "scheduled-jobs/account-analytics-monthly-report.run": ScheduledJobPayload;
  "scheduled-jobs/cms-catalog-sync-daily.run": ScheduledJobPayload;
  "scheduled-jobs/collection-hot-topic-cron.run": ScheduledJobPayload;
  "scheduled-jobs/collection-tikhub-budget-reset.run": ScheduledJobPayload;
  "scheduled-jobs/weekly-analytics-report.run": ScheduledJobPayload;
  "scheduled-jobs/skill-consistency-check.run": ScheduledJobPayload;
  "scheduled-jobs/daily-hot-briefing.run": ScheduledJobPayload;
  "scheduled-jobs/learning-engine.run": ScheduledJobPayload;
  "scheduled-jobs/daily-performance-snapshot.run": ScheduledJobPayload;
  "scheduled-jobs/employee-status-guard.run": ScheduledJobPayload;
};

/** scheduled-jobs runner 派发事件时附加的元数据,业务函数可用可不用 */
type ScheduledJobPayload = {
  data: {
    /** scheduled_jobs.name */
    jobName: string;
    /** scheduled_jobs.id */
    jobId: string;
    /** 实际派发时间(ISO) */
    dispatchedAt: string;
    /** 计划执行时间(可能略早于 dispatchedAt,因为 scheduler 每分钟跑一次) */
    scheduledAt: string;
  };
};
