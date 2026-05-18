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
      reason: "topic-renamed" | "keyword-added" | "keyword-removed";
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

};
