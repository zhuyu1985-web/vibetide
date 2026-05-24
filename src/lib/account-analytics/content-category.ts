/**
 * AIGC（LLM 标注）维度的内容主题分类。
 *
 * ⚠️ 注意：与 collected_items.category text[] 行业分类无关。
 * - category text[] 来自舆情数据源（"公安/政务"），由 collection adapter 写入
 * - 本文件的 AIGC_CONTENT_CATEGORIES 由 LLM 二次标注产出，存到 collected_items.aigc_content_category 单值字段
 *
 * 详细背景见 docs/superpowers/specs/2026-05-24-account-analytics-tab1-redesign-design.md §7
 */

export const AIGC_CONTENT_CATEGORIES = [
  "时政", // 政策、政府、官方动态
  "社会", // 民生、突发、社会事件
  "财经", // 商业、金融、经济
  "科技", // 互联网、AI、产品
  "生活", // 美食、家居、母婴、宠物
  "娱乐", // 影视、综艺、明星、追星
  "体育", // 赛事、运动员、健身
  "其他", // 兜底（LLM 不确定时必须选此项）
] as const;

export type AigcContentCategory = (typeof AIGC_CONTENT_CATEGORIES)[number];

/** UI 显示 8 项类别的 hsl 配色，CategoryDistribution 横向条形图 + 词云均用 */
export const AIGC_CATEGORY_COLORS: Record<AigcContentCategory, string> = {
  时政: "hsl(0, 75%, 60%)",
  社会: "hsl(30, 85%, 60%)",
  财经: "hsl(45, 85%, 55%)",
  科技: "hsl(200, 80%, 55%)",
  生活: "hsl(150, 60%, 50%)",
  娱乐: "hsl(280, 70%, 60%)",
  体育: "hsl(180, 70%, 50%)",
  其他: "hsl(0, 0%, 60%)",
};

/**
 * 词云停用词表（约 50 个中文高频虚词）
 * LLM 提取关键词时 prompt 已要求避免虚词，这里作为最后兜底过滤层。
 */
export const CHINESE_STOPWORDS = new Set<string>([
  "的", "了", "是", "在", "我", "有", "和", "就", "不", "人",
  "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去",
  "你", "会", "着", "没有", "看", "好", "自己", "这", "那", "里",
  "所以", "为", "吧", "什么", "让", "给", "把", "才", "与", "于",
  "对", "从", "及", "或", "但", "而", "其", "之", "此", "以",
]);

/**
 * 区块 C zero state 文案
 * - Phase 1 部署（Phase 2 未启）：annotatedRatio === 0，永远显示 Phase1 文案
 * - Phase 2 部署后：annotatedRatio < 0.7 时显示进度，>= 0.7 时直接显示数据
 */
export const ZERO_STATE_PHASE1 =
  "📊 内容分类与热门词云正在分析中，预计 24 小时内可见";

export const zeroStatePhase2 = (annotatedRatio: number): string =>
  `分析中（已完成 ${Math.round(annotatedRatio * 100)}%）`;
