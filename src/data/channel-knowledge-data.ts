import type {
  KnowledgeSource,
  KnowledgeItem,
  KnowledgeSyncLog,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Knowledge sources
// ---------------------------------------------------------------------------

export const uploadSources: KnowledgeSource[] = [
  { id: "ks-01", name: "中超联赛2025-2026赛季规程.pdf", type: "upload", status: "active", documentCount: 1, chunkCount: 48, lastSyncAt: "2026-02-28T14:00:00Z", format: "PDF", sizeDisplay: "2.3MB" },
  { id: "ks-02", name: "两会政策文件汇编.docx", type: "upload", status: "active", documentCount: 1, chunkCount: 125, lastSyncAt: "2026-02-27T09:00:00Z", format: "DOCX", sizeDisplay: "5.1MB" },
  { id: "ks-03", name: "民生报道写作指南.pdf", type: "upload", status: "active", documentCount: 1, chunkCount: 36, lastSyncAt: "2026-02-26T11:00:00Z", format: "PDF", sizeDisplay: "1.8MB" },
  { id: "ks-04", name: "突发事件报道规范.pdf", type: "upload", status: "syncing", documentCount: 1, chunkCount: 22, lastSyncAt: "2026-03-01T08:30:00Z", format: "PDF", sizeDisplay: "980KB" },
];

export const cmsSources: KnowledgeSource[] = [
  { id: "ks-05", name: "频道历史爆款内容库", type: "cms", status: "active", documentCount: 326, chunkCount: 2840, lastSyncAt: "2026-03-01T06:00:00Z", format: "CMS", sizeDisplay: "—" },
  { id: "ks-06", name: "编辑部选题档案", type: "cms", status: "active", documentCount: 158, chunkCount: 1260, lastSyncAt: "2026-03-01T06:00:00Z", format: "CMS", sizeDisplay: "—" },
  { id: "ks-07", name: "受众反馈数据", type: "cms", status: "syncing", documentCount: 89, chunkCount: 450, lastSyncAt: "2026-03-01T07:45:00Z", format: "CMS", sizeDisplay: "—" },
];

export const subscriptionSources: KnowledgeSource[] = [
  { id: "ks-08", name: "新华社要闻订阅", type: "subscription", status: "active", documentCount: 1240, chunkCount: 8600, lastSyncAt: "2026-03-01T09:00:00Z", format: "RSS", sizeDisplay: "—" },
  { id: "ks-09", name: "央视热点追踪", type: "subscription", status: "active", documentCount: 860, chunkCount: 5200, lastSyncAt: "2026-03-01T08:55:00Z", format: "API", sizeDisplay: "—" },
  { id: "ks-10", name: "行业研报订阅", type: "subscription", status: "error", documentCount: 45, chunkCount: 320, lastSyncAt: "2026-02-28T22:00:00Z", format: "RSS", sizeDisplay: "—" },
];

// Source stats
export const sourceStats = {
  uploadCount: uploadSources.length,
  cmsCount: cmsSources.length,
  subscriptionCount: subscriptionSources.length,
};

// Source distribution for donut chart
export const sourceDistributionData = [
  { name: "上传文档", value: uploadSources.reduce((s, k) => s + k.chunkCount, 0), color: "#3b82f6" },
  { name: "内部内容", value: cmsSources.reduce((s, k) => s + k.chunkCount, 0), color: "#10b981" },
  { name: "外部订阅", value: subscriptionSources.reduce((s, k) => s + k.chunkCount, 0), color: "#f59e0b" },
];

// ---------------------------------------------------------------------------
// Knowledge items (Tab 2: browsing)
// ---------------------------------------------------------------------------

export const knowledgeItems: KnowledgeItem[] = [
  {
    id: "ki-01",
    title: "中超联赛升降级规则详解",
    source: "中超联赛2025-2026赛季规程.pdf",
    sourceType: "upload",
    snippet: "2025-2026赛季中超联赛采用双循环积分赛制，联赛末位两队直接降级，倒数第三名参加附加赛...",
    tags: ["中超", "赛制规则", "升降级"],
    relevanceScore: 92,
    createdAt: "2026-02-28T14:00:00Z",
    chunkIndex: 12,
  },
  {
    id: "ki-02",
    title: "养老金并轨改革十年过渡期安排",
    source: "两会政策文件汇编.docx",
    sourceType: "upload",
    snippet: "机关事业单位与企业职工养老保险制度并轨设置了十年过渡期（2014-2024），过渡期内实行新老办法对比...",
    tags: ["养老金", "并轨改革", "两会"],
    relevanceScore: 96,
    createdAt: "2026-02-27T09:00:00Z",
    chunkIndex: 35,
  },
  {
    id: "ki-03",
    title: "民生报道的共情写作技巧",
    source: "民生报道写作指南.pdf",
    sourceType: "upload",
    snippet: "在民生报道中，记者应当以平视视角与受访者交流，避免俯视式叙述。通过具体细节和个人故事引发受众共鸣...",
    tags: ["写作技巧", "民生报道", "共情"],
    relevanceScore: 85,
    createdAt: "2026-02-26T11:00:00Z",
    chunkIndex: 8,
  },
  {
    id: "ki-04",
    title: "历史爆款：春节消费趋势深度解读",
    source: "频道历史爆款内容库",
    sourceType: "cms",
    snippet: "2025年春节黄金周全国消费总额达1.2万亿元，文旅消费增长显著。冰雪经济成为新增长极...",
    tags: ["春节", "消费趋势", "爆款"],
    relevanceScore: 88,
    createdAt: "2026-02-15T10:00:00Z",
    chunkIndex: 1,
  },
  {
    id: "ki-05",
    title: "台风报道应急操作流程",
    source: "突发事件报道规范.pdf",
    sourceType: "upload",
    snippet: "台风预警发布后，编辑部应立即启动应急报道机制：1.确认信号源 2.调配前方记者 3.开启直播通道...",
    tags: ["台风", "应急报道", "操作规范"],
    relevanceScore: 90,
    createdAt: "2026-03-01T08:30:00Z",
    chunkIndex: 5,
  },
  {
    id: "ki-06",
    title: "新华社两会系列评论要点",
    source: "新华社要闻订阅",
    sourceType: "subscription",
    snippet: "新华社发表系列评论员文章，聚焦2026年政府工作报告中的经济增长目标、就业优先战略和绿色发展路径...",
    tags: ["两会", "新华社", "评论"],
    relevanceScore: 94,
    createdAt: "2026-03-01T07:00:00Z",
    chunkIndex: 1,
  },
  {
    id: "ki-07",
    title: "短视频流量密码：前3秒吸引力法则",
    source: "频道历史爆款内容库",
    sourceType: "cms",
    snippet: "数据分析显示，完播率最高的短视频均在前3秒内使用了悬念设置、反转预告或强视觉冲击的开场方式...",
    tags: ["短视频", "流量", "运营技巧"],
    relevanceScore: 82,
    createdAt: "2026-02-20T15:00:00Z",
    chunkIndex: 1,
  },
  {
    id: "ki-08",
    title: "央视财经：2026开年经济数据前瞻",
    source: "央视热点追踪",
    sourceType: "subscription",
    snippet: "2026年1-2月主要经济指标预计保持稳中向好态势，制造业PMI连续回升，服务业景气度持续扩张...",
    tags: ["经济数据", "央视财经", "宏观经济"],
    relevanceScore: 78,
    createdAt: "2026-02-28T18:00:00Z",
    chunkIndex: 1,
  },
];

// ---------------------------------------------------------------------------
// Channel DNA radar data (Tab 3)
// ---------------------------------------------------------------------------

export const channelDNAData = [
  { dimension: "时政深度", current: 8.5, target: 9.0 },
  { dimension: "民生温度", current: 7.8, target: 8.5 },
  { dimension: "数据驱动", current: 6.5, target: 8.0 },
  { dimension: "视觉表达", current: 7.2, target: 8.5 },
  { dimension: "互动参与", current: 5.8, target: 7.5 },
  { dimension: "国际视野", current: 6.0, target: 7.0 },
  { dimension: "创新叙事", current: 6.8, target: 8.0 },
  { dimension: "热点响应", current: 8.2, target: 9.0 },
];

export const channelDNAReport = `基于对频道326条历史爆款内容和158份选题档案的深度分析，我们发现您的频道具有明显的**时政深度报道**和**热点快速响应**优势，这两个维度得分均在8分以上。

然而，在**互动参与**和**数据驱动**两个维度上仍有提升空间。建议增加数据可视化内容比例，并在稿件中嵌入更多互动元素（投票、问答）以提升用户粘性。

**国际视野**维度得分偏低，建议通过订阅更多国际新闻源和引入多语适配能力来补强。`;

// ---------------------------------------------------------------------------
// Sync logs (Tab 4)
// ---------------------------------------------------------------------------

export const syncLogs: KnowledgeSyncLog[] = [
  { id: "sl-01", action: "同步新华社要闻订阅", timestamp: "2026-03-01 09:00:12", status: "success", detail: "新增23条，更新5条" },
  { id: "sl-02", action: "同步央视热点追踪", timestamp: "2026-03-01 08:55:03", status: "success", detail: "新增12条" },
  { id: "sl-03", action: "解析突发事件报道规范.pdf", timestamp: "2026-03-01 08:30:45", status: "success", detail: "生成22个知识分片" },
  { id: "sl-04", action: "同步受众反馈数据", timestamp: "2026-03-01 07:45:20", status: "warning", detail: "部分数据格式异常，已跳过3条" },
  { id: "sl-05", action: "同步频道历史爆款内容库", timestamp: "2026-03-01 06:00:00", status: "success", detail: "全量同步完成，326条" },
  { id: "sl-06", action: "同步编辑部选题档案", timestamp: "2026-03-01 06:00:00", status: "success", detail: "全量同步完成，158条" },
  { id: "sl-07", action: "同步行业研报订阅", timestamp: "2026-02-28 22:00:15", status: "error", detail: "RSS源连接超时，将自动重试" },
  { id: "sl-08", action: "解析两会政策文件汇编.docx", timestamp: "2026-02-27 09:02:33", status: "success", detail: "生成125个知识分片" },
  { id: "sl-09", action: "解析民生报道写作指南.pdf", timestamp: "2026-02-26 11:05:10", status: "success", detail: "生成36个知识分片" },
  { id: "sl-10", action: "解析中超联赛规程.pdf", timestamp: "2026-02-28 14:01:22", status: "success", detail: "生成48个知识分片" },
];

// Timeline for recent syncs
export const recentSyncTimeline = [
  { time: "09:00", title: "新华社要闻同步", description: "新增23条知识条目", status: "completed" as const },
  { time: "08:55", title: "央视热点同步", description: "新增12条知识条目", status: "completed" as const },
  { time: "08:30", title: "突发规范解析", description: "生成22个分片", status: "completed" as const },
  { time: "07:45", title: "受众反馈同步", description: "部分数据异常", status: "active" as const },
  { time: "06:00", title: "全量内容同步", description: "484条记录", status: "completed" as const },
];
