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

  // ─── Benchmarking Events ───

  "benchmarking/crawl-triggered": {
    data: {
      organizationId: string;
      platformId?: string;
      triggeredBy: "cron" | "manual";
    };
  };
  "benchmarking/content-detected": {
    data: {
      organizationId: string;
      platformContentIds: string[];
      platformId: string;
      contentCount: number;
    };
  };
  "benchmarking/alert-generated": {
    data: {
      organizationId: string;
      alertId: string;
      alertType: string;
      priority: string;
      title: string;
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
};
