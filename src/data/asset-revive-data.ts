import type {
  ReviveRecommendation,
  HotTopicMatch,
  StyleVariant,
  InternationalAdaptation,
  ReviveMetrics,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export const reviveMetrics: ReviveMetrics = {
  reuseRate: 68,
  reuseRateChange: 12,
  adoptionRate: 78,
  adoptionRateChange: 8,
  secondaryCreationCount: 15,
  secondaryCreationCountChange: 25,
  reachMultiplier: 3.2,
  reachMultiplierChange: 15,
};

// ---------------------------------------------------------------------------
// Tab 1: Daily recommendations
// ---------------------------------------------------------------------------

export const dailyRecommendations: ReviveRecommendation[] = [
  {
    id: "rec-01",
    scenario: "topic_match",
    originalAsset: "长江生态保护十年纪录片",
    reason: "《长江保护法》实施三周年之际，与长江生态话题高度关联",
    matchScore: 94,
    matchedTopic: "长江保护法三周年",
    suggestedAction: "截取长江生态修复前后对比片段，配合最新数据制作短视频",
    estimatedReach: "50万+",
    status: "pending",
  },
  {
    id: "rec-02",
    scenario: "hot_match",
    originalAsset: "两会特别报道：养老金并轨改革深度解读",
    reason: "养老金并轨话题持续升温，相关采访素材可二次利用",
    matchScore: 91,
    matchedTopic: "养老金并轨过渡期结束",
    suggestedAction: "整理专家观点片段，制作「一分钟看懂并轨改革」短视频",
    estimatedReach: "80万+",
    status: "pending",
  },
  {
    id: "rec-03",
    scenario: "daily_push",
    originalAsset: "跨年特别节目花絮集锦",
    reason: "元宵节将至，跨年与春节花絮可作为节日氛围内容推送",
    matchScore: 82,
    matchedTopic: "元宵节特辑",
    suggestedAction: "精选跨年烟花、灯会等片段，制作元宵节怀旧合集",
    estimatedReach: "30万+",
    status: "pending",
  },
  {
    id: "rec-04",
    scenario: "topic_match",
    originalAsset: "AI科技大会：大模型商用前瞻",
    reason: "DeepSeek R2发布引爆AI话题，历史大会素材可快速复用",
    matchScore: 88,
    matchedTopic: "DeepSeek R2 发布",
    suggestedAction: "提取大会中关于AI落地的精华观点，对比最新进展",
    estimatedReach: "120万+",
    status: "pending",
  },
  {
    id: "rec-05",
    scenario: "hot_match",
    originalAsset: "台风杜苏芮福建沿海追踪报道",
    reason: "福建沿海防灾建设专题可与当前气象话题关联",
    matchScore: 75,
    matchedTopic: "福建沿海城市韧性建设",
    suggestedAction: "整理防灾救灾片段，结合后续重建成果做回顾报道",
    estimatedReach: "25万+",
    status: "pending",
  },
  {
    id: "rec-06",
    scenario: "daily_push",
    originalAsset: "春运首日：高铁新线路开通特别报道",
    reason: "清明假期临近，高铁出行素材有复用价值",
    matchScore: 72,
    matchedTopic: "清明出行攻略",
    suggestedAction: "整合高铁新线路介绍片段，制作出行攻略类内容",
    estimatedReach: "40万+",
    status: "pending",
  },
];

export const dailySummary = {
  date: "2026年3月1日",
  totalCount: 6,
  adoptionRate: 78,
};

// Scenario badge configs
export const scenarioBadge: Record<string, { label: string; color: string }> = {
  topic_match: { label: "跟选题", color: "bg-blue-100 text-blue-700" },
  hot_match: { label: "蹭热点", color: "bg-red-100 text-red-700" },
  daily_push: { label: "自推荐", color: "bg-green-100 text-green-700" },
  intl_broadcast: { label: "国际传播", color: "bg-purple-100 text-purple-700" },
  style_adapt: { label: "风格适配", color: "bg-amber-100 text-amber-700" },
};

// ---------------------------------------------------------------------------
// Tab 2: Hot topic matching
// ---------------------------------------------------------------------------

export const hotTopicMatches: HotTopicMatch[] = [
  {
    hotTopic: "养老金并轨过渡期正式结束",
    heatScore: 96,
    matchedAssets: [
      { assetTitle: "两会特别报道：养老金并轨改革深度解读", matchScore: 91, suggestedAngle: "回顾并轨历程，专家观点二次传播" },
      { assetTitle: "社区养老服务体系建设纪实", matchScore: 78, suggestedAngle: "结合养老服务实践，展示基层落实" },
    ],
  },
  {
    hotTopic: "DeepSeek R2 模型正式发布",
    heatScore: 94,
    matchedAssets: [
      { assetTitle: "AI科技大会：大模型商用前瞻", matchScore: 88, suggestedAngle: "大会预测vs实际落地，对比分析" },
    ],
  },
  {
    hotTopic: "长江保护法实施三周年成效",
    heatScore: 85,
    matchedAssets: [
      { assetTitle: "长江生态保护十年纪录片", matchScore: 94, suggestedAngle: "十年变迁vs三年法治，生态数据对比" },
    ],
  },
  {
    hotTopic: "元宵节全国灯会文旅消费",
    heatScore: 88,
    matchedAssets: [
      { assetTitle: "跨年特别节目花絮集锦", matchScore: 82, suggestedAngle: "跨年到元宵，节日氛围串联" },
      { assetTitle: "春运首日：高铁新线路开通", matchScore: 65, suggestedAngle: "假期出行数据对比" },
    ],
  },
];

// 7-day match success rate
export const matchSuccessData = [
  { name: "2/23", value: 65 },
  { name: "2/24", value: 72 },
  { name: "2/25", value: 68 },
  { name: "2/26", value: 80 },
  { name: "2/27", value: 75 },
  { name: "2/28", value: 85 },
  { name: "3/1", value: 82 },
];

// Match timeline
export const matchTimeline = [
  { time: "09:00", title: "养老金话题匹配", description: "命中2条历史资产", status: "completed" as const },
  { time: "08:30", title: "DeepSeek匹配", description: "命中1条科技素材", status: "completed" as const },
  { time: "08:00", title: "长江保护法匹配", description: "命中1条纪录片", status: "completed" as const },
  { time: "07:30", title: "元宵节匹配", description: "命中2条节日素材", status: "active" as const },
  { time: "07:00", title: "每日扫描启动", description: "扫描热点池与资产库", status: "completed" as const },
];

// ---------------------------------------------------------------------------
// Tab 3: Style adaptation
// ---------------------------------------------------------------------------

export const styleSourceContent = {
  title: "养老金并轨改革深度解读",
  originalExcerpt: "从2024年10月起，机关事业单位与企业职工的养老保险制度正式并轨。人社部相关负责人介绍，新的计发办法将基础养老金与个人账户养老金相结合，确保退休人员待遇平稳过渡。",
};

export const styleVariants: StyleVariant[] = [
  {
    style: "joyful",
    styleLabel: "愉悦风格",
    title: "好消息！养老金「双轨」变「单轨」，退休工资怎么算？一文看懂！",
    excerpt: "说一个让退休人员开心的好消息！从去年10月开始，不管你是公务员还是企业员工，养老金都按同一套规则算啦！简单来说就是——更公平、更透明，大家的养老钱都有保障！",
    tone: "轻松活泼，使用口语化表达，多用感叹号和互动式提问，适合短视频和社交媒体传播",
  },
  {
    style: "serious",
    styleLabel: "严肃风格",
    title: "制度并轨：中国养老保障体系改革的里程碑",
    excerpt: "2024年10月，历经十年过渡期的机关事业单位养老保险制度改革正式完成并轨。这一制度性变革消除了长期存在的「双轨制」差异，标志着我国社会保障制度向更加公平、可持续的方向迈出关键一步。",
    tone: "正式严谨，使用书面语和专业术语，注重数据引用和逻辑论证，适合深度报道和评论",
  },
  {
    style: "dramatic",
    styleLabel: "跌宕风格",
    title: "十年博弈终落幕！养老金「双轨制」如何走向大一统？",
    excerpt: "这是一场持续十年的制度变革。2014年，一纸文件打破了沿用数十年的「铁饭碗」规则；2024年，过渡期悄然结束，新旧制度的角力终于尘埃落定。然而，这真的意味着「公平」已经到来吗？",
    tone: "戏剧悬念，使用对比和转折手法，设置悬念和反问，适合深度专题和纪录片解说",
  },
];

// ---------------------------------------------------------------------------
// Tab 4: International adaptation
// ---------------------------------------------------------------------------

export const internationalSource = {
  title: "中国春节：从传统年俗到世界文化遗产",
  excerpt: "2024年12月，中国春节正式列入联合国教科文组织人类非物质文化遗产代表作名录。这个有着4000多年历史的节日，从贴春联、放鞭炮、吃年夜饭，到如今的全球同庆，见证了中华文化的传承与创新。",
};

export const internationalAdaptations: InternationalAdaptation[] = [
  {
    language: "泰语",
    languageCode: "th",
    flag: "🇹🇭",
    title: "ตรุษจีน: จากประเพณีสู่มรดกโลก",
    excerpt: "เทศกาลตรุษจีนได้รับการขึ้นทะเบียนเป็นมรดกวัฒนธรรมที่จับต้องไม่ได้ของมนุษยชาติ ชาวไทยเชื้อสายจีนร่วมเฉลิมฉลองกับคนทั่วโลก...",
    adaptationNotes: "融入泰国华人社区庆祝元素，增加曼谷唐人街活动描述，调整为泰国读者熟悉的文化参照",
    status: "completed",
  },
  {
    language: "越南语",
    languageCode: "vi",
    flag: "🇻🇳",
    title: "Tết Nguyên Đán Trung Quốc: Từ truyền thống đến di sản thế giới",
    excerpt: "Tết Nguyên Đán Trung Quốc đã được UNESCO công nhận là di sản văn hóa phi vật thể. Với lịch sử hơn 4000 năm, lễ hội này đã trở thành sự kiện văn hóa toàn cầu...",
    adaptationNotes: "注意越南也有传统春节（Tết），需要区分说明，增加中越文化交流的正面叙事",
    status: "completed",
  },
  {
    language: "马来语",
    languageCode: "ms",
    flag: "🇲🇾",
    title: "Tahun Baru Cina: Dari Tradisi ke Warisan Dunia",
    excerpt: "Perayaan Tahun Baru Cina telah diiktiraf oleh UNESCO sebagai warisan budaya tidak ketara. Di Malaysia, perayaan ini disambut meriah oleh masyarakat Cina tempatan bersama rakyat pelbagai kaum...",
    adaptationNotes: "突出马来西亚多元文化共庆特色，增加当地华人新年传统（捞鱼生等），体现民族和谐",
    status: "in_progress",
  },
  {
    language: "印尼语",
    languageCode: "id",
    flag: "🇮🇩",
    title: "Imlek: Dari Tradisi Tiongkok hingga Warisan Dunia",
    excerpt: "Perayaan Imlek telah diakui UNESCO sebagai warisan budaya tak benda. Di Indonesia, Imlek menjadi hari libur nasional sejak tahun 2003 dan dirayakan secara meriah oleh masyarakat Tionghoa Indonesia...",
    adaptationNotes: "使用印尼对春节的本地称呼「Imlek」，提及2003年成为国家假日的历史背景，强调印尼华人文化贡献",
    status: "pending",
  },
];

// Language distribution for donut
export const languageDistributionData = [
  { name: "泰语", value: 35, color: "#3b82f6" },
  { name: "越南语", value: 28, color: "#10b981" },
  { name: "马来语", value: 22, color: "#f59e0b" },
  { name: "印尼语", value: 15, color: "#8b5cf6" },
];

// International stats
export const internationalStats = {
  totalAdaptations: 42,
  languagesCovered: 4,
  avgProcessingTime: "12min",
};

// Cultural adaptation points
export const culturalAdaptPoints = [
  "尊重当地称呼习惯（如印尼用Imlek）",
  "融入本地华人社区文化元素",
  "避免文化敏感表述和政治隐喻",
  "增加目标国家与中国的文化纽带",
  "保持核心信息一致，本地化表达形式",
];

// ---------------------------------------------------------------------------
// Tab 5: Dashboard
// ---------------------------------------------------------------------------

// Reuse trend (7 days)
export const reuseTrendData = [
  { date: "2/23", value: 8 },
  { date: "2/24", value: 12 },
  { date: "2/25", value: 10 },
  { date: "2/26", value: 15 },
  { date: "2/27", value: 13 },
  { date: "2/28", value: 18 },
  { date: "3/1", value: 15 },
];

// Scenario distribution
export const scenarioDistributionData = [
  { name: "跟选题", value: 35 },
  { name: "蹭热点", value: 28 },
  { name: "自推荐", value: 20 },
  { name: "国际传播", value: 12 },
  { name: "风格适配", value: 5 },
];

// Revive records table
export const reviveRecords = [
  { id: "rv-01", asset: "长江生态保护纪录片", scenario: "topic_match", matchScore: 94, status: "adopted", date: "2026-03-01", reach: "52万" },
  { id: "rv-02", asset: "养老金并轨改革报道", scenario: "hot_match", matchScore: 91, status: "adopted", date: "2026-03-01", reach: "85万" },
  { id: "rv-03", asset: "跨年特别节目花絮", scenario: "daily_push", matchScore: 82, status: "pending", date: "2026-03-01", reach: "—" },
  { id: "rv-04", asset: "AI科技大会专访", scenario: "hot_match", matchScore: 88, status: "adopted", date: "2026-02-28", reach: "130万" },
  { id: "rv-05", asset: "台风杜苏芮报道", scenario: "topic_match", matchScore: 75, status: "rejected", date: "2026-02-28", reach: "—" },
  { id: "rv-06", asset: "春运首日报道", scenario: "daily_push", matchScore: 72, status: "adopted", date: "2026-02-27", reach: "42万" },
  { id: "rv-07", asset: "中国春节文化", scenario: "intl_broadcast", matchScore: 90, status: "adopted", date: "2026-02-26", reach: "200万+" },
];

// Record status config
export const recordStatusConfig: Record<string, { label: string; color: string }> = {
  adopted: { label: "已采用", color: "bg-green-100 text-green-700" },
  pending: { label: "待处理", color: "bg-gray-100 text-gray-500" },
  rejected: { label: "已跳过", color: "bg-red-100 text-red-700" },
};
