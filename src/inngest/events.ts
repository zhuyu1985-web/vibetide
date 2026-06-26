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
  "scheduled-jobs/account-analytics-crawl.run": ScheduledJobPayload;
  "scheduled-jobs/account-analytics-daily-snapshot.run": ScheduledJobPayload;
  "scheduled-jobs/account-analytics-annotate-posts.run": ScheduledJobPayload;
  "scheduled-jobs/account-analytics-weekly-report.run": ScheduledJobPayload;
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

  // ─── Workflow Template Scheduled Launch (2026-05-29) ───
  // 所有 kind='workflow_template' 的 scheduled_jobs 共用同一个 event,
  // payload 里带 workflowTemplateId / organizationId / inputParams 区分。
  // 订阅方:src/inngest/functions/workflow-template-scheduled-launch.ts
  "scheduled-jobs/workflow-template.run": WorkflowTemplateScheduledRunPayload;

  // ─── Phase: topic-compare real-data upgrade ───

  "collection/run.completed": {
    data: {
      runId: string;
      sourceId: string;
      organizationId: string | null;
      itemsCollected: number;
      status: "succeeded" | "partial" | "failed";
      durationMs: number;
    };
  };

  "topic-compare/my-post.created": {
    data: {
      organizationId: string;
      myPostId: string;
      contentFingerprint: string;
      source: "sync" | "backfill" | "manual";
    };
  };

  "topic-compare/backfill.requested": {
    data: {
      organizationId: string;
      accountKind: "my" | "benchmark";
      accountId: string;
      triggeredBy: "toggle" | "admin-script";
      triggeredByUserId: string | null;
    };
  };

  "topic-compare/missed-topic-detection.triggered": {
    data: {
      organizationId: string;
      sinceDays: number;
      triggeredBy: "daily-cron" | "manual";
    };
  };

  // ─── Mission Terminal Events (2026-06-21) ───
  /** mission 进入终态（completed/failed），所有终态写入点派发。渠道回执 handler 消费。 */
  "mission/reached-terminal": {
    data: { missionId: string; organizationId: string; status: "completed" | "failed" };
  };

  // ─── AIGC Illustrate (2026-06-22) ───
  /**
   * 配图请求 → kieGenerateImage → TOS 转存 → 写回 articles.coverImageUrl。
   * 由 IM gateway（钉钉/企微）或 PC cowork（confirmCreationPlan）派发，aigcIllustrate 消费。
   * channelCtx 可选：IM 侧传入用于回执；cowork（PC 对话）侧无渠道，省略后跳过 IM 回执，
   * 封面写回 article 后用户直接在编辑器里看到（2026-06-24 配图开关接 AIGC）。
   */
  "aigc/illustrate.requested": {
    data: {
      organizationId: string;
      articleId: string;
      userHint?: string;
      channelCtx?: {
        organizationId: string;
        configId: string;
        platform: "dingtalk" | "wechat_work";
        chatId: string;
        externalUserId: string;
      };
    };
  };

  // ─── AIGC Video (2026-06-22) ───
  /** IM 机器人配视频请求 → kieGenerateVideo → TOS 转存 → 写回 article_assets。由 gateway 派发，aigcVideo 消费 */
  "aigc/video.requested": {
    data: {
      organizationId: string;
      articleId: string;
      userHint?: string;
      channelCtx: {
        organizationId: string;
        configId: string;
        platform: "dingtalk" | "wechat_work";
        chatId: string;
        externalUserId: string;
      };
    };
  };

  // ─── AIGC Podcast (2026-06-22) ───
  /** IM 机器人播客请求 → LLM 双主持脚本 → kieGenerateDialogue → TOS 转存 → 写回 article_assets。由 gateway 派发，aigcPodcast 消费 */
  "aigc/podcast.requested": {
    data: {
      organizationId: string;
      articleId: string;
      userHint?: string;
      channelCtx: {
        organizationId: string;
        configId: string;
        platform: "dingtalk" | "wechat_work";
        chatId: string;
        externalUserId: string;
      };
    };
  };

  // ─── Channel Inbound Link Ingest (2026-06-19) ───
  /** 钉钉/企微入站消息含链接 → 抓取存稿。由 gateway 派发，channelLinkIngest 消费 */
  "channel/link-ingest.requested": {
    data: {
      organizationId: string;
      configId: string;
      platform: "dingtalk" | "wechat_work";
      url: string;
      sourceName: string;
      chatId: string;
      externalUserId: string;
      externalMessageId: string;
      /** 钉钉回调自带的 sessionWebhook，用于异步回执；空串表示无 */
      replyWebhook: string;
    };
  };

  // ─── Channel Inbound Voice Ingest (2026-06-23) ───
  /** 钉钉/企微入站语音消息 → 下载媒体 → ASR 转文本 → 当文字喂 gateway。webhook 派发，channelVoiceIngest 消费 */
  "channel/voice-ingest.requested": {
    data: {
      organizationId: string;
      configId: string;
      platform: "dingtalk" | "wechat_work";
      externalMessageId: string;
      externalUserId: string;
      chatId: string;
      /** 钉钉 sessionWebhook，用于回执；空串=无（企微走主动推送 sendChannelMessage） */
      replyWebhook: string;
      /** 媒体定位：钉钉优先 downloadCode，企微用 mediaId */
      media: {
        downloadCode?: string;
        mediaId?: string;
        format: string;
        durationMs?: number;
      };
      /** 平台自带转写（钉钉 audio.recognition），命中则免下载+ASR；空=无 */
      inlineTranscript: string;
    };
  };

  // ─── Content Loop Step (2026-06-24) ───
  /** 语音内容生产闭环的单步重活（抓热点/出选题/写初稿）。orchestrator 派发，contentLoopStep 消费 */
  "content-loop/step.requested": {
    data: {
      organizationId: string;
      sessionId: string;
      step:
        | "fetch_topics"
        | "gen_angles"
        | "gen_draft"
        | "revise"
        | "translate"
        | "submit_review"
        | "publish"
        | "analyze";
      channelCtx: {
        organizationId: string;
        configId: string;
        platform: "dingtalk" | "wechat_work";
        chatId: string;
        externalUserId: string;
      };
      /** revise / translate：用户的修改要求原文 */
      instruction?: string;
      /** translate：目标语种 code（en/ja…）+ 展示名 */
      targetLang?: string;
      targetLangLabel?: string;
      /** submit_review：选定的真人审核人 */
      assigneeUserId?: string;
      assigneeName?: string;
      /** publish：选定的渠道编号集合（空=全部） */
      selectedIdx?: number[];
      /**
       * 当前用户消息携带的钉钉 sessionWebhook，用于本步异步回执统一走 @ 的 app 机器人身份。
       * 空/缺省时回落到 config 自定义机器人。每条用户消息有全新的 sessionWebhook，
       * 故只用于"本步"那一次回执（见 content-loop-step.ts pushCard 的回落逻辑）。
       */
      replyWebhook?: string;
    };
  };

  // ─── 新闻 URL 导入闭环 (2026-06-26) ───
  /** cowork 对话粘贴 URL → 抓取入库 articles → 派下游分析/视频。coworkLinkImport 消费 */
  "cowork/link-import.requested": {
    data: {
      organizationId: string;
      conversationId: string;
      userId: string;
      url: string;
      sourceName: string;
    };
  };
  /** 稿件入库后自动结构化分析（摘要/标签/分类/要点）。articleAiAnalyze 消费 */
  "article/ai-analysis.requested": {
    data: {
      organizationId: string;
      articleId: string;
      conversationId?: string;
    };
  };
  /** 视频稿 → 解析视频源 → 下载素材库。articleVideoIngest 消费 */
  "article/video-ingest.requested": {
    data: {
      organizationId: string;
      articleId: string;
      conversationId?: string;
      url: string;
      videoSourceHint?: string;
    };
  };
  /** 素材入库后 → 通义听悟转写/理解。tingwuAnalyze 消费 */
  "media/tingwu-analyze.requested": {
    data: {
      organizationId: string;
      assetId: string;
      articleId?: string;
      conversationId?: string;
      publicUrl: string;
    };
  };
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

/**
 * workflow-template kind job 派发的 event payload。
 * 与 ScheduledJobPayload 同结构,额外多 3 个字段让订阅方直接拿到模板 + org + 参数。
 */
type WorkflowTemplateScheduledRunPayload = {
  data: {
    jobName: string;
    jobId: string;
    dispatchedAt: string;
    scheduledAt: string;
    /** 关联的 workflow_template id —— 订阅方 startMissionFromTemplateScheduled 必用 */
    workflowTemplateId: string;
    /** 关联的 org id —— 订阅方显式接 org,不依赖 session */
    organizationId: string;
    /** scheduled_jobs.payload —— 当作 mission inputParams 传给 startMissionFromTemplateScheduled */
    inputParams: Record<string, unknown>;
  };
};
