import { invokeToolDirectly } from "@/lib/agent/tool-registry";
import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";

export interface CreationPlanTopicOption { title: string; heat?: string; source?: string; }

export type CreationGenre = "news" | "commentary" | "explainer" | "xiaohongshu" | "script";
export type CreationChannel = "wechat_mp" | "xiaohongshu" | "official_app" | "douyin";

export interface CreationPlan {
  topic: { title: string };
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

/** 体裁专属写作要求（按体裁切换 outline 主体要求，避免对小红书/口播稿强加"导语+正文"新闻结构）。 */
const GENRE_REQUIREMENT: Record<CreationGenre, string> = {
  news: "原创新闻/资讯稿件，含标题、导语、正文，观点清晰，有数据或案例支撑",
  commentary: "原创新闻/资讯稿件，含标题、导语、正文，观点清晰，有数据或案例支撑",
  explainer: "原创新闻/资讯稿件，含标题、导语、正文，观点清晰，有数据或案例支撑",
  xiaohongshu: "小红书种草文案：开头抓人、分点呈现、口语化、结尾带话题标签",
  script: "短视频口播脚本：短句、口播节奏、开头 3 秒抓人",
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
    `要求：${GENRE_REQUIREMENT[plan.genre]}；` +
    `**只使用检索到的真实资料，检索为空则如实说明、严禁从训练数据补填任何事实/日期/数据**。`;
  return { outline, style: GENRE_LABELS[plan.genre], maxLength: Math.max(plan.wordCount + 200, 600) };
}

const DEFAULT_CHANNEL: CreationChannel = "wechat_mp";

export async function buildCreationPlan(organizationId: string, userMessage: string): Promise<CreationPlan> {
  const preset = CHANNEL_PRESETS[DEFAULT_CHANNEL];
  // 1. 选题：今日热榜
  let topicOptions: CreationPlanTopicOption[] = [];
  let hotlistAvailable = false;
  const r = await invokeToolDirectly("trending_topics", { mode: "hot", limit: 10 }, { organizationId });
  if (r.ok) {
    const topics = ((r.result as { topics?: { title: string; heat?: unknown; platform?: string }[] }).topics) ?? [];
    topicOptions = topics.slice(0, 8).map((t) => ({
      title: t.title, heat: t.heat != null ? String(t.heat) : undefined, source: t.platform,
    }));
    hotlistAvailable = topicOptions.length > 0;
  }
  const top1 = topicOptions[0];
  // 2. 角度（仅在有选题时调 LLM；失败兜底固定句）
  let angle = "结合最新进展的深度解读";
  if (top1) {
    try {
      const { text } = await generateText({
        model: getLanguageModel({ provider: "openai", model: getDefaultModel(), temperature: 0.6, maxTokens: 60 }),
        prompt: `为热点「${top1.title}」给一个适合新媒体资讯稿的创作切入角度，一句话（≤20字），只输出这句话本身。`,
        maxOutputTokens: 60,
      });
      const a = text.trim().replace(/^["'「]|["'」]$/g, "");
      if (a) angle = a;
    } catch { /* 用兜底 angle */ }
  }
  // 3. 默认值
  // topicFromHotlist：是否已从热榜预选出一个选题（Top1 存在）。
  // hotlistAvailable：热榜服务本次是否返回了可选项。
  // 今天两者由同一来源推导（有选项必有 Top1），故同真同假；后续若允许"用户手填选题但热榜也可用"则会分叉。
  return {
    topic: { title: top1?.title ?? "" },
    topicOptions, topicFromHotlist: !!top1,
    angle, genre: preset.genre, channel: DEFAULT_CHANNEL, wordCount: preset.wordCount,
    illustrate: false, hotlistAvailable,
  };
}
