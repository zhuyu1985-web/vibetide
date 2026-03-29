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
  return process.env.OPENAI_MODEL || "deepseek-chat";
}

// Default model per skill category — all use DeepSeek
const CATEGORY_DEFAULTS: Record<SkillCategory, () => ModelConfig> = {
  perception: () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 4096 }),
  analysis:   () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.4, maxTokens: 4096 }),
  generation: () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.7, maxTokens: 8192 }),
  production: () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 4096 }),
  management: () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.3, maxTokens: 4096 }),
  knowledge:  () => ({ provider: "openai", model: getDefaultModel(), temperature: 0.2, maxTokens: 4096 }),
};

/**
 * Resolve model config by priority:
 * 1. Explicit override
 * 2. Primary skill category default
 */
export function resolveModelConfig(
  skillCategories: SkillCategory[],
  override?: Partial<ModelConfig>
): ModelConfig {
  const primaryCategory = skillCategories[0] ?? "generation";
  const base = CATEGORY_DEFAULTS[primaryCategory]();
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
