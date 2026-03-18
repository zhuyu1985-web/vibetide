import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { zhipu } from "zhipu-ai-provider";
import type { LanguageModel } from "ai";
import type { SkillCategory } from "@/lib/types";
import type { ModelConfig } from "./types";

// Default model per skill category
const CATEGORY_DEFAULTS: Record<SkillCategory, ModelConfig> = {
  perception: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 4096,
  },
  analysis: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    temperature: 0.4,
    maxTokens: 4096,
  },
  generation: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    temperature: 0.7,
    maxTokens: 8192,
  },
  production: {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.3,
    maxTokens: 4096,
  },
  management: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    temperature: 0.3,
    maxTokens: 4096,
  },
  knowledge: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 4096,
  },
};

/**
 * Resolve model config by priority:
 * 1. Explicit override (from DB employee config or step config)
 * 2. Primary skill category default
 * 3. Fallback to anthropic claude-sonnet
 */
export function resolveModelConfig(
  skillCategories: SkillCategory[],
  override?: Partial<ModelConfig>
): ModelConfig {
  const primaryCategory = skillCategories[0] ?? "generation";
  const base = CATEGORY_DEFAULTS[primaryCategory];
  return { ...base, ...override };
}

/**
 * Convert ModelConfig to a Vercel AI SDK LanguageModel instance.
 */
export function getLanguageModel(config: ModelConfig): LanguageModel {
  if (config.provider === "anthropic") {
    return anthropic(config.model);
  }
  if (config.provider === "zhipu") {
    return zhipu(config.model);
  }
  return openai(config.model);
}
