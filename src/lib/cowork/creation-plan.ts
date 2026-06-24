export interface CreationPlanTopicOption { topicId?: string; title: string; heat?: string; source?: string; }

export type CreationGenre = "news" | "commentary" | "explainer" | "xiaohongshu" | "script";
export type CreationChannel = "wechat_mp" | "xiaohongshu" | "official_app" | "douyin";

export interface CreationPlan {
  topic: { title: string; topicId?: string };
  topicOptions: CreationPlanTopicOption[];
  topicFromHotlist: boolean;
  angle: string;
  genre: CreationGenre;
  channel: CreationChannel;
  wordCount: number;
  purpose?: string;
  illustrate: boolean;
  hotlistAvailable: boolean;
}

export const CHANNEL_PRESETS: Record<CreationChannel, {
  label: string; genre: CreationGenre; wordCount: number; styleHint: string;
}> = {
  wechat_mp:    { label: "微信公众号", genre: "news",        wordCount: 1000, styleHint: "客观、有小标题、段落完整" },
  xiaohongshu:  { label: "小红书",     genre: "xiaohongshu", wordCount: 400,  styleHint: "口语化、适度 emoji、分点、结尾带话题标签" },
  official_app: { label: "官网/App",   genre: "news",        wordCount: 1200, styleHint: "正式、规范、可含信源标注" },
  douyin:       { label: "抖音",       genre: "script",      wordCount: 500,  styleHint: "口播脚本、短句、开头抓人" },
};

export const GENRE_LABELS: Record<CreationGenre, string> = {
  news: "新闻消息", commentary: "深度评论", explainer: "大众解读", xiaohongshu: "小红书种草", script: "口播脚本",
};

export function defaultPlanForChannel(channel: CreationChannel): Pick<CreationPlan, "genre" | "wordCount"> {
  const p = CHANNEL_PRESETS[channel];
  return { genre: p.genre, wordCount: p.wordCount };
}

/** 计划 → content_generate 入参（outline 注入选题/角度/渠道适配/字数；style 取渠道风格提示）。 */
export function planToGenerateParams(plan: CreationPlan): { outline: string; style: string; maxLength: number } {
  const preset = CHANNEL_PRESETS[plan.channel];
  const outline =
    `热点选题：${plan.topic.title}\n` +
    `创作角度：${plan.angle}\n` +
    `体裁：${GENRE_LABELS[plan.genre]}\n` +
    `目标渠道：${preset.label}（风格要求：${preset.styleHint}）\n` +
    `目标字数：约 ${plan.wordCount} 字\n` +
    (plan.purpose ? `用途：${plan.purpose}\n` : "") +
    `要求：原创新闻/资讯稿件，含标题、导语、正文，观点清晰，有数据或案例支撑；` +
    `**只使用检索到的真实资料，检索为空则如实说明、严禁从训练数据补填任何事实/日期/数据**。`;
  return { outline, style: plan.genre, maxLength: Math.max(plan.wordCount + 200, 600) };
}
