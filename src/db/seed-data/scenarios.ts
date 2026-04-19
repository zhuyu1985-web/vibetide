// ---------------------------------------------------------------------------
// 27 default employee scenarios — 8 AI employees × 3~5 scenarios each
//
// Consumed by the main seed (src/db/seed.ts). Previously this data lived in
// scripts/seed-scenarios.ts as a separate seed path, but that created a
// maintenance trap: DB resets only ran the main seed and left the other 7
// employees with zero scenarios. Keeping the data here ensures a single
// `npm run db:seed` populates everything.
// ---------------------------------------------------------------------------

export type SeedScenario = {
  employeeSlug: string;
  name: string;
  description: string;
  icon: string;
  welcomeMessage?: string;
  systemInstruction: string;
  inputFields: {
    name: string;
    label: string;
    type: "text" | "textarea" | "select";
    required: boolean;
    placeholder?: string;
    options?: string[];
  }[];
  toolsHint: string[];
  sortOrder: number;
};

export const DEFAULT_SCENARIOS: SeedScenario[] = [
  // =========================================================================
  // 小雷 (xiaolei) — 热点猎手  (5 scenarios — original from seed.ts)
  // =========================================================================
  {
    employeeSlug: "xiaolei",
    name: "全网热点扫描",
    description: "扫描各平台热点话题，生成热点速报",
    icon: "Radar",
    welcomeMessage: "你好，我是小雷。接下来我会帮你扫描各平台的热点话题，你来选领域。",
    systemInstruction:
      "请对{{domain}}领域进行全网热点扫描，覆盖微博、百度、头条、抖音、知乎等主流平台。输出格式：按热度排序的 Top 10 热点列表，每个热点包含标题、热度值、来源平台、上升趋势、建议追踪角度。最后给出整体热点态势总结。",
    inputFields: [
      {
        name: "domain",
        label: "关注领域",
        type: "select" as const,
        required: true,
        placeholder: "选择领域",
        options: ["全部", "科技", "财经", "娱乐", "体育", "社会", "教育", "汽车", "健康"],
      },
    ],
    toolsHint: ["trending_topics", "web_search"],
    sortOrder: 1,
  },
  {
    employeeSlug: "xiaolei",
    name: "话题深度追踪",
    description: "深入分析特定话题的发展脉络",
    icon: "Search",
    welcomeMessage: "好的，我来深挖这个话题。告诉我关键词，我给你还原传播路径与舆论变化。",
    systemInstruction:
      "请对话题「{{topic}}」进行深度追踪分析。包含：1) 话题起源和发展时间线 2) 各平台传播路径 3) 关键节点和转折 4) 舆论情绪变化 5) 相关利益方观点汇总 6) 预测后续发展趋势 7) 建议的内容切入角度。",
    inputFields: [
      {
        name: "topic",
        label: "追踪话题",
        type: "text" as const,
        required: true,
        placeholder: "输入要追踪的话题关键词",
      },
    ],
    toolsHint: ["web_search", "web_deep_read", "trending_topics"],
    sortOrder: 2,
  },
  {
    employeeSlug: "xiaolei",
    name: "平台热榜查看",
    description: "查看指定平台的实时热榜",
    icon: "BarChart3",
    welcomeMessage: "我来取最新的热榜。先告诉我看哪个平台，我按 Top 20 给你拉回来。",
    systemInstruction:
      "请查看{{platform}}平台的实时热榜数据，列出当前 Top 20 热门话题，每个话题标注热度指数、上榜时长、趋势（上升/下降/平稳）。对排名前 5 的话题给出简要分析和内容制作建议。",
    inputFields: [
      {
        name: "platform",
        label: "目标平台",
        type: "select" as const,
        required: true,
        placeholder: "选择平台",
        options: ["微博", "百度", "头条", "抖音", "知乎", "B站", "微信"],
      },
    ],
    toolsHint: ["trending_topics"],
    sortOrder: 3,
  },
  {
    employeeSlug: "xiaolei",
    name: "热点分析报告",
    description: "生成深度热点分析报告",
    icon: "FileText",
    welcomeMessage: "稍等，我为你准备一份热点分析报告。你先定话题和报告深度。",
    systemInstruction:
      "请针对话题「{{topic}}」生成一份{{depth}}的热点分析报告。报告结构：1) 热点概述 2) 数据分析（热度趋势、平台分布、用户画像） 3) 舆情分析（正面/负面/中性占比、典型观点） 4) 竞品响应（主流媒体的报道角度） 5) 内容机会（建议的选题角度、体裁、发布时机） 6) 风险提示（敏感点、合规注意事项）",
    inputFields: [
      {
        name: "topic",
        label: "分析话题",
        type: "text" as const,
        required: true,
        placeholder: "输入要分析的话题",
      },
      {
        name: "depth",
        label: "报告深度",
        type: "select" as const,
        required: true,
        placeholder: "选择深度",
        options: ["快速摘要", "标准报告", "深度研报"],
      },
    ],
    toolsHint: ["trending_topics", "web_search", "web_deep_read"],
    sortOrder: 4,
  },
  {
    employeeSlug: "xiaolei",
    name: "关键词热度监测",
    description: "监测关键词在各平台的热度变化",
    icon: "Activity",
    welcomeMessage: "可以的，我来监测这个关键词的热度。你给我关键词和时间范围。",
    systemInstruction:
      "请监测关键词「{{keyword}}」在{{timeRange}}内的热度变化情况。输出：1) 各平台当前热度指数 2) 热度趋势变化曲线描述 3) 关联热词和话题 4) 主要讨论内容摘要 5) 情感倾向分析 6) 是否建议跟进及原因。",
    inputFields: [
      {
        name: "keyword",
        label: "监测关键词",
        type: "text" as const,
        required: true,
        placeholder: "输入关键词",
      },
      {
        name: "timeRange",
        label: "时间范围",
        type: "select" as const,
        required: true,
        placeholder: "选择时间范围",
        options: ["最近1小时", "最近24小时", "最近7天", "最近30天"],
      },
    ],
    toolsHint: ["web_search", "web_deep_read", "trending_topics"],
    sortOrder: 3,
  },

  // =========================================================================
  // 小策 (xiaoce) — 选题策划师  (3 scenarios)
  // =========================================================================
  {
    employeeSlug: "xiaoce",
    name: "选题策划",
    description: "围绕指定方向策划优质内容选题",
    icon: "Lightbulb",
    welcomeMessage: "我来帮你策划选题。告诉我方向和需要几个候选，我给出不同角度的方案。",
    systemInstruction:
      "请围绕「{{direction}}」方向，策划{{count}}个优质内容选题。要求：1. 每个选题包含标题、角度、目标受众 2. 分析选题的传播潜力和时效性 3. 给出差异化切入点 4. 标注推荐优先级",
    inputFields: [
      {
        name: "direction",
        label: "内容方向",
        type: "text" as const,
        required: true,
        placeholder: "如：AI教育、新能源汽车",
      },
      {
        name: "count",
        label: "选题数量",
        type: "select" as const,
        required: true,
        options: ["3个", "5个", "10个"],
      },
    ],
    toolsHint: ["web_search", "trending_topics"],
    sortOrder: 1,
  },
  {
    employeeSlug: "xiaoce",
    name: "受众分析",
    description: "分析目标受众的内容偏好和行为特征",
    icon: "Users",
    welcomeMessage: "我来帮你摸清目标受众。你描述受众画像和发布平台，我给出内容偏好建议。",
    systemInstruction:
      "请分析{{platform}}平台上{{target}}群体的内容偏好。要求：1. 画出受众画像（年龄、兴趣、消费习惯）2. 分析他们喜欢的内容类型和风格 3. 总结最佳发布时间和频率 4. 给出内容策略建议",
    inputFields: [
      {
        name: "target",
        label: "目标受众",
        type: "text" as const,
        required: true,
        placeholder: "如：25-35岁科技爱好者",
      },
      {
        name: "platform",
        label: "目标平台",
        type: "select" as const,
        required: true,
        options: ["微信公众号", "抖音", "小红书", "B站", "微博", "全平台"],
      },
    ],
    toolsHint: ["web_search", "web_deep_read"],
    sortOrder: 2,
  },
  {
    employeeSlug: "xiaoce",
    name: "内容日历规划",
    description: "为指定主题规划内容发布日历",
    icon: "CalendarDays",
    welcomeMessage: "我来做一份内容日历。你定主题方向和周期，我排好发布节奏。",
    systemInstruction:
      "请为「{{theme}}」主题规划{{period}}的内容发布日历。要求：1. 每天/每周安排具体选题 2. 标注内容类型（图文/视频/直播）3. 结合热点节点和行业事件 4. 给出内容矩阵分布建议",
    inputFields: [
      {
        name: "theme",
        label: "主题方向",
        type: "text" as const,
        required: true,
        placeholder: "如：AI技术科普",
      },
      {
        name: "period",
        label: "规划周期",
        type: "select" as const,
        required: true,
        options: ["一周", "两周", "一个月"],
      },
    ],
    toolsHint: ["web_search", "trending_topics"],
    sortOrder: 3,
  },

  // =========================================================================
  // 小资 (xiaozi) — 素材管家  (3 scenarios)
  // =========================================================================
  {
    employeeSlug: "xiaozi",
    name: "素材搜集",
    description: "围绕主题搜集互联网和媒资库素材",
    icon: "Package",
    welcomeMessage: "收到，我去收集素材。先告诉我话题和素材类型，图文/数据/案例都可以。",
    systemInstruction:
      "请围绕「{{topic}}」搜集{{type}}素材。要求：1. 搜索互联网最新相关素材 2. 检索媒资库已有素材 3. 按相关度和质量排序 4. 标注素材来源和使用建议",
    inputFields: [
      {
        name: "topic",
        label: "主题关键词",
        type: "text" as const,
        required: true,
        placeholder: "如：AI芯片、自动驾驶",
      },
      {
        name: "type",
        label: "素材类型",
        type: "select" as const,
        required: true,
        options: ["图文素材", "视频素材", "数据图表", "全部"],
      },
    ],
    toolsHint: ["media_search", "web_search"],
    sortOrder: 1,
  },
  {
    employeeSlug: "xiaozi",
    name: "案例参考",
    description: "搜索行业优秀案例并提炼方法论",
    icon: "BookOpen",
    welcomeMessage: "我来找对标案例。选行业和案例类型，我给你一批值得借鉴的参考。",
    systemInstruction:
      "请搜索{{industry}}领域的优秀{{type}}案例。要求：1. 至少找到5个典型案例 2. 分析每个案例的成功要素 3. 提炼可复用的方法论 4. 给出借鉴建议",
    inputFields: [
      {
        name: "industry",
        label: "行业/领域",
        type: "text" as const,
        required: true,
        placeholder: "如：短视频运营、品牌营销",
      },
      {
        name: "type",
        label: "案例类型",
        type: "select" as const,
        required: true,
        options: ["爆款内容", "营销活动", "品牌传播", "全部"],
      },
    ],
    toolsHint: ["web_search", "web_deep_read"],
    sortOrder: 2,
  },
  {
    employeeSlug: "xiaozi",
    name: "资料整理",
    description: "搜集并结构化整理指定主题的资料",
    icon: "FolderOpen",
    welcomeMessage: "我来整理资料。发给我主题和想要的输出格式，我整理成可直接用的结构。",
    systemInstruction:
      "请围绕「{{subject}}」进行资料搜集和整理，以{{format}}格式输出。要求：1. 多源搜索相关资料 2. 去重和筛选高质量信息 3. 按逻辑结构组织 4. 标注信息来源",
    inputFields: [
      {
        name: "subject",
        label: "整理主题",
        type: "text" as const,
        required: true,
        placeholder: "如：2024年AI大模型发展报告",
      },
      {
        name: "format",
        label: "输出格式",
        type: "select" as const,
        required: true,
        options: ["要点摘要", "结构化报告", "思维导图大纲"],
      },
    ],
    toolsHint: ["web_search", "web_deep_read", "media_search"],
    sortOrder: 3,
  },

  // =========================================================================
  // 小文 (xiaowen) — 内容创作师  (4 scenarios)
  // =========================================================================
  {
    employeeSlug: "xiaowen",
    name: "文章创作",
    description: "根据选题和风格要求创作高质量文章",
    icon: "PenTool",
    welcomeMessage: "我来起稿。给我标题、风格和字数，我按结构写成完整文章。",
    systemInstruction:
      "请以「{{style}}」风格，围绕选题「{{title}}」创作一篇约{{wordCount}}的文章。要求：1. 开头吸引眼球 2. 逻辑清晰、论据充分 3. 适当引用数据和案例 4. 结尾有力，引发思考",
    inputFields: [
      {
        name: "title",
        label: "文章选题",
        type: "text" as const,
        required: true,
        placeholder: "如：AI如何改变新闻行业",
      },
      {
        name: "style",
        label: "写作风格",
        type: "select" as const,
        required: true,
        options: ["深度报道", "轻松科普", "评论观点", "新闻快讯"],
      },
      {
        name: "wordCount",
        label: "目标字数",
        type: "select" as const,
        required: true,
        options: ["800字", "1500字", "3000字", "5000字"],
      },
    ],
    toolsHint: ["content_generate", "web_search"],
    sortOrder: 1,
  },
  {
    employeeSlug: "xiaowen",
    name: "标题生成",
    description: "为文章生成多种风格的备选标题",
    icon: "Type",
    welcomeMessage: "我来想几个好标题。把正文或主题发我，我给你 N 个备选。",
    systemInstruction:
      "请根据以下内容生成{{count}}个备选标题：\n\n{{content}}\n\n要求：1. 涵盖不同风格（悬念型、数字型、观点型等）2. 适合微信公众号传播 3. 控制在20字以内 4. 标注每个标题的风格类型",
    inputFields: [
      {
        name: "content",
        label: "文章内容/摘要",
        type: "textarea" as const,
        required: true,
        placeholder: "粘贴文章内容或简述文章主题...",
      },
      {
        name: "count",
        label: "标题数量",
        type: "select" as const,
        required: true,
        options: ["5个", "10个", "15个"],
      },
    ],
    toolsHint: ["content_generate"],
    sortOrder: 2,
  },
  {
    employeeSlug: "xiaowen",
    name: "脚本创作",
    description: "为视频创作包含分镜和口播文案的完整脚本",
    icon: "Film",
    welcomeMessage: "我来写脚本。告诉我主题、时长和平台，我按镜头+口播结构输出。",
    systemInstruction:
      "请为{{platform}}平台创作一个{{duration}}的视频脚本，主题为「{{topic}}」。要求：1. 开头3秒抓住注意力 2. 包含分镜描述和口播文案 3. 标注画面建议和字幕 4. 结尾引导互动",
    inputFields: [
      {
        name: "topic",
        label: "视频主题",
        type: "text" as const,
        required: true,
        placeholder: "如：5分钟讲清楚大模型原理",
      },
      {
        name: "duration",
        label: "目标时长",
        type: "select" as const,
        required: true,
        options: ["1分钟短视频", "3-5分钟", "10分钟以上"],
      },
      {
        name: "platform",
        label: "发布平台",
        type: "select" as const,
        required: true,
        options: ["抖音", "B站", "视频号", "通用"],
      },
    ],
    toolsHint: ["content_generate", "web_search"],
    sortOrder: 3,
  },
  {
    employeeSlug: "xiaowen",
    name: "内容改写",
    description: "将已有内容改写为指定风格",
    icon: "RefreshCw",
    welcomeMessage: "我来改写这段内容。贴原文，告诉我目标风格，我改写后保留核心信息。",
    systemInstruction:
      "请将以下内容改写为{{targetStyle}}的风格：\n\n{{original}}\n\n要求：1. 保持核心信息不变 2. 调整语言风格和表达方式 3. 优化段落结构 4. 提升可读性",
    inputFields: [
      {
        name: "original",
        label: "原始内容",
        type: "textarea" as const,
        required: true,
        placeholder: "粘贴需要改写的内容...",
      },
      {
        name: "targetStyle",
        label: "目标风格",
        type: "select" as const,
        required: true,
        options: ["更口语化", "更正式", "更简洁", "更详细", "更有趣"],
      },
    ],
    toolsHint: ["content_generate"],
    sortOrder: 4,
  },

  // =========================================================================
  // 小剪 (xiaojian) — 视频制片人  (3 scenarios)
  // =========================================================================
  {
    employeeSlug: "xiaojian",
    name: "视频策划",
    description: "为视频内容制定完整制作方案",
    icon: "Film",
    welcomeMessage: "我来做视频策划。内容大纲和形式告诉我，我给你一份可执行的拍摄方案。",
    systemInstruction:
      "请为「{{content}}」策划一个{{format}}制作方案。要求：1. 详细的分镜脚本和时间轴 2. 画面构图和转场建议 3. 字幕、特效和音效标注 4. 素材清单和拍摄要点",
    inputFields: [
      {
        name: "content",
        label: "视频主题/内容",
        type: "text" as const,
        required: true,
        placeholder: "如：AI手机评测对比",
      },
      {
        name: "format",
        label: "视频形式",
        type: "select" as const,
        required: true,
        options: ["横屏长视频", "竖屏短视频", "直播", "Vlog"],
      },
    ],
    toolsHint: ["content_generate", "media_search"],
    sortOrder: 1,
  },
  {
    employeeSlug: "xiaojian",
    name: "封面设计建议",
    description: "为视频或文章设计封面创意方案",
    icon: "Image",
    welcomeMessage: "我来给封面建议。标题和平台给我，我按平台规范给出视觉方向。",
    systemInstruction:
      "请为「{{title}}」设计{{platform}}平台的封面方案。要求：1. 3个不同风格的封面创意 2. 配色方案和字体建议 3. 构图布局描述 4. 标注平台封面尺寸规范",
    inputFields: [
      {
        name: "title",
        label: "视频/文章标题",
        type: "text" as const,
        required: true,
        placeholder: "如：ChatGPT使用技巧大全",
      },
      {
        name: "platform",
        label: "发布平台",
        type: "select" as const,
        required: true,
        options: ["公众号", "抖音", "B站", "小红书", "通用"],
      },
    ],
    toolsHint: ["web_search", "media_search"],
    sortOrder: 2,
  },
  {
    employeeSlug: "xiaojian",
    name: "音频方案",
    description: "为视频规划背景音乐、配音和音效方案",
    icon: "Music",
    welcomeMessage: "我来配音频方案。视频类型和情绪定下来，我推荐 BGM 与音效配比。",
    systemInstruction:
      "请为「{{videoType}}」类型的视频规划{{mood}}基调的音频方案。要求：1. 背景音乐风格和推荐 2. 配音风格和语速建议 3. 音效使用时机标注 4. 音量层次和混音建议",
    inputFields: [
      {
        name: "videoType",
        label: "视频类型",
        type: "text" as const,
        required: true,
        placeholder: "如：科技评测、美食探店",
      },
      {
        name: "mood",
        label: "情绪基调",
        type: "select" as const,
        required: true,
        options: ["轻松愉快", "严肃专业", "激情热血", "温馨感人", "悬疑紧张"],
      },
    ],
    toolsHint: ["content_generate"],
    sortOrder: 3,
  },

  // =========================================================================
  // 小审 (xiaoshen) — 质量审核官  (3 scenarios)
  // =========================================================================
  {
    employeeSlug: "xiaoshen",
    name: "内容审核",
    description: "按审核标准检查内容质量和准确性",
    icon: "CheckCircle",
    welcomeMessage: "我来帮你审核这段内容。贴内容+选审核标准，我标出问题和修改建议。",
    systemInstruction:
      "请按照{{standard}}标准审核以下内容：\n\n{{content}}\n\n要求：1. 检查事实准确性 2. 检查逻辑连贯性 3. 检查语法和表达 4. 检查敏感词和合规风险 5. 给出质量评分（1-100）和修改建议",
    inputFields: [
      {
        name: "content",
        label: "待审核内容",
        type: "textarea" as const,
        required: true,
        placeholder: "粘贴需要审核的文章或脚本...",
      },
      {
        name: "standard",
        label: "审核标准",
        type: "select" as const,
        required: true,
        options: ["基础审核", "严格审核", "发布前终审"],
      },
    ],
    toolsHint: ["fact_check", "web_search"],
    sortOrder: 1,
  },
  {
    employeeSlug: "xiaoshen",
    name: "合规检查",
    description: "检查内容是否符合平台发布规范",
    icon: "Shield",
    welcomeMessage: "我按该平台最新规范扫一遍。内容+目标平台给我，输出合规风险清单。",
    systemInstruction:
      "请检查以下内容是否符合{{platform}}平台的发布规范：\n\n{{content}}\n\n要求：1. 检查是否含有违规敏感词 2. 检查是否涉及版权风险 3. 检查广告法合规性 4. 给出合规评分和修改建议",
    inputFields: [
      {
        name: "content",
        label: "待检查内容",
        type: "textarea" as const,
        required: true,
        placeholder: "粘贴需要合规检查的内容...",
      },
      {
        name: "platform",
        label: "目标平台",
        type: "select" as const,
        required: true,
        options: ["微信公众号", "抖音", "微博", "B站", "通用"],
      },
    ],
    toolsHint: ["fact_check", "web_deep_read"],
    sortOrder: 2,
  },
  {
    employeeSlug: "xiaoshen",
    name: "事实核查",
    description: "逐条核查事实性陈述的准确性",
    icon: "Search",
    welcomeMessage: "我来核对事实。列出需要核查的断言，我逐条查证并标注可信度。",
    systemInstruction:
      "请对以下事实性陈述进行{{rigor}}：\n\n{{claims}}\n\n要求：1. 逐条核查每个事实陈述 2. 标注信息来源和可信度 3. 指出存疑或错误之处 4. 给出核查结论和修正建议",
    inputFields: [
      {
        name: "claims",
        label: "待核查内容",
        type: "textarea" as const,
        required: true,
        placeholder: "列出需要核查的事实性陈述...",
      },
      {
        name: "rigor",
        label: "核查严格度",
        type: "select" as const,
        required: true,
        options: ["快速核查", "标准核查", "深度核查"],
      },
    ],
    toolsHint: ["fact_check", "web_search", "web_deep_read"],
    sortOrder: 3,
  },

  // =========================================================================
  // 小发 (xiaofa) — 渠道运营专家  (3 scenarios)
  // =========================================================================
  {
    employeeSlug: "xiaofa",
    name: "发布策略",
    description: "为内容制定多渠道发布策略",
    icon: "Radio",
    welcomeMessage: "我来排发布策略。内容和候选渠道给我，我给出适配+时段建议。",
    systemInstruction:
      "请为「{{content}}」制定{{channels}}发布策略。要求：1. 推荐发布渠道组合 2. 各渠道最佳发布时间 3. 内容适配建议（标题、封面、描述差异化）4. 预期效果和KPI建议",
    inputFields: [
      {
        name: "content",
        label: "内容类型/主题",
        type: "text" as const,
        required: true,
        placeholder: "如：AI科普长文、产品评测视频",
      },
      {
        name: "channels",
        label: "目标渠道",
        type: "select" as const,
        required: true,
        options: ["全渠道", "图文渠道", "视频渠道", "社交媒体"],
      },
    ],
    toolsHint: ["web_search", "data_report"],
    sortOrder: 1,
  },
  {
    employeeSlug: "xiaofa",
    name: "渠道分析",
    description: "分析渠道运营表现并给出优化建议",
    icon: "BarChart3",
    welcomeMessage: "我来分析该渠道的表现。选渠道和周期，我给出数据看板和优化建议。",
    systemInstruction:
      "请分析{{channel}}渠道在{{period}}的运营表现。要求：1. 关键数据指标总结 2. 内容表现排名分析 3. 受众互动趋势 4. 优化建议和下一步行动",
    inputFields: [
      {
        name: "channel",
        label: "分析渠道",
        type: "text" as const,
        required: true,
        placeholder: "如：公众号、抖音、B站",
      },
      {
        name: "period",
        label: "分析周期",
        type: "select" as const,
        required: true,
        options: ["近7天", "近30天", "近90天"],
      },
    ],
    toolsHint: ["web_search", "data_report"],
    sortOrder: 2,
  },
  {
    employeeSlug: "xiaofa",
    name: "推广方案",
    description: "制定不同预算级别的内容推广方案",
    icon: "Radio",
    welcomeMessage: "我来做推广方案。目标+预算给我，我按投放节奏和渠道组合出一版。",
    systemInstruction:
      "请为「{{target}}」制定{{budget}}级别的推广方案。要求：1. 推广渠道和方式选择 2. 内容传播路径设计 3. KOL/社群合作建议 4. 预算分配和效果预估",
    inputFields: [
      {
        name: "target",
        label: "推广目标",
        type: "text" as const,
        required: true,
        placeholder: "如：新品发布推广、品牌知名度提升",
      },
      {
        name: "budget",
        label: "预算等级",
        type: "select" as const,
        required: true,
        options: ["零预算", "小预算", "中等预算", "大预算"],
      },
    ],
    toolsHint: ["web_search"],
    sortOrder: 3,
  },

  // =========================================================================
  // 小树 (xiaoshu) — 数据分析师  (3 scenarios)
  // =========================================================================
  {
    employeeSlug: "xiaoshu",
    name: "数据报告",
    description: "生成数据驱动的运营分析报告",
    icon: "BarChart3",
    welcomeMessage: "我来做数据报告。选主题和输出格式，我给出关键指标+图表解读。",
    systemInstruction:
      "请生成「{{topic}}」的{{format}}。要求：1. 核心数据指标汇总 2. 趋势分析和同比环比 3. 异常数据标注和解读 4. 数据驱动的建议",
    inputFields: [
      {
        name: "topic",
        label: "报告主题",
        type: "text" as const,
        required: true,
        placeholder: "如：本月内容运营数据分析",
      },
      {
        name: "format",
        label: "报告格式",
        type: "select" as const,
        required: true,
        options: ["简要概览", "详细报告", "数据看板"],
      },
    ],
    toolsHint: ["data_report", "web_search"],
    sortOrder: 1,
  },
  {
    employeeSlug: "xiaoshu",
    name: "趋势分析",
    description: "分析行业趋势并预测发展方向",
    icon: "TrendingUp",
    welcomeMessage: "我来做趋势分析。领域和分析维度告诉我，我输出时间序列与洞察。",
    systemInstruction:
      "请对{{field}}领域进行{{dimension}}分析。要求：1. 搜索最新行业数据和报告 2. 识别关键趋势信号 3. 预测未来发展方向 4. 给出策略建议",
    inputFields: [
      {
        name: "field",
        label: "分析领域",
        type: "text" as const,
        required: true,
        placeholder: "如：短视频行业、AI应用",
      },
      {
        name: "dimension",
        label: "分析维度",
        type: "select" as const,
        required: true,
        options: ["技术趋势", "市场趋势", "内容趋势", "综合分析"],
      },
    ],
    toolsHint: ["web_search", "trending_topics", "data_report"],
    sortOrder: 2,
  },
  {
    employeeSlug: "xiaoshu",
    name: "效果复盘",
    description: "对已完成项目进行效果复盘分析",
    icon: "RotateCcw",
    welcomeMessage: "我来帮你复盘项目。项目名+关注指标给我，我出一份结构化复盘报告。",
    systemInstruction:
      "请对「{{project}}」进行{{metrics}}方面的效果复盘。要求：1. 梳理项目执行过程 2. 核心数据指标分析 3. 亮点和不足总结 4. 可复用经验提炼 5. 改进建议",
    inputFields: [
      {
        name: "project",
        label: "复盘项目",
        type: "text" as const,
        required: true,
        placeholder: "如：某某专题报道、某某活动",
      },
      {
        name: "metrics",
        label: "关注指标",
        type: "select" as const,
        required: true,
        options: ["传播效果", "用户互动", "转化效果", "全面复盘"],
      },
    ],
    toolsHint: ["data_report"],
    sortOrder: 3,
  },
];
