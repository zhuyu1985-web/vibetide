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
  "research/task.submitted": {
    data: {
      taskId: string;
    };
  };
  "research/task.cancelled": {
    data: {
      taskId: string;
    };
  };
  "research/tavily.crawl": {
    data: {
      taskId: string;
      topicId: string;
      keywords: string[];
      timeRangeStart: string;
      timeRangeEnd: string;
      includeDomains: string[];
    };
  };
  "research/whitelist.crawl": {
    data: {
      taskId: string;
      outletId: string;
    };
  };
  "research/manual-url.ingest": {
    data: {
      taskId: string;
      urls: string[];
    };
  };
  "research/article.ingested": {
    data: {
      articleId: string;
      taskId: string;
      outletId: string | null;
    };
  };

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

};
