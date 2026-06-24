import { invokeToolDirectly } from "@/lib/agent/tool-registry";
import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";
import {
  type CreationChannel,
  type CreationPlan,
  type CreationPlanTopicOption,
  CHANNEL_PRESETS,
} from "@/lib/cowork/creation-plan-types";

// Re-export 客户端安全的类型与纯函数，保持既有 `@/lib/cowork/creation-plan` 导入路径不变。
// 客户端组件应直接 import `@/lib/cowork/creation-plan-types`（避免把本文件的 server-only
// 依赖 tool-registry/model-router/ai 拖进客户端 bundle）。
export * from "@/lib/cowork/creation-plan-types";

const DEFAULT_CHANNEL: CreationChannel = "wechat_mp";

export async function buildCreationPlan(
  organizationId: string,
  userMessage: string,
): Promise<CreationPlan> {
  void userMessage;
  const preset = CHANNEL_PRESETS[DEFAULT_CHANNEL];
  // 1. 选题：今日热榜
  let topicOptions: CreationPlanTopicOption[] = [];
  let hotlistAvailable = false;
  const r = await invokeToolDirectly(
    "trending_topics",
    { mode: "hot", limit: 10 },
    { organizationId },
  );
  if (r.ok) {
    const topics =
      (
        r.result as {
          topics?: { title: string; heat?: unknown; platform?: string }[];
        }
      ).topics ?? [];
    topicOptions = topics.slice(0, 8).map((t) => ({
      title: t.title,
      heat: t.heat != null ? String(t.heat) : undefined,
      source: t.platform,
    }));
    hotlistAvailable = topicOptions.length > 0;
  }
  const top1 = topicOptions[0];
  // 2. 角度（仅在有选题时调 LLM；失败兜底固定句）
  let angle = "结合最新进展的深度解读";
  if (top1) {
    try {
      const { text } = await generateText({
        model: getLanguageModel({
          provider: "openai",
          model: getDefaultModel(),
          temperature: 0.6,
          maxTokens: 60,
        }),
        prompt: `为热点「${top1.title}」给一个适合新媒体资讯稿的创作切入角度，一句话（≤20字），只输出这句话本身。`,
        maxOutputTokens: 60,
      });
      const a = text.trim().replace(/^["'「]|["'」]$/g, "");
      if (a) angle = a;
    } catch {
      /* 用兜底 angle */
    }
  }
  // 3. 默认值
  // topicFromHotlist：是否已从热榜预选出一个选题（Top1 存在）。
  // hotlistAvailable：热榜服务本次是否返回了可选项。
  // 今天两者由同一来源推导（有选项必有 Top1），故同真同假；后续若允许“用户手填选题但热榜也可用”则会分叉。
  return {
    topic: { title: top1?.title ?? "" },
    topicOptions,
    topicFromHotlist: !!top1,
    angle,
    genre: preset.genre,
    channel: DEFAULT_CHANNEL,
    wordCount: preset.wordCount,
    illustrate: false,
    hotlistAvailable,
  };
}
