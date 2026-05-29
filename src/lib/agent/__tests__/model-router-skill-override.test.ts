import { describe, it, expect } from "vitest";
import { applySkillOverride, SKILL_MODEL_OVERRIDES } from "../model-router";
import type { ModelConfig } from "../types";

const baseConfig: ModelConfig = {
  provider: "openai",
  model: "qwen3-max",
  temperature: 0.7,
  maxTokens: 8192,
};

describe("applySkillOverride", () => {
  it("不传 skillSlug → 返回 base config 不变", () => {
    const result = applySkillOverride(baseConfig);
    expect(result).toEqual(baseConfig);
  });

  it("传 layout_design → maxTokens 降到 2048，其它字段保留", () => {
    const result = applySkillOverride(baseConfig, "layout_design");
    expect(result.maxTokens).toBe(2048);
    expect(result.model).toBe("qwen3-max");
    expect(result.temperature).toBe(0.7);
    expect(result.provider).toBe("openai");
  });

  it("未知 skillSlug → 返回 base config 不变", () => {
    const result = applySkillOverride(baseConfig, "nonexistent_skill");
    expect(result).toEqual(baseConfig);
  });

  it("SKILL_MODEL_OVERRIDES 至少包含 layout_design", () => {
    expect(SKILL_MODEL_OVERRIDES.layout_design).toBeDefined();
    expect(SKILL_MODEL_OVERRIDES.layout_design.maxTokens).toBe(2048);
  });
});
