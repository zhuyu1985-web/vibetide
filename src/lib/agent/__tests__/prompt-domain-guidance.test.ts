import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompt-templates";
import type { AssembledAgent } from "../types";

const base = { name: "小刚", nickname: "小刚", title: "记者", authorityLevel: "advisor",
  tools: [], skillCategories: [], memories: [], proficiencyLevel: 50 } as unknown as AssembledAgent;

describe("Layer 4.5 领域口径包", () => {
  it("有 domainGuidance → 用专属口径", () => {
    const p = buildSystemPrompt({ ...base, domainGuidance: "不荐股；数据以证监会披露为准。" });
    expect(p).toContain("不荐股");
    expect(p).not.toContain("不说外行话"); // 通用模板被替代
  });

  it("无 domainGuidance 但有 domainTags → 回退现有通用模板", () => {
    const p = buildSystemPrompt({ ...base, domainTags: ["财经"] });
    expect(p).toContain("你专注于以下领域：财经");
    expect(p).toContain("不说外行话");
  });
});
