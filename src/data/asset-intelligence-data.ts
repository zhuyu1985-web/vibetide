import type {
  IntelligentAsset,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  SemanticSearchResult,
  AssetTagCategory,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Tag category metadata
// ---------------------------------------------------------------------------

export const tagCategoryMeta: Record<
  AssetTagCategory,
  { label: string; color: string; bgColor: string }
> = {
  topic: { label: "主题", color: "text-blue-700", bgColor: "bg-blue-100" },
  event: { label: "事件", color: "text-amber-700", bgColor: "bg-amber-100" },
  emotion: { label: "情感", color: "text-pink-700", bgColor: "bg-pink-100" },
  person: { label: "人物", color: "text-indigo-700", bgColor: "bg-indigo-100" },
  location: { label: "地点", color: "text-green-700", bgColor: "bg-green-100" },
  shotType: { label: "镜头", color: "text-purple-700", bgColor: "bg-purple-100" },
  quality: { label: "画质", color: "text-teal-700", bgColor: "bg-teal-100" },
  object: { label: "物体", color: "text-orange-700", bgColor: "bg-orange-100" },
  action: { label: "动作", color: "text-red-700", bgColor: "bg-red-100" },
};

// ---------------------------------------------------------------------------
// Sample intelligent asset (detailed, for Tab 1)
// ---------------------------------------------------------------------------

export const sampleAsset: IntelligentAsset = {
  id: "asset-001",
  title: "两会特别报道：养老金并轨改革深度解读",
  type: "video",
  duration: "08:32",
  fileSize: "1.2GB",
  thumbnailPlaceholder: "两会养老金报道",
  status: "completed",
  progress: 100,
  totalTags: 47,
  createdAt: "2026-02-28T10:00:00Z",
  processedAt: "2026-02-28T10:00:03Z",
  segments: [
    {
      id: "seg-01",
      startTime: "00:00",
      endTime: "01:45",
      transcript:
        "各位观众大家好，欢迎收看两会特别报道。今天我们将深入解读养老金并轨改革的最新进展。从2024年10月起，机关事业单位与企业职工的养老保险制度正式并轨，这标志着我国养老保障体系迈入新阶段。",
      ocrTexts: ["两会特别报道", "养老金并轨改革", "2024年10月"],
      nluSummary: "节目开场，介绍养老金并轨改革背景，强调2024年10月正式并轨的里程碑意义",
      tags: [
        { id: "t1", category: "topic", label: "养老金改革", confidence: 0.97 },
        { id: "t2", category: "event", label: "两会报道", confidence: 0.95 },
        { id: "t3", category: "shotType", label: "中景", confidence: 0.88 },
        { id: "t4", category: "emotion", label: "严肃客观", confidence: 0.92 },
      ],
      detectedFaces: [
        { id: "f1", name: "主持人李明", role: "主持人", confidence: 0.96, appearances: 4 },
      ],
      sceneType: "演播室",
      visualQuality: 95,
    },
    {
      id: "seg-02",
      startTime: "01:45",
      endTime: "03:30",
      transcript:
        "记者采访了人社部相关负责人，详细介绍了并轨后养老金计发办法的变化。新的计发办法将基础养老金与个人账户养老金相结合，确保退休人员待遇平稳过渡。",
      ocrTexts: ["人社部", "计发办法", "基础养老金"],
      nluSummary: "记者采访人社部官员，解读并轨后养老金计算方法变化",
      tags: [
        { id: "t5", category: "person", label: "人社部官员", confidence: 0.91 },
        { id: "t6", category: "topic", label: "政策解读", confidence: 0.94 },
        { id: "t7", category: "shotType", label: "采访特写", confidence: 0.90 },
        { id: "t8", category: "action", label: "采访", confidence: 0.93 },
      ],
      detectedFaces: [
        { id: "f2", name: "记者王芳", role: "记者", confidence: 0.94, appearances: 3 },
        { id: "f3", name: "张副司长", role: "受访者", confidence: 0.89, appearances: 2 },
      ],
      sceneType: "外景采访",
      visualQuality: 88,
    },
    {
      id: "seg-03",
      startTime: "03:30",
      endTime: "05:15",
      transcript:
        "在北京市朝阳区的社保服务中心，我们看到不少市民前来咨询养老金并轨的具体影响。一位退休教师表示，并轨后她的养老金待遇不降反升，让她感到安心。",
      ocrTexts: ["社保服务中心", "朝阳区"],
      nluSummary: "实地走访社保服务中心，记录市民对养老金并轨的反馈，退休教师表示满意",
      tags: [
        { id: "t9", category: "location", label: "北京朝阳区", confidence: 0.96 },
        { id: "t10", category: "emotion", label: "积极正面", confidence: 0.87 },
        { id: "t11", category: "object", label: "社保服务窗口", confidence: 0.85 },
        { id: "t12", category: "person", label: "退休教师", confidence: 0.82 },
      ],
      detectedFaces: [
        { id: "f2", name: "记者王芳", role: "记者", confidence: 0.94, appearances: 3 },
        { id: "f4", name: "刘老师", role: "受访市民", confidence: 0.78, appearances: 1 },
      ],
      sceneType: "室内实景",
      visualQuality: 82,
    },
    {
      id: "seg-04",
      startTime: "05:15",
      endTime: "07:00",
      transcript:
        "专家分析指出，养老金并轨改革的核心在于制度公平。中国社科院研究员李博士认为，此次改革消除了双轨制的历史遗留问题，有利于构建更加公平可持续的养老保障体系。",
      ocrTexts: ["中国社科院", "制度公平", "可持续发展"],
      nluSummary: "社科院专家分析并轨改革意义，聚焦制度公平和可持续性",
      tags: [
        { id: "t13", category: "person", label: "社科院专家", confidence: 0.93 },
        { id: "t14", category: "topic", label: "制度公平", confidence: 0.91 },
        { id: "t15", category: "shotType", label: "访谈", confidence: 0.89 },
        { id: "t16", category: "quality", label: "高清", confidence: 0.95 },
      ],
      detectedFaces: [
        { id: "f5", name: "李博士", role: "专家", confidence: 0.92, appearances: 2 },
      ],
      sceneType: "演播室访谈",
      visualQuality: 93,
    },
    {
      id: "seg-05",
      startTime: "07:00",
      endTime: "08:32",
      transcript:
        "总结来看，养老金并轨改革是我国社会保障领域的重大突破。未来，相关部门将继续完善配套政策，确保改革红利惠及每一位退休人员。感谢收看，我们下期再见。",
      ocrTexts: ["社会保障", "改革红利"],
      nluSummary: "节目总结，展望未来政策完善方向，结束语",
      tags: [
        { id: "t17", category: "topic", label: "社会保障", confidence: 0.96 },
        { id: "t18", category: "emotion", label: "展望乐观", confidence: 0.84 },
        { id: "t19", category: "shotType", label: "中景", confidence: 0.88 },
      ],
      detectedFaces: [
        { id: "f1", name: "主持人李明", role: "主持人", confidence: 0.96, appearances: 4 },
      ],
      sceneType: "演播室",
      visualQuality: 95,
    },
  ],
};

// ---------------------------------------------------------------------------
// Asset list for tag overview (Tab 2)
// ---------------------------------------------------------------------------

export const assetTagList = [
  { id: "asset-001", title: "两会特别报道：养老金并轨改革", tagCount: 47, mainCategory: "topic", status: "completed" as const },
  { id: "asset-002", title: "台风杜苏芮福建沿海追踪报道", tagCount: 38, mainCategory: "event", status: "completed" as const },
  { id: "asset-003", title: "AI科技大会：大模型商用前瞻", tagCount: 52, mainCategory: "topic", status: "completed" as const },
  { id: "asset-004", title: "长江生态保护十年纪录片", tagCount: 64, mainCategory: "location", status: "completed" as const },
  { id: "asset-005", title: "社区养老服务体系建设纪实", tagCount: 31, mainCategory: "person", status: "processing" as const },
  { id: "asset-006", title: "春运首日：高铁新线路开通特别报道", tagCount: 42, mainCategory: "event", status: "completed" as const },
];

// Tag distribution data for donut chart
export const tagDistributionData = [
  { name: "主题", value: 68, color: "#3b82f6" },
  { name: "事件", value: 45, color: "#f59e0b" },
  { name: "人物", value: 52, color: "#6366f1" },
  { name: "地点", value: 38, color: "#10b981" },
  { name: "情感", value: 28, color: "#ec4899" },
  { name: "镜头", value: 34, color: "#8b5cf6" },
  { name: "画质", value: 15, color: "#14b8a6" },
  { name: "物体", value: 22, color: "#f97316" },
  { name: "动作", value: 18, color: "#ef4444" },
];

// Tag category summary
export const tagCategorySummary: {
  category: AssetTagCategory;
  count: number;
  examples: string[];
}[] = [
  { category: "topic", count: 68, examples: ["养老金改革", "社会保障", "政策解读", "AI技术"] },
  { category: "event", count: 45, examples: ["两会报道", "台风杜苏芮", "春运", "科技大会"] },
  { category: "emotion", count: 28, examples: ["严肃客观", "积极正面", "紧张", "展望乐观"] },
  { category: "person", count: 52, examples: ["主持人", "记者", "专家学者", "市民"] },
  { category: "location", count: 38, examples: ["北京", "福建沿海", "长江流域", "社保中心"] },
  { category: "shotType", count: 34, examples: ["中景", "特写", "航拍", "访谈"] },
  { category: "quality", count: 15, examples: ["高清", "4K", "标清", "良好"] },
  { category: "object", count: 22, examples: ["话筒", "文件", "服务窗口", "高铁"] },
  { category: "action", count: 18, examples: ["采访", "演讲", "走访", "讨论"] },
];

// ---------------------------------------------------------------------------
// Knowledge graph data (Tab 3)
// ---------------------------------------------------------------------------

export const graphNodes: KnowledgeGraphNode[] = [
  { id: "n1", label: "养老金改革", type: "topic", connections: 8 },
  { id: "n2", label: "两会", type: "event", connections: 6 },
  { id: "n3", label: "社会保障", type: "topic", connections: 5 },
  { id: "n4", label: "人社部", type: "organization", connections: 4 },
  { id: "n5", label: "张副司长", type: "person", connections: 3 },
  { id: "n6", label: "李博士", type: "person", connections: 3 },
  { id: "n7", label: "北京", type: "location", connections: 4 },
  { id: "n8", label: "台风杜苏芮", type: "event", connections: 5 },
  { id: "n9", label: "福建", type: "location", connections: 3 },
  { id: "n10", label: "AI科技大会", type: "event", connections: 4 },
  { id: "n11", label: "长江生态", type: "topic", connections: 4 },
  { id: "n12", label: "中国社科院", type: "organization", connections: 3 },
  { id: "n13", label: "主持人李明", type: "person", connections: 2 },
  { id: "n14", label: "记者王芳", type: "person", connections: 3 },
  { id: "n15", label: "制度公平", type: "topic", connections: 2 },
];

export const graphEdges: KnowledgeGraphEdge[] = [
  { source: "n1", target: "n2", relation: "报道于" },
  { source: "n1", target: "n3", relation: "属于" },
  { source: "n1", target: "n4", relation: "主管部门" },
  { source: "n1", target: "n15", relation: "核心议题" },
  { source: "n5", target: "n4", relation: "任职于" },
  { source: "n6", target: "n12", relation: "任职于" },
  { source: "n6", target: "n1", relation: "分析" },
  { source: "n2", target: "n7", relation: "举办地" },
  { source: "n8", target: "n9", relation: "影响地区" },
  { source: "n11", target: "n9", relation: "覆盖区域" },
  { source: "n13", target: "n1", relation: "报道" },
  { source: "n14", target: "n1", relation: "采访" },
  { source: "n14", target: "n5", relation: "采访" },
  { source: "n10", target: "n7", relation: "举办地" },
  { source: "n3", target: "n15", relation: "关联" },
];

// Graph node type colors
export const nodeTypeColor: Record<string, { bg: string; border: string; text: string }> = {
  topic: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  person: { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700" },
  event: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  location: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  organization: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
};

// ---------------------------------------------------------------------------
// Semantic search sample results (Tab 1 sidebar)
// ---------------------------------------------------------------------------

export const sampleSearchResults: SemanticSearchResult[] = [
  {
    assetId: "asset-001",
    assetTitle: "两会特别报道：养老金并轨改革",
    segmentId: "seg-02",
    timestamp: "01:45",
    matchedText: "记者采访了人社部相关负责人，详细介绍了并轨后养老金计发办法的变化",
    relevanceScore: 95,
    tags: ["养老金改革", "人社部", "政策解读"],
  },
  {
    assetId: "asset-004",
    assetTitle: "长江生态保护十年纪录片",
    segmentId: "seg-12",
    timestamp: "15:20",
    matchedText: "长江流域生态修复工程取得显著成效，珍稀物种数量回升",
    relevanceScore: 72,
    tags: ["长江生态", "环境保护", "纪录片"],
  },
  {
    assetId: "asset-003",
    assetTitle: "AI科技大会：大模型商用前瞻",
    segmentId: "seg-05",
    timestamp: "08:40",
    matchedText: "国内多家企业展示了大模型在媒体行业的落地应用案例",
    relevanceScore: 68,
    tags: ["AI技术", "大模型", "科技创新"],
  },
];

// ---------------------------------------------------------------------------
// Processing queue (Tab 4)
// ---------------------------------------------------------------------------

export const processingQueue: {
  id: string;
  title: string;
  type: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  duration: string;
}[] = [
  { id: "q1", title: "两会特别报道：养老金并轨改革深度解读", type: "video", status: "completed", progress: 100, duration: "3.2s" },
  { id: "q2", title: "台风杜苏芮福建沿海追踪报道", type: "video", status: "completed", progress: 100, duration: "4.1s" },
  { id: "q3", title: "AI科技大会：大模型商用前瞻", type: "video", status: "completed", progress: 100, duration: "2.8s" },
  { id: "q4", title: "长江生态保护十年纪录片", type: "video", status: "completed", progress: 100, duration: "8.5s" },
  { id: "q5", title: "社区养老服务体系建设纪实", type: "video", status: "processing", progress: 67, duration: "—" },
  { id: "q6", title: "春运首日：高铁新线路开通特别报道", type: "video", status: "processing", progress: 34, duration: "—" },
  { id: "q7", title: "元宵节各地民俗活动精选", type: "video", status: "queued", progress: 0, duration: "—" },
  { id: "q8", title: "新能源汽车产业链深度调查", type: "audio", status: "queued", progress: 0, duration: "—" },
  { id: "q9", title: "乡村振兴一线见闻图集", type: "image", status: "failed", progress: 0, duration: "—" },
];

// Queue stats
export const queueStats = {
  queued: 2,
  processing: 2,
  completed: 4,
  failed: 1,
};
