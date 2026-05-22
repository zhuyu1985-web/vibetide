/**
 * channel_rewrite — 单篇稿件按目标社媒平台做风格化改写
 *
 * 输入一篇中文稿件 + platform slug，输出按该平台调性改写后的版本：
 *   - 微信公众号（wechat_oa）：长文 / 正式 / 段落分明，标题不夸张
 *   - 微博（weibo）：≤140 字精炼，hashtag + emoji + 钩子句开头
 *   - 抖音（douyin）：短句口语化，hook → 正文 → CTA
 *   - 小红书（xiaohongshu）：第一人称种草语气，emoji 多
 *   - 知乎（zhihu）：干货 / 论证 / 数据支撑
 *   - 头条（toutiao）：数字标题，短句，强情绪
 *
 * AI SDK v6 — `generateText({ output: Output.object({ schema }) })`
 *
 * Spec: /Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §数据层 §channel_rewrite
 */

import { generateText, Output } from "ai";
import { z } from "zod/v4";
import { getLanguageModel, resolveModelConfig } from "../model-router";

// ---------------------------------------------------------------------------
// 平台 + Zod schema
// ---------------------------------------------------------------------------

export const CHANNEL_PLATFORMS = [
  "wechat_oa",
  "weibo",
  "douyin",
  "xiaohongshu",
  "zhihu",
  "toutiao",
  "kuaishou",
  "bilibili",
] as const;
export type ChannelPlatform = (typeof CHANNEL_PLATFORMS)[number];

const ChannelRewriteOutputSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(10),
  summary: z.string().max(300).optional(),
  hashtags: z.array(z.string().min(2).max(40)).min(0).max(10),
  /** 平台特定提示（如微信封面建议 / 抖音 challenge / 微博话题） */
  extraFields: z.record(z.string(), z.unknown()).optional(),
});

export type ChannelRewriteResult = z.infer<typeof ChannelRewriteOutputSchema>;

export interface ChannelRewriteInput {
  article: {
    title: string;
    body: string;
    summary?: string;
  };
  platform: string; // 容忍未来扩展平台 slug
}

// ---------------------------------------------------------------------------
// 各平台风格 prompt
// ---------------------------------------------------------------------------

interface PlatformProfile {
  name: string;
  toneRules: string;
  titleConstraints: string;
  bodyConstraints: string;
  hashtagAdvice: string;
  extraFieldsHint: string;
}

const PLATFORM_PROFILES: Record<ChannelPlatform, PlatformProfile> = {
  wechat_oa: {
    name: "微信公众号",
    toneRules:
      "正式、有信息密度、长文友好。可以分小标题。避免极端情绪和标题党。注重逻辑递进。",
    titleConstraints:
      "≤32 字符。不夸张、不全大写、不堆叠 emoji。可以用「为什么 / 如何 / 一图看懂」类引导。",
    bodyConstraints:
      "段落分明（每段 60-150 字），可加小标题（用 ## 标记）。语气客观，第三人称。开头用一句话点题，结尾可加一句行动呼吁。",
    hashtagAdvice: "0-3 个，写成普通词不要带 # 号。",
    extraFieldsHint:
      "extraFields 可填：authorOverride（作者署名）、coverType（'image'|'text'）、recommendedTags（推荐栏目）。",
  },
  weibo: {
    name: "微博",
    toneRules: "短而冲击力强，钩子句开头，多用 emoji。",
    titleConstraints: "本平台不分标题正文，把第一句当标题，约 20-30 字。",
    bodyConstraints:
      "总长度 ≤140 字（含 hashtag）。钩子 → 核心信息 → 钩子句结尾。emoji 适量。",
    hashtagAdvice: "3-5 个，用 #话题# 双井号样式，热度高的优先。",
    extraFieldsHint: "extraFields 可填：topics（[]，含 # 号的话题）、replyStrategy。",
  },
  douyin: {
    name: "抖音",
    toneRules: "口语化、节奏快、强情绪、强 CTA（call to action）。",
    titleConstraints: "≤55 字符，第一句必须抓人，可设悬念。",
    bodyConstraints:
      "正文 = 视频文案，分 3 段：hook（前 3 秒抓人）→ 正文（信息点）→ CTA（'记得关注 / 点赞 / 在评论里聊聊'）。每段独立成行。",
    hashtagAdvice: "5-8 个，挂主题 + 流量标签（如 #涨知识 #干货分享）。",
    extraFieldsHint:
      "extraFields 可填：challengeIds（挑战赛 id 数组）、atUsers（@用户）、bgmHint（背景音乐建议）。",
  },
  xiaohongshu: {
    name: "小红书",
    toneRules:
      "第一人称、种草语气、有故事感、emoji 丰富、女性视角友好。避免硬广和说教。",
    titleConstraints:
      "≤30 字符。emoji 开头很常见（🔥💯⚠️），可以用「亲测/真的/震惊」等钩子词。",
    bodyConstraints:
      "正文短段落 + emoji 点缀。「先讲场景 → 我的体验 → 推荐理由 → 给小伙伴的建议」结构。结尾可邀请评论。",
    hashtagAdvice: "5-8 个，挂相关品类 + 兴趣词。",
    extraFieldsHint: "extraFields 可填：noteType（'image_text'|'video'）、geoTag（地点标签）。",
  },
  zhihu: {
    name: "知乎",
    toneRules:
      "理性、有论据、数据支撑、避免情绪化。可写成回答体（你这个问题，我从 X 角度看……）。",
    titleConstraints: "≤50 字符，可以提问形式（如何 / 为什么 / 是否）。",
    bodyConstraints:
      "段落较长（每段 100-200 字），有数据 / 引用 / 案例。可分 1) 2) 3) 论点。结尾给出结论或开放性提问。",
    hashtagAdvice: "0-3 个，作为话题词写入正文末尾，不带 # 号。",
    extraFieldsHint: "extraFields 可填：questionId（关联问题 id）、columnId（专栏 id）。",
  },
  toutiao: {
    name: "今日头条",
    toneRules: "标题党节奏（但守底线），短句，强情绪，数字 + 反差。",
    titleConstraints:
      "≤30 字符。常用「揭秘 / 太惊人 / 没想到 / 5 个真相」。含数字提升点击率。",
    bodyConstraints:
      "短段落（30-80 字每段），口语化，多设小钩子让用户继续往下读。",
    hashtagAdvice: "0-3 个，挂热门关键词。",
    extraFieldsHint: "extraFields 可填：channelHint（推荐头条频道，如「财经」「社会」）。",
  },
  kuaishou: {
    name: "快手",
    toneRules: "接地气、口语化、地域感强、强情感共鸣。",
    titleConstraints: "≤55 字符，第一句抓人，可有方言感。",
    bodyConstraints:
      "正文 = 视频文案，hook + 正文 + CTA。比抖音更朴素，少 emoji。",
    hashtagAdvice: "3-6 个，挂老铁圈关键词。",
    extraFieldsHint: "extraFields 可填：locationHint（地域标签）、interactionHint（互动方式建议）。",
  },
  bilibili: {
    name: "B 站",
    toneRules:
      "对二次元友好，可用网络梗，但不要过度。理性 + 有趣并存，避免说教。",
    titleConstraints:
      "≤80 字符，可以用「【】」开头标分类（如【深度】【硬核】【吐槽】）。",
    bodyConstraints:
      "正文 = 视频简介。开头一句钩子，中间列要点，末尾留互动钩子（求一键三连）。",
    hashtagAdvice: "0 个（B 站简介不用 hashtag，标签放 tags 字段）。",
    extraFieldsHint:
      "extraFields 可填：tags（B 站标签数组，最多 10 个）、partition（分区如「知识区」）。",
  },
};

function isKnownPlatform(p: string): p is ChannelPlatform {
  return (CHANNEL_PLATFORMS as readonly string[]).includes(p);
}

function buildSystemPrompt(platform: string): string {
  if (!isKnownPlatform(platform)) {
    return `你是「跨渠道改写员」，目标平台是「${platform}」（未列入预设清单），请用通用社媒风格改写：标题精炼、正文有钩子、hashtags 3-5 个。严格按 schema 输出 JSON。`;
  }
  const p = PLATFORM_PROFILES[platform];
  return `你是「跨渠道改写员」，把中文稿件改写成发布在【${p.name}】的版本。

**整体语气：**
${p.toneRules}

**标题规则：**
${p.titleConstraints}

**正文规则：**
${p.bodyConstraints}

**hashtags：**
${p.hashtagAdvice}

**extraFields：**
${p.extraFieldsHint}

**通用要求：**
- 不许新增原稿没有的事实。数字 / 时间 / 地点必须保留准确。
- 模糊表达（如「很多人」「最近」）不要瞎写成「千万级 / 上百万」等具体数字。
- 严格按 schema 输出 JSON，不要附加任何解释文字。`;
}

// ---------------------------------------------------------------------------
// Skill function
// ---------------------------------------------------------------------------

/**
 * 把单篇稿件按目标平台改写。
 *
 * @example
 * const out = await channelRewriteArticle({
 *   article: { title: "...", body: "...", summary: "..." },
 *   platform: "wechat_oa",
 * });
 * // out = { title, body, hashtags, summary?, extraFields }
 */
export async function channelRewriteArticle(
  input: ChannelRewriteInput,
): Promise<ChannelRewriteResult> {
  if (!input.article.title && !input.article.body) {
    throw new Error("channel_rewrite: 输入文章必须至少有 title 或 body");
  }

  const userPayload = JSON.stringify({
    platform: input.platform,
    article: {
      title: input.article.title,
      body: input.article.body,
      summary: input.article.summary ?? null,
    },
  });

  const modelConfig = resolveModelConfig(["content_gen"], {
    temperature: 0.7,
    maxTokens: 4096,
  });

  const { output } = await generateText({
    model: getLanguageModel(modelConfig),
    system: buildSystemPrompt(input.platform),
    prompt: userPayload,
    output: Output.object({ schema: ChannelRewriteOutputSchema }),
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
  });

  return output;
}
