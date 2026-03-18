export interface InspirationTopic {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  heatScore: number;
  aiScore: number;
  trend: "rising" | "surging" | "plateau" | "declining";
  source: string;
  category: string;
  discoveredAt: string;
  heatCurve: { time: string; value: number }[];
  suggestedAngles: string[];
  competitorResponse: string[];
  relatedAssets: string[];
  summary: string;
  platforms: string[];
  commentInsight: {
    positive: number;
    neutral: number;
    negative: number;
    hotComments: string[];
  };
}

export interface PlatformMonitor {
  name: string;
  icon: string;
  status: "online" | "offline";
  lastScan: string;
  topicsFound: number;
}

export interface EditorialMeeting {
  p0Count: number;
  p1Count: number;
  p2Count: number;
  outputMatrix: { type: string; count: number }[];
  generatedAt: string;
}

export const platformMonitors: PlatformMonitor[] = [
  { name: "微博", icon: "📱", status: "online", lastScan: "10秒前", topicsFound: 12 },
  { name: "微信公众号", icon: "💬", status: "online", lastScan: "30秒前", topicsFound: 8 },
  { name: "抖音", icon: "🎵", status: "online", lastScan: "15秒前", topicsFound: 15 },
  { name: "头条", icon: "📰", status: "online", lastScan: "20秒前", topicsFound: 6 },
  { name: "知乎", icon: "💡", status: "online", lastScan: "45秒前", topicsFound: 4 },
  { name: "B站", icon: "📺", status: "online", lastScan: "25秒前", topicsFound: 7 },
  { name: "小红书", icon: "📕", status: "online", lastScan: "35秒前", topicsFound: 9 },
  { name: "百度", icon: "🔍", status: "online", lastScan: "50秒前", topicsFound: 3 },
  { name: "快手", icon: "⚡", status: "online", lastScan: "40秒前", topicsFound: 5 },
  { name: "今日头条", icon: "📲", status: "online", lastScan: "55秒前", topicsFound: 4 },
];

export const editorialMeeting: EditorialMeeting = {
  p0Count: 3,
  p1Count: 4,
  p2Count: 3,
  outputMatrix: [
    { type: "图文", count: 8 },
    { type: "短视频", count: 12 },
    { type: "H5专题", count: 2 },
    { type: "直播", count: 1 },
  ],
  generatedAt: "08:05",
};

export const inspirationTopics: InspirationTopic[] = [
  {
    id: "ins-1",
    title: "AI手机大战：三巨头旗舰同日发布",
    priority: "P0",
    heatScore: 97,
    aiScore: 92,
    trend: "surging",
    source: "微博/抖音/头条",
    category: "科技",
    discoveredAt: "08:15",
    heatCurve: [
      { time: "06:00", value: 20 },
      { time: "07:00", value: 35 },
      { time: "08:00", value: 65 },
      { time: "09:00", value: 82 },
      { time: "10:00", value: 97 },
    ],
    suggestedAngles: [
      "三款旗舰AI芯片横向实测对比",
      "AI手机改变生活的十个场景",
      "供应链分析：谁将胜出？",
    ],
    competitorResponse: [
      "36氪：已发评测长文（10万+）",
      "虎嗅：深度供应链分析（5万+）",
      "澎湃：直播连线进行中",
    ],
    relatedAssets: ["发布会视频", "产品参数表", "芯片跑分数据"],
    summary: "华为、小米、OPPO三大品牌同日发布AI旗舰手机，引发全网关注。三款手机均搭载自研AI大模型，主打端侧智能体验。",
    platforms: ["微博", "抖音", "头条", "知乎", "B站"],
    commentInsight: {
      positive: 62,
      neutral: 25,
      negative: 13,
      hotComments: [
        "华为的AI助手简直太强了，语音交互丝滑",
        "小米性价比之王，AI功能不输友商",
        "OPPO的影像AI提升最大，拍照党首选",
      ],
    },
  },
  {
    id: "ins-2",
    title: "新能源汽车降价潮：特斯拉带头全面下调",
    priority: "P0",
    heatScore: 93,
    aiScore: 88,
    trend: "rising",
    source: "微信/微博",
    category: "汽车",
    discoveredAt: "07:30",
    heatCurve: [
      { time: "06:00", value: 15 },
      { time: "07:00", value: 45 },
      { time: "08:00", value: 72 },
      { time: "09:00", value: 85 },
      { time: "10:00", value: 93 },
    ],
    suggestedAngles: [
      "降价幅度全景图：谁降得最狠？",
      "消费者等等党胜利指南",
      "新能源降价对燃油车市场的冲击",
    ],
    competitorResponse: [
      "财新：政策解读角度（8万+）",
      "第一财经：价格战数据可视化（12万+）",
    ],
    relatedAssets: ["降价对比表", "历史价格走势", "市场份额数据"],
    summary: "特斯拉宣布全系降价2-5万元，比亚迪、蔚来等品牌迅速跟进，新一轮价格战全面打响。",
    platforms: ["微信", "微博", "头条"],
    commentInsight: {
      positive: 45,
      neutral: 20,
      negative: 35,
      hotComments: [
        "刚提车就降价3万，心态崩了",
        "等等党永远不亏",
        "油车还能撑多久？",
      ],
    },
  },
  {
    id: "ins-3",
    title: "两会数字经济前瞻：AI立法成焦点",
    priority: "P0",
    heatScore: 88,
    aiScore: 85,
    trend: "rising",
    source: "新华社/央视",
    category: "政策",
    discoveredAt: "07:00",
    heatCurve: [
      { time: "06:00", value: 30 },
      { time: "07:00", value: 50 },
      { time: "08:00", value: 68 },
      { time: "09:00", value: 80 },
      { time: "10:00", value: 88 },
    ],
    suggestedAngles: [
      "十大数字经济提案预测",
      "AI立法对行业的影响深度解读",
      "代表委员观点前瞻盘点",
    ],
    competitorResponse: [
      "澎湃：专题页面已上线",
      "财新：代表委员采访系列",
    ],
    relatedAssets: ["往年提案数据库", "代表委员名单", "政策文件"],
    summary: "全国两会即将召开，数字经济相关提案预计超过200份，AI立法和数据安全成为最受关注的议题。",
    platforms: ["微信", "微博", "头条", "知乎"],
    commentInsight: {
      positive: 55,
      neutral: 35,
      negative: 10,
      hotComments: [
        "AI立法太有必要了，深度伪造问题严重",
        "希望支持科技创新的同时加强监管",
        "数字经济是未来，期待好政策",
      ],
    },
  },
  {
    id: "ins-4",
    title: "GPT-5发布：多模态能力再突破",
    priority: "P1",
    heatScore: 82,
    aiScore: 78,
    trend: "plateau",
    source: "推特/知乎",
    category: "科技",
    discoveredAt: "09:00",
    heatCurve: [
      { time: "06:00", value: 60 },
      { time: "07:00", value: 70 },
      { time: "08:00", value: 78 },
      { time: "09:00", value: 82 },
      { time: "10:00", value: 80 },
    ],
    suggestedAngles: [
      "GPT-5 vs 国产大模型全面对比",
      "对普通用户意味着什么？",
    ],
    competitorResponse: ["36氪：首发评测", "虎嗅：行业影响分析"],
    relatedAssets: ["技术白皮书", "测试数据"],
    summary: "OpenAI正式发布GPT-5，在多模态理解、推理能力和工具使用方面取得显著突破。",
    platforms: ["知乎", "B站", "微博"],
    commentInsight: {
      positive: 70,
      neutral: 20,
      negative: 10,
      hotComments: ["国产大模型加油追赶！", "这个推理能力太逆天了"],
    },
  },
  {
    id: "ins-5",
    title: "春季档电影票房破百亿",
    priority: "P1",
    heatScore: 76,
    aiScore: 72,
    trend: "rising",
    source: "微博/抖音",
    category: "娱乐",
    discoveredAt: "08:30",
    heatCurve: [
      { time: "06:00", value: 40 },
      { time: "07:00", value: 55 },
      { time: "08:00", value: 68 },
      { time: "09:00", value: 76 },
      { time: "10:00", value: 76 },
    ],
    suggestedAngles: ["春季档十大黑马分析", "观影数据背后的消费趋势"],
    competitorResponse: ["猫眼：实时票房数据"],
    relatedAssets: ["票房数据", "影评汇总"],
    summary: "2026年春季档电影总票房突破百亿大关，创历史同期新高。",
    platforms: ["微博", "抖音", "小红书"],
    commentInsight: {
      positive: 65,
      neutral: 25,
      negative: 10,
      hotComments: ["今年好片真多！", "国产电影越来越能打了"],
    },
  },
  {
    id: "ins-6",
    title: "数字人民币扩大试点城市",
    priority: "P1",
    heatScore: 71,
    aiScore: 68,
    trend: "rising",
    source: "央行/财经媒体",
    category: "财经",
    discoveredAt: "08:00",
    heatCurve: [
      { time: "06:00", value: 25 },
      { time: "07:00", value: 40 },
      { time: "08:00", value: 58 },
      { time: "09:00", value: 65 },
      { time: "10:00", value: 71 },
    ],
    suggestedAngles: ["新增试点城市完全指南", "数字人民币 vs 支付宝微信"],
    competitorResponse: ["第一财经：深度报道"],
    relatedAssets: ["政策文件", "试点数据"],
    summary: "央行宣布数字人民币试点范围再次扩大，新增15个城市。",
    platforms: ["微信", "头条"],
    commentInsight: {
      positive: 40,
      neutral: 45,
      negative: 15,
      hotComments: ["用起来和微信支付差不多", "隐私保护怎么样？"],
    },
  },
  {
    id: "ins-7",
    title: "AI教育新课标出炉",
    priority: "P1",
    heatScore: 68,
    aiScore: 65,
    trend: "plateau",
    source: "教育部/知乎",
    category: "教育",
    discoveredAt: "09:30",
    heatCurve: [
      { time: "06:00", value: 30 },
      { time: "07:00", value: 45 },
      { time: "08:00", value: 58 },
      { time: "09:00", value: 65 },
      { time: "10:00", value: 68 },
    ],
    suggestedAngles: ["家长必看：AI教育怎么教？", "中小学AI课程设置解读"],
    competitorResponse: [],
    relatedAssets: ["课标文件", "专家解读"],
    summary: "教育部发布人工智能教育新课程标准，覆盖中小学全学段。",
    platforms: ["知乎", "微信"],
    commentInsight: {
      positive: 50,
      neutral: 30,
      negative: 20,
      hotComments: ["从小学AI是对的", "别又变成应试教育"],
    },
  },
  {
    id: "ins-8",
    title: "AI健身私教爆火短视频平台",
    priority: "P2",
    heatScore: 52,
    aiScore: 48,
    trend: "rising",
    source: "抖音/小红书",
    category: "生活",
    discoveredAt: "10:00",
    heatCurve: [
      { time: "06:00", value: 15 },
      { time: "07:00", value: 25 },
      { time: "08:00", value: 38 },
      { time: "09:00", value: 45 },
      { time: "10:00", value: 52 },
    ],
    suggestedAngles: ["AI私教真的有用吗？亲测体验"],
    competitorResponse: [],
    relatedAssets: [],
    summary: "AI健身私教应用在短视频平台引发健身热潮，下载量周增300%。",
    platforms: ["抖音", "小红书"],
    commentInsight: {
      positive: 60,
      neutral: 30,
      negative: 10,
      hotComments: ["比去健身房方便多了"],
    },
  },
  {
    id: "ins-9",
    title: "AI新闻主播24小时直播实验",
    priority: "P2",
    heatScore: 48,
    aiScore: 45,
    trend: "declining",
    source: "B站",
    category: "媒体",
    discoveredAt: "09:15",
    heatCurve: [
      { time: "06:00", value: 55 },
      { time: "07:00", value: 52 },
      { time: "08:00", value: 50 },
      { time: "09:00", value: 48 },
      { time: "10:00", value: 46 },
    ],
    suggestedAngles: ["AI主播的伦理争议"],
    competitorResponse: [],
    relatedAssets: [],
    summary: "某媒体实验AI虚拟主播24小时不间断播报，引发行业讨论。",
    platforms: ["B站", "微博"],
    commentInsight: {
      positive: 30,
      neutral: 40,
      negative: 30,
      hotComments: ["声音还是不够自然", "主持人要失业了吗"],
    },
  },
  {
    id: "ins-10",
    title: "外卖平台抽成新规",
    priority: "P2",
    heatScore: 44,
    aiScore: 42,
    trend: "plateau",
    source: "微博",
    category: "社会",
    discoveredAt: "08:45",
    heatCurve: [
      { time: "06:00", value: 35 },
      { time: "07:00", value: 40 },
      { time: "08:00", value: 42 },
      { time: "09:00", value: 44 },
      { time: "10:00", value: 43 },
    ],
    suggestedAngles: ["商户和骑手的真实感受"],
    competitorResponse: [],
    relatedAssets: [],
    summary: "市场监管总局发布外卖平台抽成透明化新规，要求平台公开费率结构。",
    platforms: ["微博"],
    commentInsight: {
      positive: 55,
      neutral: 25,
      negative: 20,
      hotComments: ["终于管管了！", "希望外卖别再涨价了"],
    },
  },
];
