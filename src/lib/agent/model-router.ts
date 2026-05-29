import { createOpenAI } from "@ai-sdk/openai";
import { zhipu } from "zhipu-ai-provider";
import type { LanguageModel } from "ai";
import type { SkillCategory } from "@/lib/types";
import type { ModelConfig } from "./types";

// Lazy-init: create the DeepSeek client on first use so env vars are guaranteed loaded.
// Uses `compatibility: "compatible"` so the SDK calls /chat/completions (not /responses).
let _deepseek: ReturnType<typeof createOpenAI> | null = null;

function getDeepSeekClient() {
  if (!_deepseek) {
    const baseURL = process.env.OPENAI_API_BASE_URL || "https://api.deepseek.com/v1";
    const apiKey = process.env.OPENAI_API_KEY;
    _deepseek = createOpenAI({
      apiKey,
      baseURL,
      fetch: async (url, init) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout
        try {
          return await globalThis.fetch(url as string, { ...init as RequestInit, signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
      },
    });
  }
  return _deepseek;
}

function getDefaultModel() {
  const model = process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error("OPENAI_MODEL 未配置。请在 .env.local 中设置 OPENAI_MODEL=qwen3-max");
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
  if (config.provider === "zhipu") {
    return zhipu(config.model);
  }
  return getDeepSeekClient().chat(config.model);
}
