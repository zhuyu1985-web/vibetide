import { createOpenAI } from "@ai-sdk/openai";
import { zhipu } from "zhipu-ai-provider";
import type { LanguageModel } from "ai";
import type { SkillCategory } from "@/lib/types";
import type { ModelConfig, ModelProvider } from "./types";

// 2-min 超时 fetch 包装（DeepSeek / DashScope 等 OpenAI 兼容 client 共用）。
function timeoutFetch(): typeof globalThis.fetch {
  return (async (url: string, init?: RequestInit) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout
    try {
      return await globalThis.fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }) as typeof globalThis.fetch;
}

// Lazy-init clients（首次使用才建，确保 env 已加载）。
// Uses `compatibility: "compatible"` 隐含——SDK 调 /chat/completions（非 /responses）。
let _deepseek: ReturnType<typeof createOpenAI> | null = null;
function getDeepSeekClient() {
  if (!_deepseek) {
    _deepseek = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE_URL || "https://api.deepseek.com/v1",
      fetch: timeoutFetch(),
    });
  }
  return _deepseek;
}

// 阿里百炼 / 通义（DashScope OpenAI 兼容端点）。
let _dashscope: ReturnType<typeof createOpenAI> | null = null;
function getDashScopeClient() {
  if (!_dashscope) {
    _dashscope = createOpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      fetch: timeoutFetch(),
    });
  }
  return _dashscope;
}

/**
 * 平台默认 LLM provider，由 env `LLM_PROVIDER` 选择（按客户部署切换）。
 * openai(=DeepSeek 兼容，默认) | dashscope(阿里百炼/通义) | zhipu(智谱)。
 */
export function getActiveProvider(): ModelProvider {
  const p = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  if (["dashscope", "qwen", "tongyi", "bailian", "aliyun"].includes(p)) return "dashscope";
  if (p === "zhipu") return "zhipu";
  return "openai";
}

/** 活动 provider 的默认模型名（按 LLM_PROVIDER 取对应 *_MODEL）。 */
export function getDefaultModel(): string {
  const provider = getActiveProvider();
  if (provider === "dashscope") return process.env.DASHSCOPE_MODEL || "qwen-max";
  if (provider === "zhipu") return process.env.ZHIPU_MODEL || "glm-4";
  const model = process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error(
      "OPENAI_MODEL 未配置。请在 .env.local 设置 OPENAI_MODEL，或设 LLM_PROVIDER=dashscope + DASHSCOPE_MODEL 切到阿里百炼/通义。",
    );
  }
  return model;
}

// Default model per skill category — all use DeepSeek. Temperature tuned per
// scenario: creative/generative categories get higher temps, analytic/review
// categories stay low for determinism.
const CATEGORY_DEFAULTS: Record<SkillCategory, () => ModelConfig> = {
  web_search:       () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 4096 }),
  data_collection:  () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 4096 }),
  topic_planning:   () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.6, maxTokens: 4096 }),
  content_gen:      () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.7, maxTokens: 8192 }),
  av_script:        () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.7, maxTokens: 8192 }),
  quality_review:   () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.2, maxTokens: 4096 }),
  content_analysis: () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.4, maxTokens: 4096 }),
  data_analysis:    () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 4096 }),
  distribution:     () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 4096 }),
  other:            () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 4096 }),
};

/**
 * 按 skill slug 的细粒度 maxTokens / temperature override。
 * 用于让短输出类 skill（layout_design / headline_generate 等）跑得更快，
 * 不被宽泛的 category default 拖累。
 *
 * 新增条目时优先调整 maxTokens；其它字段（model / temperature）按需。
 */
export const SKILL_MODEL_OVERRIDES: Record<string, Partial<ModelConfig>> = {
  // layout_design 只产 layout schema（版式/字号/配图规则），不写正文。
  // 8192 token 是给正文类用的，layout 用 2048 已足够，能把这步从 60-120s 压到 15-25s。
  layout_design: { maxTokens: 2048 },
};

/**
 * 把 SKILL_MODEL_OVERRIDES 合并到 base config 上。
 * 没传 skillSlug 或没对应 override → 原样返回 base。
 */
export function applySkillOverride(
  base: ModelConfig,
  skillSlug?: string,
): ModelConfig {
  if (!skillSlug) return base;
  const override = SKILL_MODEL_OVERRIDES[skillSlug];
  if (!override) return base;
  return { ...base, ...override };
}

/**
 * Resolve model config by priority:
 * 1. Explicit override
 * 2. Primary skill category default
 */
export function resolveModelConfig(
  skillCategories: SkillCategory[],
  override?: Partial<ModelConfig>
): ModelConfig {
  const primaryCategory = skillCategories[0] ?? "content_gen";
  const factory = CATEGORY_DEFAULTS[primaryCategory] ?? CATEGORY_DEFAULTS.other;
  const base = factory();
  return { ...base, ...override };
}

/**
 * Convert ModelConfig to a Vercel AI SDK LanguageModel instance.
 */
export function getLanguageModel(config: ModelConfig): LanguageModel {
  // 显式指定 zhipu / dashscope 的，直接走对应 client。
  if (config.provider === "zhipu") return zhipu(config.model);
  if (config.provider === "dashscope") return getDashScopeClient().chat(config.model);
  // provider === "openai" = 平台默认 LLM 槽：按 LLM_PROVIDER 路由到活动 provider + 活动模型。
  // 默认 LLM_PROVIDER=openai → 仍走 DeepSeek（向后兼容，行为不变）。
  const active = getActiveProvider();
  if (active === "dashscope") return getDashScopeClient().chat(getDefaultModel());
  if (active === "zhipu") return zhipu(getDefaultModel());
  return getDeepSeekClient().chat(config.model);
}
