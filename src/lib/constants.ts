import {
  Telescope,
  Lightbulb,
  Package,
  PenTool,
  Film,
  Search,
  Radio,
  BarChart3,
  Brain,
  Crown,
  Zap,
  Clock,
  Mic,
  FileSearch,
  Layers,
  Share2,
  Globe,
  Wand2,
  Newspaper,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export type EmployeeId =
  | "xiaolei"
  | "xiaoce"
  | "xiaozi"
  | "xiaowen"
  | "xiaojian"
  | "xiaoshen"
  | "xiaofa"
  | "xiaoshu"
  | "advisor"
  | "leader";

export interface EmployeeMeta {
  id: EmployeeId;
  name: string;
  nickname: string;
  title: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const EMPLOYEE_META: Record<EmployeeId, EmployeeMeta> = {
  xiaolei: {
    id: "xiaolei",
    name: "热点猎手",
    nickname: "小雷",
    title: "热点猎手",
    icon: Telescope,
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
  },
  xiaoce: {
    id: "xiaoce",
    name: "选题策划师",
    nickname: "小策",
    title: "选题策划师",
    icon: Lightbulb,
    color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.12)",
  },
  xiaozi: {
    id: "xiaozi",
    name: "素材管家",
    nickname: "小资",
    title: "素材管家",
    icon: Package,
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.12)",
  },
  xiaowen: {
    id: "xiaowen",
    name: "内容创作师",
    nickname: "小文",
    title: "内容创作师",
    icon: PenTool,
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.12)",
  },
  xiaojian: {
    id: "xiaojian",
    name: "视频制片人",
    nickname: "小剪",
    title: "视频制片人",
    icon: Film,
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  xiaoshen: {
    id: "xiaoshen",
    name: "质量审核官",
    nickname: "小审",
    title: "质量审核官",
    icon: Search,
    color: "#6366f1",
    bgColor: "rgba(99,102,241,0.12)",
  },
  xiaofa: {
    id: "xiaofa",
    name: "渠道运营师",
    nickname: "小发",
    title: "渠道运营师",
    icon: Radio,
    color: "#14b8a6",
    bgColor: "rgba(20,184,166,0.12)",
  },
  xiaoshu: {
    id: "xiaoshu",
    name: "数据分析师",
    nickname: "小数",
    title: "数据分析师",
    icon: BarChart3,
    color: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  advisor: {
    id: "advisor",
    name: "频道顾问",
    nickname: "顾问",
    title: "频道顾问",
    icon: Brain,
    color: "#ec4899",
    bgColor: "rgba(236,72,153,0.12)",
  },
  leader: {
    id: "leader",
    name: "任务总监",
    nickname: "小领",
    title: "智能项目管理与任务调度",
    icon: Crown,
    color: "#e11d48",
    bgColor: "rgba(225,29,72,0.12)",
  },
};

export const WORKFLOW_STEPS = [
  { key: "monitor", label: "热点监控", employeeId: "xiaolei" as EmployeeId },
  { key: "plan", label: "选题策划", employeeId: "xiaoce" as EmployeeId },
  { key: "material", label: "素材准备", employeeId: "xiaozi" as EmployeeId },
  { key: "create", label: "内容创作", employeeId: "xiaowen" as EmployeeId },
  { key: "produce", label: "视频制作", employeeId: "xiaojian" as EmployeeId },
  { key: "review", label: "质量审核", employeeId: "xiaoshen" as EmployeeId },
  { key: "publish", label: "渠道发布", employeeId: "xiaofa" as EmployeeId },
  { key: "analyze", label: "数据分析", employeeId: "xiaoshu" as EmployeeId },
] as const;

/**
 * F4.1.23: Work preference templates — one-click apply common configurations.
 */
export const WORK_PREFERENCE_TEMPLATES = {
  autonomous: {
    label: "高度自主",
    description: "AI员工自主决策，仅重大事项汇报",
    preferences: {
      proactivity: "aggressive",
      reportingFrequency: "daily",
      autonomyLevel: 90,
      communicationStyle: "concise",
      workingHours: "24/7",
    },
  },
  strict: {
    label: "严格审批",
    description: "每步操作都需要确认，频繁汇报",
    preferences: {
      proactivity: "conservative",
      reportingFrequency: "realtime",
      autonomyLevel: 20,
      communicationStyle: "detailed",
      workingHours: "business",
    },
  },
  balanced: {
    label: "均衡模式",
    description: "适度自主，定期汇报，标准工作流",
    preferences: {
      proactivity: "balanced",
      reportingFrequency: "hourly",
      autonomyLevel: 60,
      communicationStyle: "standard",
      workingHours: "business",
    },
  },
  creative: {
    label: "创意优先",
    description: "鼓励探索和创新，宽松约束",
    preferences: {
      proactivity: "aggressive",
      reportingFrequency: "hourly",
      autonomyLevel: 75,
      communicationStyle: "creative",
      workingHours: "flexible",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Benchmarking: Preset Monitored Platforms
// ---------------------------------------------------------------------------

export const BENCHMARK_PRESET_PLATFORMS = [
  // 央级
  { name: "人民网", url: "people.com.cn", category: "central" as const, searchQuery: "site:people.com.cn" },
  { name: "新华网", url: "xinhuanet.com", category: "central" as const, searchQuery: "site:xinhuanet.com" },
  { name: "央视新闻", url: "news.cctv.com", category: "central" as const, searchQuery: "site:cctv.com 新闻" },
  { name: "光明网", url: "gmw.cn", category: "central" as const, searchQuery: "site:gmw.cn" },
  { name: "中国新闻网", url: "chinanews.com.cn", category: "central" as const, searchQuery: "site:chinanews.com.cn" },
  // 省级
  { name: "澎湃新闻", url: "thepaper.cn", category: "provincial" as const, province: "上海", searchQuery: "site:thepaper.cn" },
  { name: "红星新闻", url: "cdsb.com", category: "provincial" as const, province: "四川", searchQuery: "site:cdsb.com" },
] as const;

// ---------------------------------------------------------------------------
// Built-in Skill Definitions (28 skills, 6 categories)
// Slug directly maps to tool-registry tool names.
// ---------------------------------------------------------------------------

export interface BuiltinSkillDef {
  slug: string;
  name: string;
  category: "perception" | "analysis" | "generation" | "production" | "management" | "knowledge";
  description: string;
  content: string;
  version: string;
  inputSchema?: Record<string, string>;
  outputSchema?: Record<string, string>;
  runtimeConfig?: {
    type: string;
    avgLatencyMs: number;
    maxConcurrency: number;
    modelDependency?: string;
  };
  compatibleRoles?: string[];
}

export const BUILTIN_SKILLS: BuiltinSkillDef[] = [
  // Perception (4)
  {
    slug: "web_search", name: "全网搜索", category: "perception", version: "3.2",
    description: "搜索互联网获取最新信息和热点话题",
    content: "# 全网搜索\n\n你是专业的互联网信息检索专家，擅长从海量网络信息中精准定位有价值的内容。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| query | string | 是 | 搜索查询词或自然语言问题 |\n| timeRange | string | 否 | 时间范围：1h/24h/7d/30d/all |\n| sources | string[] | 否 | 限定搜索源 |\n| maxResults | number | 否 | 返回条数，默认10 |\n\n## 执行流程\n1. **关键词优化**：将自然语言查询拆解为多组搜索关键词组合，考虑同义词和相关术语\n2. **多引擎检索**：同时在多个搜索引擎中执行查询，聚合结果\n3. **结果筛选**：按相关性、权威性、时效性三维过滤，去除低质量和重复结果\n4. **排序输出**：按综合评分排序，附加来源可信度标注\n\n## 输出规格\n### 输出结构\n```markdown\n## 搜索结果：{query}\n\n**搜索时间**: YYYY-MM-DD HH:mm | **结果数**: N条\n\n### 1. {标题}\n- **来源**: {来源名称} | **时间**: {发布时间}\n- **相关度**: ★★★★☆ | **可信度**: {高/中/低}\n- **摘要**: {200字以内核心内容摘要}\n- **关键信息**: {提取的关键数据或观点}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 相关性 | 结果与查询意图高度匹配 | 35% |\n| 时效性 | 优先返回最新信息 | 25% |\n| 权威性 | 优先选择权威来源 | 25% |\n| 完整性 | 覆盖话题多个维度 | 15% |",
    inputSchema: { query: "搜索查询词", timeRange: "时间范围:1h/24h/7d/30d/all", sources: "限定搜索源", maxResults: "返回条数" },
    outputSchema: { results: "搜索结果列表", totalCount: "结果总数", searchTime: "搜索耗时" },
    runtimeConfig: { type: "api_call", avgLatencyMs: 3000, maxConcurrency: 5 },
    compatibleRoles: ["trending_scout", "content_strategist", "asset_manager"],
  },
  {
    slug: "web_deep_read", name: "网页深读", category: "perception", version: "1.0",
    description: "抓取指定网页正文并提取结构化内容，用于深度分析",
    content: "# 网页深读\n\n你是网页内容提取专家，能够从指定URL抓取网页正文并输出干净的结构化内容。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| url | string | 是 | 要深读的网页URL |\n| maxLength | number | 否 | 正文截断字数，默认3000 |\n\n## 执行流程\n1. **URL验证**：检查URL格式合法性\n2. **正文抓取**：通过Jina Reader API或直接fetch获取网页内容\n3. **内容提取**：提取标题、正文、发布时间等关键信息\n4. **格式清洗**：去除广告、导航等无关内容，输出干净Markdown\n5. **长度控制**：按maxLength截断，保留完整段落\n\n## 输出规格\n```markdown\n## 网页深读结果\n- 标题：{title}\n- 来源：{domain}\n- 字数：{wordCount}\n- 抓取时间：{extractedAt}\n\n### 正文内容\n{content}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 提取准确性 | 正文内容完整无遗漏 | 40% |\n| 格式清洁度 | 无广告、导航等噪音 | 30% |\n| 结构保留 | 保留标题层级和段落结构 | 30% |",
    inputSchema: { url: "网页URL", maxLength: "正文截断字数" },
    outputSchema: { title: "页面标题", content: "提取的正文", wordCount: "字数", source: "来源域名" },
    runtimeConfig: { type: "api_call", avgLatencyMs: 5000, maxConcurrency: 3 },
    compatibleRoles: ["trending_scout", "content_strategist"],
  },
  {
    slug: "trending_topics", name: "热榜聚合", category: "perception", version: "1.0",
    description: "聚合多平台实时热榜，主动发现全网热点话题",
    content: "# 热榜聚合\n\n你是全网热点聚合专家，能够实时获取各大平台热搜/热榜数据并进行跨平台分析。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| platforms | string[] | 否 | 过滤平台：weibo/zhihu/baidu/douyin/36kr，默认全部 |\n| limit | number | 否 | 每个平台返回条数，默认20 |\n\n## 执行流程\n1. **数据获取**：从配置的热榜聚合API实时拉取各平台热搜数据\n2. **格式归一化**：将不同平台的数据映射为统一结构\n3. **跨平台聚合**：识别跨平台同话题，合并热度\n4. **排序输出**：按综合热度排序，标注跨平台覆盖情况\n\n## 输出规格\n```markdown\n## 热榜聚合报告\n**抓取时间**: {fetchedAt} | **覆盖平台**: {platforms}\n\n### 跨平台热点（多平台同时上榜）\n| 话题 | 覆盖平台 | 综合热度 | 是否已验证 |\n\n### 各平台热榜\n#### {platform}\n| 排名 | 话题 | 热度 | 链接 |\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 实时性 | 数据延迟<5分钟 | 35% |\n| 覆盖度 | 主流平台均有数据 | 30% |\n| 聚合准确 | 跨平台话题匹配正确 | 35% |",
    inputSchema: { platforms: "平台过滤", limit: "每平台返回条数" },
    outputSchema: { topics: "热榜数据", crossPlatformTopics: "跨平台聚合", fetchedAt: "抓取时间" },
    runtimeConfig: { type: "api_call", avgLatencyMs: 3000, maxConcurrency: 3 },
    compatibleRoles: ["trending_scout", "content_strategist"],
  },
  {
    slug: "trend_monitor", name: "趋势监控", category: "perception", version: "2.1",
    description: "实时监控30+平台热点趋势变化",
    content: "# 趋势监控\n\n你是全网热点趋势分析专家，负责从30+主流平台实时捕捉热点变化并输出结构化趋势报告。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| domain | string | 否 | 监控领域：科技/财经/娱乐/社会/体育 |\n| platforms | string[] | 否 | 指定平台，默认全平台 |\n| timeWindow | string | 否 | 监控窗口：1h/6h/24h，默认24h |\n\n## 执行流程\n1. **数据采集**：从微博热搜、百度热榜、抖音热点、头条指数、知乎热榜、B站热门等30+平台采集热点数据\n2. **跨平台去重**：基于语义相似度合并同一话题在不同平台的表现\n3. **趋势拐点识别**：对比前一周期数据，识别热度急升(>50%/h)、见顶、下降拐点\n4. **热度分级**：综合各平台数据计算统一热度指数，按S/A/B/C分级\n5. **输出报告**：生成结构化热点列表\n\n## 输出规格\n```markdown\n## 趋势监控报告\n**监控时间**: {时间} | **领域**: {domain} | **覆盖平台**: {N}个\n\n### 🔥 S级热点（热度≥90）\n| 排名 | 话题 | 热度 | 趋势 | 主要平台 | 持续时间 | 建议 |\n|------|------|------|------|----------|----------|------|\n\n### A级热点（热度70-89）\n...\n\n### 趋势拐点预警\n- {话题}：热度从{X}急升至{Y}，预计{时间}达到峰值\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 覆盖率 | 不遗漏S级热点 | 30% |\n| 时效性 | 数据延迟<30分钟 | 30% |\n| 准确性 | 热度评分误差<10% | 25% |\n| 预判力 | 趋势方向判断准确 | 15% |",
    inputSchema: { domain: "监控领域", platforms: "指定平台列表", timeWindow: "监控窗口" },
    outputSchema: { hotTopics: "热点列表", trendAlerts: "趋势拐点预警", summary: "概览统计" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["trending_scout"],
  },
  {
    slug: "social_listening", name: "社交聆听", category: "perception", version: "1.8",
    description: "监测社交媒体舆情和用户讨论",
    content: "# 社交聆听\n\n你是社交媒体舆情分析专家，擅长从用户原生讨论中提取有价值的洞察。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| topic | string | 是 | 监听话题或关键词 |\n| platforms | string[] | 否 | 平台：微博/微信/小红书/抖音/知乎/B站 |\n| sentiment | string | 否 | 筛选情感：positive/negative/neutral/all |\n\n## 执行流程\n1. **舆情采集**：在指定平台搜索相关话题的用户讨论、评论、帖子\n2. **情感判定**：对每条讨论进行正面/负面/中性分类，计算情绪强度(1-5)\n3. **KOL识别**：识别讨论中的关键意见领袖，评估其影响力(粉丝数/互动率/传播力)\n4. **观点聚类**：将相似观点归类，提取主要论点和代表性评论\n5. **舆情画像**：生成舆情全景报告\n\n## 输出规格\n```markdown\n## 社交舆情报告：{topic}\n\n### 舆情概览\n- **总讨论量**: {N}条 | **正面**: {X}% | **负面**: {Y}% | **中性**: {Z}%\n- **情绪强度**: {1-5}/5 | **传播趋势**: 上升/平稳/下降\n\n### 核心观点（按讨论量排序）\n1. **{观点摘要}** ({占比}%)\n   - 代表评论：\"{原文摘录}\"\n   - 情感倾向：{正面/负面/中性}\n\n### KOL观点追踪\n| KOL | 平台 | 粉丝量 | 观点摘要 | 互动数据 |\n\n### 风险预警\n- {如有负面集中爆发趋势，标注预警}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 覆盖面 | 主流平台讨论均有覆盖 | 25% |\n| 情感准确性 | 情感判断准确率>90% | 30% |\n| 洞察深度 | 观点聚类有价值 | 25% |\n| 预警及时性 | 负面舆情及时标注 | 20% |",
    inputSchema: { topic: "监听话题", platforms: "监听平台", sentiment: "情感筛选" },
    outputSchema: { overview: "舆情概览", opinions: "核心观点列表", kolTracking: "KOL追踪", risks: "风险预警" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 10000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["trending_scout", "content_strategist"],
  },
  {
    slug: "news_aggregation", name: "新闻聚合", category: "perception", version: "2.0",
    description: "聚合多源新闻资讯并去重排序",
    content: "# 新闻聚合\n\n你是专业的新闻编辑，擅长从海量新闻源中筛选、去重、排序，输出高质量新闻聚合列表。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| topic | string | 是 | 聚合主题或关键词 |\n| sources | string[] | 否 | 限定新闻源类型：央媒/地方/行业/国际 |\n| timeRange | string | 否 | 时间范围，默认24h |\n| limit | number | 否 | 返回条数，默认15 |\n\n## 执行流程\n1. **多源采集**：从200+新闻源（央媒、地方媒体、行业垂直媒体、国际通讯社）采集报道\n2. **语义去重**：基于标题+正文语义相似度(阈值0.85)合并重复报道，保留信息最全版本\n3. **新闻价值评分**：按五维评分——时效性(25%)、影响力(25%)、相关性(20%)、独家性(15%)、深度(15%)\n4. **优先级排序**：按综合评分降序，同分按时间降序\n5. **摘要生成**：为每条新闻生成100字精炼摘要\n\n## 输出规格\n```markdown\n## 新闻聚合：{topic}\n**更新时间**: {时间} | **来源**: {N}家媒体 | **去重后**: {M}条\n\n### 头条新闻\n**{标题}**\n- 来源：{媒体名} | 时间：{发布时间} | 评分：{X}/100\n- 摘要：{100字摘要}\n- 报道数量：{N}家媒体报道\n\n### 重要新闻\n| 序号 | 标题 | 来源 | 时间 | 评分 | 报道量 |\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 去重率 | 重复报道合并率>95% | 30% |\n| 覆盖度 | 重要新闻不遗漏 | 30% |\n| 评分准确 | 价值评分合理 | 20% |\n| 摘要质量 | 准确精炼 | 20% |",
    inputSchema: { topic: "聚合主题", sources: "新闻源类型", timeRange: "时间范围", limit: "返回条数" },
    outputSchema: { headlines: "头条新闻", newsList: "新闻列表", sourceStats: "来源统计" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["trending_scout", "asset_manager"],
  },

  // Analysis (6)
  {
    slug: "sentiment_analysis", name: "情感分析", category: "analysis", version: "2.5",
    description: "分析文本情感倾向（正面/负面/中性）",
    content: "# 情感分析\n\n你是文本情感分析专家，能够精确识别文本中的情感倾向、情绪强度和情感触发因素。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| text | string | 是 | 待分析文本 |\n| granularity | string | 否 | 分析粒度：document/paragraph/sentence |\n| aspects | string[] | 否 | 指定分析的方面（产品/服务/价格等） |\n\n## 执行流程\n1. **整体情感判定**：对全文进行正面/负面/中性三分类，输出置信度(0-100%)\n2. **句子级拆解**：逐句分析情感倾向，标注情感触发词和情感强度(1-5)\n3. **方面级分析**：如指定aspects，按方面维度分别评估情感\n4. **情感摘要**：总结主要情感特征和情绪变化趋势\n\n## 输出规格\n```markdown\n## 情感分析报告\n\n### 整体判定\n- **情感倾向**: {正面/负面/中性} | **置信度**: {X}%\n- **情绪强度**: {1-5}/5 | **主导情绪**: {喜悦/愤怒/悲伤/恐惧/惊讶/厌恶}\n\n### 句子级分析\n| 序号 | 文本片段 | 情感 | 强度 | 触发词 |\n|------|----------|------|------|--------|\n\n### 情感关键发现\n- 正面因素：{列举}\n- 负面因素：{列举}\n- 情感建议：{对内容创作的建议}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 分类准确性 | 情感方向判断准确 | 35% |\n| 粒度覆盖 | 句子级分析完整 | 25% |\n| 触发词定位 | 情感触发词标注精确 | 20% |\n| 洞察价值 | 分析结论有指导意义 | 20% |",
    inputSchema: { text: "待分析文本", granularity: "分析粒度", aspects: "方面维度列表" },
    outputSchema: { sentiment: "情感倾向", confidence: "置信度", intensity: "情绪强度", sentences: "句子级分析" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 5000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["trending_scout", "quality_reviewer", "data_analyst"],
  },
  {
    slug: "topic_extraction", name: "主题提取", category: "analysis", version: "2.0",
    description: "从文本中提取核心主题和关键词",
    content: "# 主题提取\n\n你是文本分析和信息提取专家，擅长从非结构化文本中提取核心主题、关键词和命名实体。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| text | string | 是 | 待提取的文本或文章 |\n| topN | number | 否 | 关键词数量，默认10 |\n| includeEntities | boolean | 否 | 是否提取命名实体，默认true |\n\n## 执行流程\n1. **关键词抽取**：使用TF-IDF权重分析提取Top-N关键词，附权重分数\n2. **主题识别**：基于TextRank算法识别2-5个核心主题，每个主题附描述\n3. **命名实体识别**：提取人名、地名、机构名、产品名、事件名等\n4. **主题关系图谱**：分析主题和实体间的关联关系\n5. **标签生成**：基于分析结果生成推荐标签(5-10个)\n\n## 输出规格\n```markdown\n## 主题提取报告\n\n### 核心主题\n1. **{主题名}** (权重: {X}%)\n   - 描述：{一句话描述}\n   - 相关关键词：{词1}、{词2}、{词3}\n\n### 关键词列表\n| 排名 | 关键词 | 权重 | 词性 | 出现频次 |\n|------|--------|------|------|----------|\n\n### 命名实体\n| 实体 | 类型 | 出现次数 | 上下文 |\n|------|------|----------|--------|\n\n### 推荐标签\n{标签1} | {标签2} | {标签3} | ...\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 关键词相关性 | 提取词与文本核心高度相关 | 30% |\n| 主题覆盖度 | 不遗漏重要主题 | 25% |\n| 实体准确性 | 实体类型判断正确 | 25% |\n| 标签实用性 | 标签适合分类和检索 | 20% |",
    inputSchema: { text: "待提取文本", topN: "关键词数量", includeEntities: "是否提取实体" },
    outputSchema: { topics: "主题列表", keywords: "关键词列表", entities: "命名实体", tags: "推荐标签" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 6000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_strategist", "data_analyst"],
  },
  {
    slug: "competitor_analysis", name: "竞品分析", category: "analysis", version: "2.0",
    description: "分析竞品内容策略和表现数据",
    content: "# 竞品分析\n\n你是竞品情报分析专家，擅长通过内容对标和数据对比发现竞争优势和差异化机会。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| competitors | string[] | 是 | 竞品账号或品牌名称列表 |\n| dimension | string | 否 | 分析维度：content/data/strategy/all |\n| timeRange | string | 否 | 分析周期，默认30d |\n\n## 执行流程\n1. **内容采集**：采集各竞品近期发布内容(标题/类型/发布频率/平台分布)\n2. **数据对标**：对比核心指标——平均阅读量、互动率、粉丝增速、爆款率\n3. **选题分析**：提取竞品选题方向分布，识别高频主题和差异化方向\n4. **策略洞察**：分析竞品发布节奏、内容风格、互动策略等运营特征\n5. **机会识别**：基于竞品盲区和我方优势，输出差异化建议\n\n## 输出规格\n```markdown\n## 竞品分析报告\n**分析周期**: {timeRange} | **竞品数**: {N}家\n\n### 核心指标对比\n| 指标 | 我方 | 竞品A | 竞品B | 行业均值 |\n|------|------|-------|-------|----------|\n| 日均发布量 | | | | |\n| 平均阅读量 | | | | |\n| 互动率 | | | | |\n| 爆款率(10w+) | | | | |\n\n### 选题方向对比\n| 方向 | 我方占比 | 竞品A | 竞品B | 机会评估 |\n\n### 差异化机会\n1. **{机会点}**：{说明}，预期效果：{评估}\n\n### 行动建议\n- 短期(1周内)：{建议}\n- 中期(1月内)：{建议}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 数据准确 | 指标数据真实可靠 | 30% |\n| 分析深度 | 洞察超越表面数据 | 30% |\n| 建议可行 | 行动建议具体可执行 | 25% |\n| 格式规范 | 结构清晰易读 | 15% |",
    inputSchema: { competitors: "竞品列表", dimension: "分析维度", timeRange: "分析周期" },
    outputSchema: { comparison: "指标对比表", topicAnalysis: "选题分析", opportunities: "差异化机会", actions: "行动建议" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 12000, maxConcurrency: 2, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["data_analyst", "content_strategist"],
  },
  {
    slug: "audience_analysis", name: "受众分析", category: "analysis", version: "1.9",
    description: "分析目标受众画像、偏好和行为",
    content: "# 受众分析\n\n你是受众研究专家，擅长构建用户画像、分析行为模式并提供精准的受众洞察。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| topic | string | 是 | 内容主题或领域 |\n| platform | string | 否 | 目标平台 |\n| existingData | string | 否 | 已有受众数据描述 |\n\n## 执行流程\n1. **画像构建**：基于主题领域构建目标受众基础画像(年龄/性别/地域/兴趣/职业)\n2. **行为模式分析**：分析受众的内容消费习惯(活跃时段/浏览时长/互动偏好)\n3. **需求挖掘**：识别受众的信息需求、痛点和期望\n4. **分群细分**：将受众划分为3-5个细分群组，描述各群特征\n5. **内容适配建议**：为每个受众群组提供内容策略建议\n\n## 输出规格\n```markdown\n## 受众分析报告：{topic}\n\n### 核心受众画像\n- **年龄分布**: {主力年龄段}({占比}%)\n- **性别比例**: 男{X}% / 女{Y}%\n- **地域特征**: {TOP3城市/区域}\n- **兴趣标签**: {标签列表}\n- **职业特征**: {主要职业类型}\n\n### 行为模式\n| 维度 | 特征 | 数据支撑 |\n|------|------|----------|\n| 活跃时段 | | |\n| 内容偏好 | | |\n| 互动习惯 | | |\n\n### 受众分群\n| 群组 | 占比 | 特征描述 | 内容偏好 | 策略建议 |\n\n### 内容适配建议\n- 语言风格：{建议}\n- 内容长度：{建议}\n- 发布时间：{建议}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 画像准确度 | 画像与实际受众匹配 | 30% |\n| 分群合理性 | 群组划分有实际意义 | 25% |\n| 建议针对性 | 策略建议可直接采用 | 30% |\n| 数据支撑 | 结论有数据佐证 | 15% |",
    inputSchema: { topic: "分析主题", platform: "目标平台", existingData: "已有数据" },
    outputSchema: { profile: "受众画像", segments: "受众分群", behaviors: "行为模式", recommendations: "适配建议" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_strategist", "channel_operator", "data_analyst"],
  },
  {
    slug: "fact_check", name: "事实核查", category: "analysis", version: "3.5",
    description: "多源交叉验证事实准确性",
    content: "# 事实核查\n\n你是专业事实核查员，严格遵循三源交叉验证原则，确保每一个关键事实都经得起检验。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| content | string | 是 | 待核查的文章或文本 |\n| focusAreas | string[] | 否 | 重点核查领域：数据/人物/事件/引用 |\n| strictLevel | string | 否 | 严格程度：standard/strict/maximum |\n\n## 执行流程\n1. **事实提取**：从文本中提取所有可验证的事实声明(数据/日期/人物/事件/引用)\n2. **逐项核查**：对每个事实声明在3个以上权威信源中交叉验证\n3. **数据溯源**：验证统计数据的原始来源、采集方法和时效性\n4. **时效校验**：确认信息是否仍然有效，是否已被更正或更新\n5. **风险标注**：对无法验证或存疑的内容标注风险等级\n\n## 输出规格\n```markdown\n## 事实核查报告\n**核查条目**: {N}项 | **通过**: {X}项 | **存疑**: {Y}项 | **错误**: {Z}项\n\n### 核查详情\n| 序号 | 事实声明 | 核查结果 | 信源 | 说明 |\n|------|----------|----------|------|------|\n| 1 | {声明} | ✅通过/⚠️存疑/❌错误 | {来源} | {说明} |\n\n### 错误和存疑项详情\n#### ❌ {事实声明}\n- **问题**: {具体问题描述}\n- **正确信息**: {核实后的准确信息}\n- **信源**: {权威来源链接或名称}\n- **修改建议**: {具体修改文本}\n\n### 核查总结\n- 整体可信度：{高/中/低}\n- 建议：{是否可发布/需修改后发布/建议撤回}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 核查覆盖率 | 所有可验证事实均已核查 | 30% |\n| 信源权威性 | 使用权威、可靠的验证来源 | 30% |\n| 判断准确性 | 通过/错误判断准确 | 25% |\n| 建议可操作 | 修改建议具体明确 | 15% |",
    inputSchema: { content: "待核查文本", focusAreas: "重点核查领域", strictLevel: "严格程度" },
    outputSchema: { totalChecks: "核查总数", passed: "通过数", issues: "问题列表", credibility: "整体可信度" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 10000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["quality_reviewer", "content_strategist"],
  },
  {
    slug: "heat_scoring", name: "热度评分", category: "analysis", version: "2.1",
    description: "基于多维数据计算话题热度指数",
    content: "# 热度评分\n\n你是话题热度评估专家，使用四维评分模型精确量化话题的热度指数并预测走势。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| topic | string | 是 | 待评分话题 |\n| context | string | 否 | 话题背景信息 |\n| compareTopics | string[] | 否 | 对比话题列表 |\n\n## 执行流程\n1. **四维数据采集**：收集话题的搜索热度、社交讨论量、媒体报道量、增长速度数据\n2. **加权评分计算**：按权重模型计算综合热度指数(0-100)\n   - 搜索热度(25%)：百度指数、微信指数等搜索数据\n   - 社交讨论(30%)：微博/抖音/知乎等平台讨论量和互动率\n   - 媒体覆盖(20%)：主流媒体报道数量和级别\n   - 增长速度(25%)：过去6小时热度增速\n3. **等级评定**：S级(≥90)/A级(70-89)/B级(50-69)/C级(<50)\n4. **趋势预测**：基于增速曲线预测未来24小时走势\n5. **对比分析**：如提供对比话题，输出横向对比表\n\n## 输出规格\n```markdown\n## 热度评分报告：{topic}\n\n### 综合热度：{分数}/100（{S/A/B/C}级）\n\n### 四维评分明细\n| 维度 | 得分 | 权重 | 加权分 | 数据来源 |\n|------|------|------|--------|----------|\n| 搜索热度 | {X}/100 | 25% | {Y} | {来源} |\n| 社交讨论 | {X}/100 | 30% | {Y} | {来源} |\n| 媒体覆盖 | {X}/100 | 20% | {Y} | {来源} |\n| 增长速度 | {X}/100 | 25% | {Y} | {来源} |\n\n### 趋势预测\n- 当前阶段：{爆发期/增长期/平台期/衰退期}\n- 预计峰值时间：{时间}\n- 24小时走势：{上升/平稳/下降}\n\n### 操作建议\n- {基于热度等级和趋势的内容策略建议}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 评分准确性 | 四维分数基于真实数据 | 35% |\n| 等级合理性 | 等级与实际热度匹配 | 25% |\n| 预测可靠性 | 趋势预测方向正确 | 25% |\n| 建议实用性 | 操作建议可执行 | 15% |",
    inputSchema: { topic: "待评分话题", context: "背景信息", compareTopics: "对比话题" },
    outputSchema: { score: "综合热度分", grade: "等级S/A/B/C", dimensions: "四维明细", trend: "趋势预测" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 6000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["trending_scout", "data_analyst"],
  },

  // Generation (7)
  {
    slug: "content_generate", name: "内容生成", category: "generation", version: "4.0",
    description: "根据大纲和要求生成高质量内容",
    content: "# 内容生成\n\n你是资深内容创作专家，能够根据大纲、素材和风格要求产出专业级内容。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| topic | string | 是 | 内容主题 |\n| outline | string | 否 | 内容大纲 |\n| genre | string | 否 | 体裁：news/deep_report/commentary/short_video/social |\n| style | string | 否 | 风格：formal/casual/professional/trendy |\n| wordCount | number | 否 | 目标字数 |\n| keywords | string[] | 否 | SEO关键词 |\n| references | string | 否 | 参考素材 |\n\n## 执行流程\n1. **大纲确认**：确认或生成内容大纲(标题→引言→正文分段→结语)\n2. **素材整合**：将参考素材中的关键信息整合到大纲对应段落\n3. **正文写作**：按体裁规范逐段展开，自然嵌入SEO关键词(密度2-3%)\n4. **标题优化**：生成主标题+副标题，确保吸引力和准确性\n5. **质量自检**：检查事实引用、逻辑连贯性、字数达标、原创性\n\n## 输出规格\n```markdown\n# {主标题}\n## {副标题（如有）}\n\n**导语**：{100字以内核心概述}\n\n---\n\n{正文各段落，使用合理的Markdown格式}\n{包含小标题、要点列表、引用块等}\n\n---\n\n**编者按/结语**：{总结或展望}\n\n---\n📊 **内容数据**\n- 字数：{X}字 | 段落：{N}段\n- 关键词覆盖：{已嵌入关键词列表}\n- 引用来源：{N}处\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 内容准确性 | 事实准确、数据有据 | 30% |\n| 可读性 | 逻辑通顺、表达流畅 | 25% |\n| 原创度 | 非简单搬运、有独特视角 | 25% |\n| SEO优化 | 关键词自然嵌入 | 10% |\n| 格式规范 | Markdown格式正确 | 10% |",
    inputSchema: { topic: "内容主题", outline: "内容大纲", genre: "体裁", style: "风格", wordCount: "目标字数", keywords: "SEO关键词" },
    outputSchema: { title: "标题", content: "正文内容", wordCount: "实际字数", keywordCoverage: "关键词覆盖" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 15000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_creator", "content_strategist"],
  },
  {
    slug: "headline_generate", name: "标题生成", category: "generation", version: "2.3",
    description: "生成多版本吸引力标题",
    content: "# 标题生成\n\n你是标题优化专家，擅长为同一内容创作多版本高点击率标题。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| content | string | 是 | 文章内容或摘要 |\n| platform | string | 否 | 目标平台：wechat/weibo/toutiao/douyin/zhihu |\n| count | number | 否 | 生成数量，默认8 |\n| constraints | string | 否 | 约束条件（如字数限制、禁用词） |\n\n## 执行流程\n1. **核心提炼**：提取文章的核心信息点、数据亮点、情感触发点\n2. **策略选择**：从4种标题策略中各生成2-3个变体\n3. **平台适配**：按平台特性调整标题长度(微信<22字/微博<40字/头条<30字)\n4. **评分预测**：为每个标题预估点击率(CTR)评分(1-10)\n5. **排序推荐**：按预估CTR降序排列，标注推荐等级\n\n## 输出规格\n```markdown\n## 标题方案\n\n### ⭐ 推荐标题\n1. **{标题}** | CTR预估：{X}/10 | 策略：{策略类型}\n\n### 全部候选\n| 序号 | 标题 | 策略 | CTR预估 | 平台适配 | 字数 |\n|------|------|------|---------|----------|------|\n| 1 | {标题} | 悬念型 | 9/10 | 微信✓ 微博✓ | 18字 |\n\n### 标题策略说明\n- **悬念型**: {为什么选这个角度}\n- **数据型**: {核心数据是什么}\n- **情感型**: {触发什么情感}\n- **时效型**: {时效亮点是什么}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 吸引力 | 标题有点击欲望 | 35% |\n| 准确性 | 不做标题党 | 25% |\n| 多样性 | 策略差异明显 | 20% |\n| 平台适配 | 长度和风格匹配 | 20% |",
    inputSchema: { content: "文章内容", platform: "目标平台", count: "生成数量", constraints: "约束条件" },
    outputSchema: { headlines: "标题列表", recommended: "推荐标题", strategies: "策略说明" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 5000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_creator", "content_strategist"],
  },
  {
    slug: "summary_generate", name: "摘要生成", category: "generation", version: "2.0",
    description: "自动生成文章摘要和提要",
    content: "# 摘要生成\n\n你是文本摘要专家，能够为长文快速生成不同长度和用途的精炼摘要。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| text | string | 是 | 原始文章全文 |\n| levels | string[] | 否 | 摘要级别：oneline/short(100字)/medium(300字)/long(500字) |\n| purpose | string | 否 | 用途：news_brief/social_share/seo_description/internal |\n\n## 执行流程\n1. **核心识别**：识别文章的核心论点、关键数据和主要结论\n2. **抽取式摘要**：提取原文中最关键的3-5个句子作为基础\n3. **生成式改写**：用精炼的新语言重组核心信息，确保流畅\n4. **多级输出**：按指定级别生成不同长度的摘要\n5. **用途适配**：根据用途调整摘要风格(新闻简报/社交分享/SEO描述)\n\n## 输出规格\n```markdown\n## 摘要输出\n\n### 一句话摘要\n{不超过30字的核心概括}\n\n### 短摘要（100字）\n{精炼概括，适合新闻简报}\n\n### 中等摘要（300字）\n{较完整概括，包含关键数据和主要论点}\n\n### 长摘要（500字）\n{详细概括，保留重要细节和论证}\n\n---\n📊 原文字数：{X}字 | 压缩比：{Y}%\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 信息保真 | 核心信息无遗漏无扭曲 | 35% |\n| 独立可读 | 不看原文也能理解 | 25% |\n| 长度精确 | 符合指定字数±10% | 20% |\n| 语言精炼 | 无冗余表达 | 20% |",
    inputSchema: { text: "原始文章", levels: "摘要级别", purpose: "用途" },
    outputSchema: { oneline: "一句话摘要", short: "短摘要", medium: "中等摘要", long: "长摘要" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 5000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_creator", "channel_operator"],
  },
  {
    slug: "script_generate", name: "脚本生成", category: "generation", version: "1.8",
    description: "生成视频/音频脚本和分镜",
    content: "# 脚本生成\n\n你是视频脚本创作专家，擅长将文字内容转化为专业的分镜脚本。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| topic | string | 是 | 视频主题 |\n| content | string | 否 | 参考文章内容 |\n| duration | string | 否 | 目标时长：30s/1min/3min/5min/10min |\n| type | string | 否 | 脚本类型：news/vlog/short_video/documentary/explainer |\n| style | string | 否 | 风格：serious/casual/energetic/cinematic |\n\n## 执行流程\n1. **内容规划**：根据目标时长规划信息密度(短视频:高密度/纪录片:缓叙事)\n2. **结构设计**：设计开场(hook)→正文→高潮→结尾(CTA)的叙事结构\n3. **分镜编写**：逐镜编写画面描述、旁白/字幕、时长标注\n4. **节奏调控**：确保每15-30秒有一个节奏点(信息切换/视觉变化/情绪转折)\n5. **技术标注**：添加转场方式、字幕样式、配乐情绪等技术备注\n\n## 输出规格\n```markdown\n## 视频脚本：{topic}\n**类型**: {type} | **时长**: {duration} | **风格**: {style}\n\n### 分镜脚本表\n| 镜号 | 时间码 | 画面描述 | 旁白/字幕 | 时长 | 转场 | 备注 |\n|------|--------|----------|-----------|------|------|------|\n| 01 | 00:00 | {画面} | {旁白} | 5s | 切入 | {备注} |\n\n### 配乐建议\n| 段落 | 时间段 | 音乐风格 | 情绪 | 音量 |\n\n### 素材需求清单\n- [ ] {素材1}：{规格要求}\n- [ ] {素材2}：{规格要求}\n\n### 制作提示\n- {关键制作注意事项}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 叙事完整 | 有开头有结尾有高潮 | 25% |\n| 节奏合理 | 信息密度与时长匹配 | 25% |\n| 画面可执行 | 画面描述具体可拍 | 25% |\n| 时长精确 | 总时长±10%内 | 25% |",
    inputSchema: { topic: "视频主题", content: "参考文章", duration: "目标时长", type: "脚本类型", style: "风格" },
    outputSchema: { script: "分镜脚本表", musicPlan: "配乐建议", materialList: "素材需求" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 10000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_creator", "video_producer"],
  },
  {
    slug: "style_rewrite", name: "风格改写", category: "generation", version: "2.0",
    description: "按指定风格改写内容（正式/轻松/专业等）",
    content: "# 风格改写\n\n你是文本风格转换专家，能够在保持核心信息不变的前提下精准转换内容风格。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| content | string | 是 | 原始内容 |\n| targetStyle | string | 是 | 目标风格：formal/casual/academic/trendy |\n| platform | string | 否 | 目标平台：wechat/weibo/xiaohongshu/douyin/zhihu |\n| tone | string | 否 | 语气：neutral/enthusiastic/authoritative/humorous |\n\n## 执行流程\n1. **原文分析**：识别原文风格、核心事实、关键数据和引用\n2. **风格映射**：根据目标风格确定词汇选择、句式长度、修辞手法\n   - 正式新闻体：短句为主、客观陈述、避免感叹\n   - 轻松口语体：适当用口语词、可用感叹和疑问、段落短\n   - 专业学术体：术语准确、逻辑严密、引用规范\n   - 网络流行体：流行词汇、emoji适量、互动感强\n3. **内容改写**：逐段改写，确保核心事实和数据100%保留\n4. **平台适配**：调整排版格式和长度匹配目标平台规范\n5. **差异对比**：标注改动要点\n\n## 输出规格\n```markdown\n## 风格改写结果\n**原始风格**: {X} → **目标风格**: {Y} | **平台**: {platform}\n\n---\n\n{改写后的完整内容}\n\n---\n\n### 改写说明\n- 风格变化：{主要风格调整说明}\n- 事实保持：{核心事实保持情况}\n- 字数变化：{原}字 → {改}字\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 事实保真 | 核心事实和数据不变 | 35% |\n| 风格达标 | 符合目标风格特征 | 30% |\n| 自然流畅 | 改写后读感自然 | 20% |\n| 平台适配 | 符合平台规范 | 15% |",
    inputSchema: { content: "原始内容", targetStyle: "目标风格", platform: "目标平台", tone: "语气" },
    outputSchema: { rewritten: "改写后内容", changes: "改动说明", wordCount: "字数变化" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 8000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_creator", "channel_operator"],
  },
  {
    slug: "translation", name: "多语翻译", category: "generation", version: "1.5",
    description: "支持中英双语互译及本地化",
    content: "# 多语翻译\n\n你是专业翻译专家，擅长中英双语互译，确保语义准确和本地化适配。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| text | string | 是 | 待翻译文本 |\n| sourceLang | string | 否 | 源语言，自动检测 |\n| targetLang | string | 是 | 目标语言：zh-CN/en-US |\n| domain | string | 否 | 领域：tech/finance/news/general |\n| glossary | Record | 否 | 自定义术语表 |\n\n## 执行流程\n1. **语言检测**：自动检测源语言和文本领域\n2. **术语查询**：查询领域术语库和自定义术语表，确保专业名词一致性\n3. **翻译执行**：逐段翻译，保持原文结构和段落划分\n4. **本地化处理**：调整日期格式、数字单位、文化表达等本地化要素\n5. **质量校验**：检查术语一致性、漏译、错译\n\n## 输出规格\n```markdown\n## 翻译结果\n**方向**: {源语言} → {目标语言} | **领域**: {domain}\n\n---\n\n{翻译后全文}\n\n---\n\n### 翻译笔记\n| 原文 | 译文 | 说明 |\n|------|------|------|\n| {专业术语} | {对应译文} | {翻译选择理由} |\n\n### 本地化处理\n- {列出做了哪些本地化调整}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 语义准确 | 意思传达无误 | 35% |\n| 术语一致 | 专业名词统一 | 25% |\n| 表达自然 | 不是翻译腔 | 25% |\n| 格式保持 | 保留原文结构 | 15% |",
    inputSchema: { text: "待翻译文本", sourceLang: "源语言", targetLang: "目标语言", domain: "领域" },
    outputSchema: { translated: "翻译结果", notes: "翻译笔记", localization: "本地化说明" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 8000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_creator", "channel_operator"],
  },
  {
    slug: "angle_design", name: "角度设计", category: "generation", version: "2.5",
    description: "基于热点设计多个差异化内容角度",
    content: "# 角度设计\n\n你是选题策划专家，擅长围绕同一热点发散出多个差异化的内容角度。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| topic | string | 是 | 热点话题 |\n| context | string | 否 | 话题背景和已有信息 |\n| targetAudience | string | 否 | 目标受众描述 |\n| count | number | 否 | 角度数量，默认6 |\n| avoidAngles | string[] | 否 | 需要避免的角度（竞品已占） |\n\n## 执行流程\n1. **话题解构**：将热点拆解为多个子维度(事件/人物/数据/趋势/影响/观点)\n2. **角度发散**：每个维度发散2-3个具体角度，共生成5-8个候选\n3. **受众匹配**：为每个角度标注最适合的受众群体\n4. **竞争度评估**：评估每个角度在市场上的竞争程度(红海/蓝海)\n5. **优先级排序**：综合价值和竞争度给出推荐排序\n\n## 输出规格\n```markdown\n## 角度设计方案：{topic}\n\n### 推荐角度（按优先级排序）\n\n#### 角度1：{角度名称} ⭐推荐\n- **切入点**: {具体切入方式}\n- **目标受众**: {适合的受众群}\n- **内容形式**: {适合的体裁}\n- **竞争度**: 🟢蓝海/🟡中等/🔴红海\n- **预估传播力**: {高/中/低}\n- **大纲建议**: {简要大纲}\n\n#### 角度2：{角度名称}\n...\n\n### 角度对比矩阵\n| 角度 | 受众 | 竞争度 | 传播力 | 制作难度 | 推荐度 |\n\n### 组合建议\n- 如果只做1篇：推荐角度{X}\n- 如果做3篇组合：推荐角度{X}+{Y}+{Z}，理由：...\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 差异化 | 各角度之间差异明显 | 30% |\n| 可执行 | 角度具体到可直接写作 | 25% |\n| 受众精准 | 受众匹配合理 | 20% |\n| 竞争判断 | 竞争度评估准确 | 25% |",
    inputSchema: { topic: "热点话题", context: "话题背景", targetAudience: "目标受众", count: "角度数量" },
    outputSchema: { angles: "角度列表", comparison: "对比矩阵", recommendation: "组合建议" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_strategist"],
  },

  // Production (4)
  {
    slug: "video_edit_plan", name: "视频剪辑方案", category: "production", version: "2.8",
    description: "生成视频剪辑计划和分镜脚本",
    content: "# 视频剪辑方案\n\n你是视频制片专家，擅长将文字内容转化为可执行的视频剪辑方案。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| script | string | 是 | 视频脚本或文字内容 |\n| duration | string | 否 | 目标时长 |\n| platform | string | 否 | 发布平台：douyin/bilibili/youtube/wechat |\n| availableAssets | string[] | 否 | 可用素材列表 |\n\n## 执行流程\n1. **内容分段**：将脚本按信息点拆分为独立片段\n2. **分镜设计**：为每个片段设计画面构图、运镜方式、景别\n3. **素材调度**：标注每个片段所需素材类型（实拍/图片/动画/字幕/屏录）\n4. **节奏编排**：设计剪辑节奏(快切/慢剪/跳切)，每15-30秒设置节奏点\n5. **时间码标注**：精确到秒标注每个片段的起止时间\n6. **技术标注**：转场方式、字幕样式、特效需求\n\n## 输出规格\n```markdown\n## 视频剪辑方案\n**目标时长**: {duration} | **平台**: {platform} | **片段数**: {N}\n\n### 分镜脚本表\n| 镜号 | 时间码 | 景别 | 画面描述 | 旁白/字幕 | 素材类型 | 时长 | 转场 |\n|------|--------|------|----------|-----------|----------|------|------|\n\n### 素材需求清单\n| 序号 | 素材描述 | 类型 | 规格要求 | 对应镜号 | 状态 |\n\n### 配乐音效方案\n| 段落 | 时间段 | 音乐风格 | 音效 | 音量 |\n\n### 字幕与动效\n| 时间点 | 字幕内容 | 样式 | 动效 |\n\n### 制作注意事项\n- {关键提示}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 可执行性 | 方案可直接交付剪辑 | 30% |\n| 节奏感 | 剪辑节奏流畅 | 25% |\n| 时长精确 | 总时长误差±5秒 | 25% |\n| 完整性 | 素材清单无遗漏 | 20% |",
    inputSchema: { script: "视频脚本", duration: "目标时长", platform: "发布平台", availableAssets: "可用素材" },
    outputSchema: { storyboard: "分镜表", materialList: "素材清单", musicPlan: "配乐方案" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 10000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["video_producer"],
  },
  {
    slug: "thumbnail_generate", name: "封面生成", category: "production", version: "1.6",
    description: "根据内容自动生成封面设计方案",
    content: "# 封面生成\n\n你是视觉设计专家，擅长为内容设计高点击率的封面方案。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| title | string | 是 | 内容标题 |\n| content | string | 否 | 内容摘要 |\n| platform | string | 否 | 平台：wechat/douyin/bilibili/xiaohongshu |\n| brandColor | string | 否 | 品牌主色 |\n\n## 执行流程\n1. **主题分析**：提取内容核心主题和情绪基调\n2. **构图设计**：选择最佳构图方式(居中/三分法/对角线/满铺)\n3. **文字排版**：设计标题在封面上的位置、字体大小、文字区域≤1/3\n4. **配色方案**：基于内容主题和品牌色生成配色建议\n5. **多尺寸适配**：输出横版(16:9)、竖版(9:16)、正方形(1:1)三种方案\n\n## 输出规格\n```markdown\n## 封面设计方案：{title}\n\n### 方案A（推荐）\n- **构图**: {构图方式描述}\n- **视觉焦点**: {焦点元素}\n- **标题位置**: {位置描述} | **字号**: {推荐字号}\n- **配色**: 主色{#hex} + 辅色{#hex} + 文字色{#hex}\n- **情绪基调**: {如：科技感/温暖/紧迫/专业}\n\n### 方案B\n...\n\n### 尺寸适配\n| 平台 | 尺寸 | 调整说明 |\n|------|------|----------|\n| 微信封面 | 900×383 | {调整要点} |\n| 抖音封面 | 1080×1920 | {调整要点} |\n| 正方形 | 1080×1080 | {调整要点} |\n\n### 设计规范\n- 文字区域占比：≤1/3\n- 主体留白：≥20%\n- 安全区域：四周留{X}px\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 吸引力 | 有点击欲望 | 30% |\n| 信息传达 | 标题清晰可读 | 25% |\n| 品牌一致 | 匹配品牌视觉 | 20% |\n| 多尺寸适配 | 三种比例都可用 | 25% |",
    inputSchema: { title: "内容标题", content: "内容摘要", platform: "目标平台", brandColor: "品牌色" },
    outputSchema: { designs: "设计方案列表", sizeAdaptation: "尺寸适配方案" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 6000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["video_producer", "content_creator"],
  },
  {
    slug: "layout_design", name: "排版设计", category: "production", version: "1.5",
    description: "自动排版和版式设计建议",
    content: "# 排版设计\n\n你是排版设计专家，擅长为不同类型的内容提供专业的版式设计方案。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| content | string | 是 | 待排版内容 |\n| contentType | string | 否 | 内容类型：article/report/newsletter/social |\n| platform | string | 否 | 发布平台 |\n| imageCount | number | 否 | 配图数量 |\n\n## 执行流程\n1. **内容分析**：分析内容长度、结构层级、图文比例\n2. **版式推荐**：根据内容类型推荐最佳排版模板(单栏/双栏/卡片式/杂志式)\n3. **图文混排**：规划图片插入位置(段间/浮动/全幅)和尺寸比例\n4. **样式定义**：定义标题层级、字号、行高、段间距、强调样式\n5. **跨平台适配**：提供微信长图文、网页、PDF等不同版式规范\n\n## 输出规格\n```markdown\n## 排版设计方案\n**内容类型**: {type} | **总字数**: {X}字 | **配图**: {N}张\n\n### 版式方案\n- **布局**: {单栏/双栏/混合}\n- **页宽**: {建议宽度}\n- **边距**: {上/右/下/左}\n\n### 字体与层级\n| 元素 | 字号 | 字重 | 颜色 | 行高 | 间距 |\n|------|------|------|------|------|------|\n| H1标题 | 24px | Bold | #1a1a1a | 1.4 | 下32px |\n| H2小标题 | 18px | Semi | #333 | 1.4 | 上24下16px |\n| 正文 | 16px | Regular | #333 | 1.8 | 段间16px |\n| 引用 | 15px | Regular | #666 | 1.6 | 左线+内缩 |\n\n### 图片排版规则\n| 位置 | 插入方式 | 尺寸 | 说明 |\n\n### 特殊元素\n- 数据卡片：{样式描述}\n- 引用块：{样式描述}\n- 分割线：{样式描述}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 可读性 | 阅读舒适不费眼 | 35% |\n| 美观度 | 视觉协调有层次 | 25% |\n| 一致性 | 风格前后统一 | 20% |\n| 适配性 | 跨平台可用 | 20% |",
    inputSchema: { content: "待排版内容", contentType: "内容类型", platform: "平台", imageCount: "配图数" },
    outputSchema: { layout: "版式方案", typography: "字体层级", imageRules: "图片规则" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 6000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["video_producer", "content_creator"],
  },
  {
    slug: "audio_plan", name: "音频方案", category: "production", version: "1.3",
    description: "配音配乐方案和语音合成计划",
    content: "# 音频方案\n\n你是音频制作专家，擅长为视频和音频内容设计配音配乐方案。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| script | string | 是 | 旁白脚本或视频脚本 |\n| duration | string | 否 | 总时长 |\n| mood | string | 否 | 整体情绪：serious/upbeat/calm/dramatic |\n| voiceType | string | 否 | 配音类型：male/female/young/mature |\n\n## 执行流程\n1. **脚本分析**：分析旁白段落的情感节奏和语速要求\n2. **配音规划**：为每段旁白标注语速(字/分钟)、语调(升/降/平)、情感要求\n3. **配乐设计**：根据内容情绪曲线设计背景音乐的风格、节奏和强度变化\n4. **音效标注**：标注转场音效、环境音、强调音效的精确使用位置\n5. **时间轴编排**：生成完整的音频时间轴，标注配音/配乐/音效的混音比例\n\n## 输出规格\n```markdown\n## 音频制作方案\n**总时长**: {duration} | **配音类型**: {voiceType} | **情绪基调**: {mood}\n\n### 配音脚本\n| 段落 | 时间码 | 旁白内容 | 语速 | 语调 | 情感 | 时长 |\n|------|--------|----------|------|------|------|------|\n| 1 | 00:00 | {旁白} | 180字/min | 平稳→上升 | 客观 | 15s |\n\n### 配乐方案\n| 段落 | 时间段 | 音乐风格 | BPM | 情绪 | 音量 | 参考曲风 |\n|------|--------|----------|-----|------|------|----------|\n\n### 音效设计\n| 时间点 | 音效类型 | 描述 | 音量 |\n|--------|----------|------|------|\n\n### 混音参考\n- 配音:配乐:音效 = {X}:{Y}:{Z}\n- 配音优先区间：{全程/重点段落}\n- 淡入淡出点：{标注}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 节奏匹配 | 语速与内容节奏匹配 | 30% |\n| 情绪一致 | 配乐情绪与内容匹配 | 25% |\n| 时间精确 | 时间码标注准确 | 25% |\n| 可执行性 | 方案可直接交付制作 | 20% |",
    inputSchema: { script: "旁白脚本", duration: "总时长", mood: "情绪基调", voiceType: "配音类型" },
    outputSchema: { voicePlan: "配音脚本", musicPlan: "配乐方案", sfxPlan: "音效设计", mixGuide: "混音参考" },
    runtimeConfig: { type: "llm_generation", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["video_producer"],
  },

  // Management (4)
  {
    slug: "quality_review", name: "质量审核", category: "management", version: "3.5",
    description: "对内容进行全面质量审核评分",
    content: "# 质量审核\n\n你是资深内容质量审核专家，用四维评分体系对内容进行全面审核，确保发布内容的专业水准。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| content | string | 是 | 待审核内容 |\n| contentType | string | 否 | 类型：article/video_script/social_post |\n| standards | string | 否 | 审核标准：standard/strict/relaxed |\n\n## 执行流程\n1. **通读全文**：完整阅读内容，把握整体质量水平\n2. **四维评分**：\n   - 准确性(30%)：事实、数据、引用是否准确\n   - 可读性(25%)：逻辑通顺、表达流畅、无语病\n   - 原创度(25%)：非简单搬运、有独特视角和分析\n   - 新闻价值(20%)：信息量、时效性、受众价值\n3. **逐项标注**：对每一处问题精确标注位置并给出修改建议\n4. **等级评定**：A(≥85)/B(70-84)/C(60-69)/D(<60)，C级以下打回修改\n5. **审核清单确认**：逐项检查必查项目\n\n## 输出规格\n```markdown\n## 质量审核报告\n\n### 综合评定：{A/B/C/D}级 | 总分：{X}/100\n**审核结论**: {通过/修改后通过/打回修改}\n\n### 四维评分\n| 维度 | 得分 | 权重 | 加权分 | 说明 |\n|------|------|------|--------|------|\n| 准确性 | {X}/100 | 30% | {Y} | {一句话说明} |\n| 可读性 | {X}/100 | 25% | {Y} | |\n| 原创度 | {X}/100 | 25% | {Y} | |\n| 新闻价值 | {X}/100 | 20% | {Y} | |\n\n### 问题标注\n| 序号 | 位置 | 问题类型 | 原文 | 问题说明 | 修改建议 | 严重度 |\n|------|------|----------|------|----------|----------|--------|\n\n### 审核清单\n- [✅/❌] 事实准确性验证\n- [✅/❌] 语法和错别字检查\n- [✅/❌] 标题与内容匹配\n- [✅/❌] 原创度≥85%\n- [✅/❌] 敏感内容过滤\n- [✅/❌] 数据来源标注\n\n### 优化建议\n1. {具体可操作的改进建议}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 评分客观 | 评分有具体依据 | 30% |\n| 问题定位 | 问题位置准确 | 25% |\n| 建议可行 | 修改建议具体可操作 | 25% |\n| 覆盖完整 | 审核清单逐项检查 | 20% |",
    inputSchema: { content: "待审核内容", contentType: "内容类型", standards: "审核标准" },
    outputSchema: { grade: "等级A/B/C/D", totalScore: "总分", dimensions: "四维评分", issues: "问题列表", verdict: "审核结论" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 10000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["quality_reviewer"],
  },
  {
    slug: "compliance_check", name: "合规检查", category: "management", version: "4.0",
    description: "检测政治、法律、伦理敏感内容",
    content: "# 合规检查\n\n你是内容合规审查专家，负责检测内容中的敏感信息并确保符合法律法规要求。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| content | string | 是 | 待检查内容 |\n| checkLevel | string | 否 | 检查级别：basic/standard/strict |\n| publishRegion | string | 否 | 发布地区，默认中国大陆 |\n\n## 执行流程\n1. **敏感词扫描**：对内容进行关键词级别的敏感词检测\n2. **语义合规分析**：分析上下文语义，检测隐晦的敏感表达\n3. **法规对照**：按以下法规逐项检查\n   - 《互联网新闻信息服务管理规定》\n   - 《网络信息内容生态治理规定》\n   - 《广告法》相关条款\n   - 《未成年人保护法》相关条款\n4. **风险分级**：将问题按严重度分为红(禁止发布)/黄(需修改)/蓝(建议优化)\n5. **修改建议**：为每个问题提供具体的合规修改方案\n\n## 输出规格\n```markdown\n## 合规检查报告\n**检查级别**: {level} | **发布地区**: {region}\n**合规结论**: {通过/需修改/禁止发布}\n\n### 检查概览\n| 类别 | 检查项 | 结果 | 问题数 |\n|------|--------|------|--------|\n| 政治敏感 | 涉政内容检测 | ✅/⚠️/❌ | {N} |\n| 法律合规 | 法规条款对照 | ✅/⚠️/❌ | {N} |\n| 未成年保护 | 青少年内容安全 | ✅/⚠️/❌ | {N} |\n| 虚假信息 | 误导性表述检测 | ✅/⚠️/❌ | {N} |\n| 版权风险 | 知识产权检查 | ✅/⚠️/❌ | {N} |\n| 隐私保护 | 个人信息泄露 | ✅/⚠️/❌ | {N} |\n\n### 问题详情\n#### 🔴 高风险（必须修改）\n| 位置 | 原文 | 问题 | 依据法规 | 修改建议 |\n\n#### 🟡 中风险（建议修改）\n...\n\n#### 🔵 低风险（可选优化）\n...\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 检测覆盖 | 六大类全覆盖 | 30% |\n| 判断准确 | 误报率<5% | 30% |\n| 法规引用 | 引用具体法规条款 | 20% |\n| 修改可行 | 建议具体可操作 | 20% |",
    inputSchema: { content: "待检查内容", checkLevel: "检查级别", publishRegion: "发布地区" },
    outputSchema: { verdict: "合规结论", categories: "各类别检查结果", issues: "问题详情列表" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["quality_reviewer"],
  },
  {
    slug: "task_planning", name: "任务规划", category: "management", version: "2.0",
    description: "将复杂任务拆解为可执行步骤",
    content: "# 任务规划\n\n你是项目管理专家，擅长将复杂任务拆解为可执行的子任务并合理分配资源。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| goal | string | 是 | 任务目标描述 |\n| constraints | string | 否 | 约束条件（时间/资源/质量） |\n| availableEmployees | string[] | 否 | 可用AI员工列表 |\n| priority | string | 否 | 优先级：P0/P1/P2 |\n\n## 执行流程\n1. **目标分析**：解析任务目标，识别核心交付物和质量要求\n2. **任务拆解**：将目标拆解为原子级子任务(每个子任务单一职责、可独立验收)\n3. **依赖分析**：识别子任务间的依赖关系(前置/并行/后置)\n4. **资源分配**：根据任务特点匹配最适合的AI员工和技能组合\n5. **时间预估**：为每个子任务预估执行时间\n6. **质量门禁**：设置关键节点的质量检查和审批要求\n\n## 输出规格\n```markdown\n## 任务规划方案\n**目标**: {goal} | **优先级**: {priority} | **预估总时长**: {X}\n\n### 任务分解\n| 序号 | 子任务 | 负责人 | 前置任务 | 预估时长 | 质量要求 |\n|------|--------|--------|----------|----------|----------|\n| 1 | {任务} | {员工} | - | {时长} | {要求} |\n| 2 | {任务} | {员工} | #1 | {时长} | {要求} |\n\n### 依赖关系图\n```\n{任务1} → {任务2} → {任务4}\n            ↘ {任务3} ↗\n```\n\n### 里程碑与质量门禁\n| 里程碑 | 触发条件 | 质量标准 | 审批要求 |\n\n### 风险评估\n| 风险 | 概率 | 影响 | 应对措施 |\n\n### 执行时间线\n{甘特图或时间线描述}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 拆解合理 | 任务粒度适中 | 30% |\n| 依赖准确 | 依赖关系无遗漏 | 25% |\n| 分配合理 | 人员能力匹配 | 25% |\n| 可执行性 | 计划可直接执行 | 20% |",
    inputSchema: { goal: "任务目标", constraints: "约束条件", availableEmployees: "可用员工", priority: "优先级" },
    outputSchema: { tasks: "子任务列表", dependencies: "依赖关系", milestones: "里程碑", timeline: "时间线" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["content_strategist"],
  },
  {
    slug: "publish_strategy", name: "发布策略", category: "management", version: "3.0",
    description: "制定多渠道发布时间和策略",
    content: "# 发布策略\n\n你是全渠道发布策略专家，擅长制定多平台内容分发的最佳时间、格式和运营方案。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| content | string | 是 | 待发布内容摘要 |\n| channels | string[] | 否 | 目标渠道列表 |\n| contentType | string | 否 | 内容类型：breaking/deep/social/video |\n| schedulePeriod | string | 否 | 规划周期：single/weekly/monthly |\n\n## 执行流程\n1. **内容适配分析**：分析内容特点，判断适合哪些渠道\n2. **最佳时间计算**：基于各平台受众活跃数据推荐最佳发布时间窗口\n3. **格式适配**：为每个渠道调整内容格式(标题长度/正文长度/配图要求/标签)\n4. **节奏编排**：规划多渠道的发布顺序和时间间隔\n5. **互动运营**：制定发布后的评论互动和引流方案\n\n## 输出规格\n```markdown\n## 发布策略方案\n**内容类型**: {type} | **目标渠道**: {N}个 | **规划周期**: {period}\n\n### 发布时间表\n| 渠道 | 发布时间 | 优先级 | 格式要求 | 预期效果 |\n|------|----------|--------|----------|----------|\n| 微信公众号 | {时间} | P0 | {要求} | {预期} |\n| 微博 | {时间} | P1 | {要求} | {预期} |\n\n### 各渠道适配方案\n#### 微信公众号\n- 标题：{适配标题}（≤22字）\n- 摘要：{适配摘要}（≤120字）\n- 配图：{要求}\n- 标签：{推荐标签}\n\n#### 微博\n...\n\n### 发布节奏\n{时间线描述，各渠道的发布顺序和间隔}\n\n### 互动运营计划\n- 发布后30分钟：{回复策略}\n- 发布后2小时：{互动策略}\n- 次日跟进：{二次传播策略}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 时间精准 | 发布时间在最佳窗口 | 30% |\n| 格式适配 | 各平台格式正确 | 25% |\n| 节奏合理 | 发布顺序有策略 | 25% |\n| 运营完整 | 互动方案可执行 | 20% |",
    inputSchema: { content: "内容摘要", channels: "目标渠道", contentType: "内容类型", schedulePeriod: "规划周期" },
    outputSchema: { schedule: "发布时间表", adaptations: "渠道适配方案", rhythm: "发布节奏", operations: "互动运营" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["channel_operator"],
  },

  // Knowledge (4)
  {
    slug: "knowledge_retrieval", name: "知识检索", category: "knowledge", version: "2.0",
    description: "从知识库中检索相关知识片段",
    content: "# 知识检索\n\n你是知识管理专家，擅长从组织知识库中精准检索相关信息并提供上下文关联。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| query | string | 是 | 检索查询 |\n| kbTypes | string[] | 否 | 知识库类型：general/channel_style/sensitive_topics/domain |\n| topK | number | 否 | 返回条数，默认5 |\n\n## 执行流程\n1. **查询理解**：解析检索意图，提取关键概念和约束条件\n2. **多库联检**：在组织内所有匹配的知识库中并行检索\n3. **语义排序**：基于语义相似度而非关键词匹配排序结果\n4. **上下文补充**：为每条结果补充前后文和出处信息\n5. **结果聚合**：合并去重，按相关度排序输出\n\n## 输出规格\n```markdown\n## 知识检索结果：{query}\n**检索范围**: {N}个知识库 | **匹配条目**: {M}条\n\n### 检索结果\n#### 1. {知识片段标题}\n- **来源**: {知识库名} > {文档名}\n- **相关度**: ★★★★★\n- **内容摘要**:\n  > {知识片段内容}\n- **关联知识**: {相关条目链接}\n\n### 知识图谱\n- 核心概念：{列表}\n- 关联主题：{列表}\n- 推荐延伸阅读：{列表}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 相关度 | 结果与查询高度相关 | 35% |\n| 完整性 | 不遗漏重要知识点 | 25% |\n| 出处标注 | 每条有明确出处 | 20% |\n| 上下文 | 提供足够理解上下文 | 20% |",
    inputSchema: { query: "检索查询", kbTypes: "知识库类型", topK: "返回条数" },
    outputSchema: { results: "检索结果列表", knowledgeGraph: "知识图谱", totalMatches: "匹配总数" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 5000, maxConcurrency: 5, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["asset_manager", "content_creator"],
  },
  {
    slug: "media_search", name: "媒资检索", category: "knowledge", version: "3.0",
    description: "从媒资库中检索素材（图片、视频、音频）",
    content: "# 媒资检索\n\n你是数字资产管理专家，擅长从媒资库中精准检索多媒体素材并提供版权信息。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| query | string | 是 | 检索描述 |\n| mediaType | string | 否 | 素材类型：image/video/audio/document/all |\n| tags | string[] | 否 | 筛选标签 |\n| dateRange | string | 否 | 时间范围 |\n\n## 执行流程\n1. **查询解析**：将自然语言描述转化为结构化检索条件(类型/标签/时间/关键词)\n2. **多模态匹配**：支持文字描述搜图、搜视频、搜音频\n3. **标签筛选**：基于AI自动标注的标签体系进行精确过滤\n4. **版权核查**：为每条素材附带版权状态(自有/授权/公域/需授权)\n5. **结果排序**：按相关度和新鲜度综合排序\n\n## 输出规格\n```markdown\n## 媒资检索结果：{query}\n**素材类型**: {type} | **匹配数**: {N}条\n\n### 检索结果\n| 序号 | 标题 | 类型 | 时长/尺寸 | 来源 | 标签 | 版权状态 | 相关度 |\n|------|------|------|-----------|------|------|----------|--------|\n\n### 素材详情\n#### 1. {素材标题}\n- **类型**: {video/image/audio/document}\n- **规格**: {分辨率/时长/大小}\n- **来源**: {来源名称}\n- **版权**: {版权状态及授权信息}\n- **标签**: {标签列表}\n- **使用建议**: {如何在当前项目中使用}\n\n### 素材使用提醒\n- {版权注意事项}\n- {使用限制}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 匹配精准 | 素材与描述高度匹配 | 30% |\n| 版权清晰 | 版权状态明确标注 | 30% |\n| 信息完整 | 规格参数完整 | 20% |\n| 使用建议 | 有实用的使用指导 | 20% |",
    inputSchema: { query: "检索描述", mediaType: "素材类型", tags: "筛选标签", dateRange: "时间范围" },
    outputSchema: { results: "素材列表", totalCount: "匹配总数" },
    runtimeConfig: { type: "api_call", avgLatencyMs: 3000, maxConcurrency: 5 },
    compatibleRoles: ["asset_manager", "video_producer"],
  },
  {
    slug: "case_reference", name: "案例参考", category: "knowledge", version: "1.5",
    description: "检索历史爆款案例作为创作参考",
    content: "# 案例参考\n\n你是内容运营分析专家，擅长从历史内容中识别爆款案例并分析其成功要素。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| topic | string | 是 | 当前创作主题 |\n| contentType | string | 否 | 内容类型筛选 |\n| minPerformance | string | 否 | 最低表现标准：10w+/50w+/100w+ |\n| count | number | 否 | 返回案例数，默认5 |\n\n## 执行流程\n1. **主题匹配**：基于当前创作主题检索相关历史内容\n2. **爆款筛选**：按阅读量/播放量/互动率筛选表现优秀的案例(默认取TOP表现)\n3. **成功归因**：分析每个爆款的成功要素\n   - 选题角度：切入点是否独特\n   - 标题策略：使用了什么标题技巧\n   - 发布时机：是否踩中热点窗口\n   - 内容结构：叙事方式和信息组织\n   - 互动设计：是否有效引导互动\n4. **相似度评估**：评估每个案例与当前主题的可借鉴程度\n5. **借鉴建议**：提取可复用的方法论\n\n## 输出规格\n```markdown\n## 案例参考报告：{topic}\n**匹配案例**: {N}个 | **筛选标准**: {minPerformance}\n\n### 推荐案例\n#### 案例1：{标题} ⭐\n- **发布日期**: {日期} | **渠道**: {平台}\n- **表现数据**: 阅读{X}万 | 互动率{Y}% | 转发{Z}\n- **成功要素**:\n  - 选题：{分析}\n  - 标题：{分析}\n  - 时机：{分析}\n  - 结构：{分析}\n- **可借鉴点**: {具体可复用的方法}\n- **与当前主题相似度**: {高/中/低}\n\n### 方法论提炼\n| 成功要素 | 出现频率 | 可复用建议 |\n|----------|----------|------------|\n\n### 创作建议\n基于以上案例分析，建议当前创作：\n1. {具体建议}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 案例相关性 | 与当前主题高度相关 | 30% |\n| 归因准确 | 成功分析有理有据 | 30% |\n| 借鉴实用 | 建议可直接采用 | 25% |\n| 数据支撑 | 表现数据真实 | 15% |",
    inputSchema: { topic: "创作主题", contentType: "内容类型", minPerformance: "最低表现", count: "案例数" },
    outputSchema: { cases: "案例列表", methodology: "方法论提炼", suggestions: "创作建议" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 8000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["asset_manager", "content_strategist"],
  },
  {
    slug: "data_report", name: "数据报告", category: "knowledge", version: "2.6",
    description: "生成数据分析报告，汇总传播数据",
    content: "# 数据报告\n\n你是数据分析专家，擅长汇总多渠道传播数据并生成结构化分析报告。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| reportType | string | 是 | 报告类型：daily/weekly/monthly/content_specific |\n| dateRange | string | 否 | 数据范围 |\n| channels | string[] | 否 | 数据渠道 |\n| focus | string | 否 | 重点关注指标 |\n\n## 执行流程\n1. **数据采集**：从各渠道采集传播数据(PV/UV/互动/转化等)\n2. **数据清洗**：去除异常值，统一数据口径\n3. **指标汇总**：计算核心KPI和同比/环比变化\n4. **趋势分析**：识别增长/下滑趋势及拐点\n5. **归因分析**：分析数据变化的主要驱动因素\n6. **可视化建议**：推荐适合的图表类型展示数据\n7. **优化建议**：基于数据洞察提出下期优化方向\n\n## 输出规格\n```markdown\n## 数据分析报告\n**报告类型**: {type} | **数据周期**: {dateRange} | **覆盖渠道**: {N}个\n\n### 核心指标概览\n| 指标 | 本期 | 上期 | 环比 | 趋势 |\n|------|------|------|------|------|\n| 总阅读量 | {X}万 | {Y}万 | {+/-Z}% | 📈/📉 |\n| 平均互动率 | {X}% | {Y}% | {+/-Z}% | |\n| 爆款率 | {X}% | {Y}% | {+/-Z}% | |\n| 粉丝增长 | {X} | {Y} | {+/-Z}% | |\n\n### 内容表现排行\n| 排名 | 标题 | 渠道 | 阅读量 | 互动率 | 评分 |\n\n### 渠道效果对比\n| 渠道 | 发布量 | 总阅读 | 互动率 | ROI评估 |\n\n### 受众变化追踪\n- 新增用户画像变化：{描述}\n- 活跃时段变化：{描述}\n\n### 趋势分析\n- **增长驱动**: {分析}\n- **下滑因素**: {分析}\n\n### 下期优化建议\n1. 内容策略：{建议}\n2. 渠道策略：{建议}\n3. 发布策略：{建议}\n\n### 推荐可视化\n| 数据 | 图表类型 | 说明 |\n|------|----------|------|\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 数据准确 | 指标计算无误 | 30% |\n| 分析深度 | 不停留在表面数字 | 30% |\n| 建议实用 | 优化建议可执行 | 25% |\n| 格式规范 | 报告结构清晰 | 15% |",
    inputSchema: { reportType: "报告类型", dateRange: "数据范围", channels: "数据渠道", focus: "关注指标" },
    outputSchema: { kpiOverview: "核心指标", contentRanking: "内容排行", channelComparison: "渠道对比", recommendations: "优化建议" },
    runtimeConfig: { type: "llm_analysis", avgLatencyMs: 10000, maxConcurrency: 3, modelDependency: "zhipu:glm-4-plus" },
    compatibleRoles: ["data_analyst"],
  },
];

// ---------------------------------------------------------------------------
// Employee Core Skills Mapping
// Core skills are auto-bound and cannot be unbound.
// ---------------------------------------------------------------------------

// Auto Scenario Templates (M4.F135)
export const AUTO_SCENARIO_TEMPLATES: Record<
  string,
  {
    name: string;
    description: string;
    steps: string[];
    approvalRequired: boolean;
    cron?: string;
  }
> = {
  breaking_news_auto: {
    name: "快讯自动推送",
    description: "热点触发→快速成稿→自动审核→即时发布",
    steps: ["monitor", "create", "review", "publish"],
    approvalRequired: false,
  },
  event_express: {
    name: "赛事速报",
    description: "赛事监控→自动裁剪→快速发布",
    steps: ["monitor", "create", "produce", "publish"],
    approvalRequired: false,
  },
  daily_briefing: {
    name: "每日新闻简报",
    description: "每日6点自动生产新闻简报",
    steps: ["monitor", "plan", "create", "review", "publish"],
    approvalRequired: true,
    cron: "0 6 * * *",
  },
  weekly_deep_report: {
    name: "周度深度报道",
    description: "每周一自动启动深度报道流程",
    steps: [
      "monitor",
      "plan",
      "material",
      "create",
      "produce",
      "review",
      "publish",
      "analyze",
    ],
    approvalRequired: true,
    cron: "0 9 * * 1",
  },
};

// ---------------------------------------------------------------------------
// Team Builder Scenarios (static UI config)
// ---------------------------------------------------------------------------

export interface TeamScenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  recommended: readonly EmployeeId[];
}

export const TEAM_SCENARIOS: TeamScenario[] = [
  {
    id: "breaking_news",
    name: "新闻快讯",
    description: "快速响应突发新闻，15分钟内出稿",
    icon: "Zap",
    recommended: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen", "xiaofa"],
  },
  {
    id: "deep_report",
    name: "深度报道",
    description: "深度分析+数据调研，高质量长文",
    icon: "BookOpen",
    recommended: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaoshu"],
  },
  {
    id: "social_media",
    name: "新媒体运营",
    description: "全渠道内容生产+分发+数据闭环",
    icon: "Share2",
    recommended: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaojian", "xiaoshen", "xiaofa", "xiaoshu"],
  },
  {
    id: "custom",
    name: "自定义团队",
    description: "按需自由组合AI员工团队",
    icon: "Settings",
    recommended: [],
  },
];

export const EMPLOYEE_CORE_SKILLS: Record<string, string[]> = {
  xiaolei: ["web_search", "web_deep_read", "trending_topics", "trend_monitor", "social_listening", "heat_scoring"],
  xiaoce: ["web_search", "web_deep_read", "trending_topics", "topic_extraction", "angle_design", "audience_analysis", "task_planning"],
  xiaozi: ["media_search", "knowledge_retrieval", "news_aggregation", "case_reference"],
  xiaowen: ["content_generate", "headline_generate", "summary_generate", "style_rewrite", "script_generate"],
  xiaojian: ["video_edit_plan", "thumbnail_generate", "layout_design", "audio_plan"],
  xiaoshen: ["quality_review", "compliance_check", "fact_check", "sentiment_analysis"],
  xiaofa: ["publish_strategy", "style_rewrite", "translation", "audience_analysis"],
  xiaoshu: ["data_report", "competitor_analysis", "audience_analysis", "heat_scoring"],
};

// Read-only tool names for advisor authority level
export const READ_ONLY_TOOL_NAMES = [
  "web_search", "web_deep_read", "trending_topics",
  "trend_monitor", "social_listening", "news_aggregation",
  "knowledge_retrieval", "media_search", "case_reference", "data_report",
  "sentiment_analysis", "topic_extraction", "competitor_analysis",
  "audience_analysis", "fact_check", "heat_scoring",
] as const;

// Tool descriptions for UI display
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  web_search: "搜索互联网获取实时信息",
  web_deep_read: "抓取网页正文进行深度分析",
  trending_topics: "聚合多平台实时热榜",
  trend_monitor: "监控热点趋势和话题变化",
  social_listening: "社交媒体舆情监控",
  news_aggregation: "聚合多源新闻资讯",
  knowledge_retrieval: "检索知识库内容",
  media_search: "搜索媒资库素材",
  case_reference: "查询案例库参考",
  data_report: "生成数据分析报告",
  sentiment_analysis: "情感分析",
  topic_extraction: "话题提取和分析",
  competitor_analysis: "竞品分析",
  audience_analysis: "受众分析",
  fact_check: "事实核查",
  heat_scoring: "热度评分计算",
  content_generate: "生成内容文案",
  headline_generate: "生成标题",
  summary_generate: "生成摘要",
  style_rewrite: "风格改写",
  script_generate: "生成脚本",
  video_edit_plan: "视频剪辑方案",
  thumbnail_generate: "缩略图方案",
  layout_design: "排版设计方案",
  audio_plan: "音频配置方案",
  quality_review: "质量审核",
  compliance_check: "合规性检查",
  publish_strategy: "发布策略制定",
  translation: "内容翻译",
  task_planning: "任务规划",
  angle_design: "选题角度设计",
};

// ---------------------------------------------------------------------------
// Mission Scenario Templates
// ---------------------------------------------------------------------------

export const SCENARIO_CATEGORIES = [
  { key: "news", label: "新闻快讯", icon: Newspaper },
  { key: "deep", label: "深度内容", icon: BookOpen },
  { key: "social", label: "社交传播", icon: Share2 },
  { key: "custom", label: "自定义", icon: Wand2 },
] as const;

export interface ScenarioConfig {
  label: string;
  category: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  description: string;
  defaultPriority: number; // 0=紧急 1=重要 2=常规 3=低优
  defaultTeam: EmployeeId[];
  templateInstruction: string;
}

export const SCENARIO_CONFIG: Record<string, ScenarioConfig> = {
  breaking_news: {
    label: "突发新闻",
    category: "news",
    icon: Zap,
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
    description: "紧急事件快速追踪、写作、审核、发布",
    defaultPriority: 0,
    defaultTeam: ["xiaolei", "xiaowen", "xiaoshen", "xiaofa"],
    templateInstruction: "紧急追踪以下事件，完成快讯撰写、审核与发布：\n\n",
  },
  flash_report: {
    label: "快讯速报",
    category: "news",
    icon: Clock,
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
    description: "单篇快讯，极速产出",
    defaultPriority: 0,
    defaultTeam: ["xiaolei", "xiaowen"],
    templateInstruction: "快速产出一篇关于以下事件的速报：\n\n",
  },
  press_conference: {
    label: "发布会追踪",
    category: "news",
    icon: Mic,
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.12)",
    description: "发布会要点提取、解读与报道",
    defaultPriority: 1,
    defaultTeam: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen"],
    templateInstruction: "追踪以下发布会，提取核心要点并撰写深度解读：\n\n",
  },
  deep_report: {
    label: "深度报道",
    category: "deep",
    icon: FileSearch,
    color: "#6366f1",
    bgColor: "rgba(99,102,241,0.12)",
    description: "多维度深度调查与长文报道",
    defaultPriority: 1,
    defaultTeam: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaofa"],
    templateInstruction: "围绕以下主题进行深度报道，包含背景调查、多方观点和数据分析：\n\n",
  },
  series_content: {
    label: "系列策划",
    category: "deep",
    icon: Layers,
    color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.12)",
    description: "多期系列内容策划与生产",
    defaultPriority: 2,
    defaultTeam: ["xiaoce", "xiaowen", "xiaozi", "xiaoshen", "xiaofa", "xiaoshu"],
    templateInstruction: "策划一组系列内容，围绕以下主题：\n\n",
  },
  data_journalism: {
    label: "数据新闻",
    category: "deep",
    icon: BarChart3,
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.12)",
    description: "数据驱动的可视化新闻报道",
    defaultPriority: 2,
    defaultTeam: ["xiaolei", "xiaoshu", "xiaowen", "xiaoshen"],
    templateInstruction: "基于数据分析，围绕以下主题产出数据新闻报道：\n\n",
  },
  social_media: {
    label: "社交媒体",
    category: "social",
    icon: Share2,
    color: "#14b8a6",
    bgColor: "rgba(20,184,166,0.12)",
    description: "社交平台内容创作与运营",
    defaultPriority: 2,
    defaultTeam: ["xiaoce", "xiaowen", "xiaofa", "xiaoshu"],
    templateInstruction: "为以下主题创作社交媒体内容，覆盖主流平台：\n\n",
  },
  video_content: {
    label: "视频内容",
    category: "social",
    icon: Film,
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
    description: "视频脚本、制作与分发",
    defaultPriority: 2,
    defaultTeam: ["xiaoce", "xiaowen", "xiaojian", "xiaoshen", "xiaofa"],
    templateInstruction: "围绕以下主题制作视频内容，包含脚本、拍摄方案和后期要求：\n\n",
  },
  multi_platform: {
    label: "全平台分发",
    category: "social",
    icon: Globe,
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.12)",
    description: "一次生产，全渠道适配分发",
    defaultPriority: 2,
    defaultTeam: ["xiaoce", "xiaowen", "xiaojian", "xiaofa", "xiaoshu"],
    templateInstruction: "为以下内容进行全平台适配和分发策略制定：\n\n",
  },
  custom: {
    label: "自定义任务",
    category: "custom",
    icon: Wand2,
    color: "#6b7280",
    bgColor: "rgba(107,114,128,0.12)",
    description: "完全自定义任务目标与团队",
    defaultPriority: 2,
    defaultTeam: [],
    templateInstruction: "",
  },
};
