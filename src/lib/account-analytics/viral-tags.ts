/**
 * Viral Tags — 社交媒体爆款内容归因标签字典。
 *
 * 用途：
 * 1. LLM 生成 viral_content_attributions 时作为 prompt 约束词表，
 *    避免标签发散。
 * 2. UI 上 RankingCard 的 tag 气泡展示。
 * 3. 后续做"按标签筛选爆款"时的过滤器选项。
 *
 * 设计原则：
 * - 5 大类（叙事 / 情感 / 议题 / 角色 / 结构），共 26 个标签。
 * - tag 是开放字符串数组存 jsonb —— 允许 LLM 在 prompt 里生成
 *   未在字典中的新标签后人工沉淀回字典。
 * - tag 文案保持中文 4-6 字，与 HTML 样张视觉对齐。
 */

export type ViralTagCategory =
  | "narrative" // 叙事
  | "emotion" // 情感
  | "topic" // 议题
  | "role" // 角色
  | "structure"; // 结构

export interface ViralTag {
  label: string;
  category: ViralTagCategory;
  description: string;
}

export const VIRAL_TAGS: ViralTag[] = [
  // ── 叙事类 ──
  { label: "道德叙事", category: "narrative", description: "通过道德判断引发集体共鸣" },
  { label: "反转型", category: "narrative", description: "情节反转制造惊喜或喜剧效果" },
  { label: "悬念叙事", category: "narrative", description: "标题或开场设置悬念引发点击" },
  { label: "神回复", category: "narrative", description: "评论区或当事人神级接话出圈" },
  { label: "反差萌", category: "narrative", description: "身份与行为反差引发萌点" },
  { label: "凡尔赛", category: "narrative", description: "凡尔赛式炫耀引发讨论" },

  // ── 情感类 ──
  { label: "情绪触发", category: "emotion", description: "强情绪点（愤怒/感动/惊讶）" },
  { label: "情感共鸣", category: "emotion", description: "击中目标受众普遍情感" },
  { label: "人文关怀", category: "emotion", description: "弱势群体或社会温情" },
  { label: "反差激励", category: "emotion", description: "逆境奋斗或反差成长" },
  { label: "松弛感", category: "emotion", description: "轻松自然，反精致主义" },
  { label: "亲子教育", category: "emotion", description: "家庭/教育场景，家长群体共鸣" },

  // ── 议题类 ──
  { label: "社会议题", category: "topic", description: "公共政策、社会问题、民生话题" },
  { label: "节点热点", category: "topic", description: "节日/纪念日/重大事件节点" },
  { label: "跨平台", category: "topic", description: "话题在多平台同时引爆" },
  { label: "公共关切", category: "topic", description: "与公众切身利益相关" },

  // ── 角色类 ──
  { label: "体育明星", category: "role", description: "体育运动员/教练登场" },
  { label: "体育竞技", category: "role", description: "比赛瞬间、技术动作、赛事高光" },
  { label: "团队凝聚", category: "role", description: "团队协作、集体荣誉" },
  { label: "名人效应", category: "role", description: "名人/明星/权威人士出镜" },

  // ── 结构类 ──
  { label: "强互动", category: "structure", description: "评论区炸开、用户主动 UGC" },
  { label: "选题精准", category: "structure", description: "选题踩中目标受众痛点" },
  { label: "幕后细节", category: "structure", description: "披露幕后细节增加可信度" },
  { label: "利他转发", category: "structure", description: "用户为提醒亲友而转发" },
  { label: "评论驱动", category: "structure", description: "评论质量驱动二次传播" },
  { label: "时机精准", category: "structure", description: "发布时间精准匹配受众活跃窗口" },
];

export const VIRAL_TAG_CATEGORY_LABELS: Record<ViralTagCategory, string> = {
  narrative: "叙事类",
  emotion: "情感类",
  topic: "议题类",
  role: "角色类",
  structure: "结构类",
};

/**
 * LLM prompt 用：拼成"标签1（描述）/ 标签2（描述）"格式的字符串，便于
 * 在 system prompt 里告诉模型可选词表。
 */
export function viralTagsPromptHint(): string {
  return VIRAL_TAGS.map((t) => `${t.label}（${t.description}）`).join(" / ");
}

/**
 * UI 渲染用：按 category 分组。
 */
export function groupViralTagsByCategory(): Record<ViralTagCategory, ViralTag[]> {
  const grouped: Record<ViralTagCategory, ViralTag[]> = {
    narrative: [],
    emotion: [],
    topic: [],
    role: [],
    structure: [],
  };
  for (const tag of VIRAL_TAGS) {
    grouped[tag.category].push(tag);
  }
  return grouped;
}
