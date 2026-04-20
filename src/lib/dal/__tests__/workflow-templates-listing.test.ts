import { describe, it, expect } from "vitest";
import { pickDefaultHotTopicTemplate } from "@/lib/dal/workflow-templates-listing";
import type { WorkflowTemplateRow } from "@/db/types";

const mk = (p: Partial<WorkflowTemplateRow>): WorkflowTemplateRow =>
  ({
    id: p.id ?? "t1",
    organizationId: "org1",
    name: p.name ?? "x",
    description: null,
    steps: [],
    category: p.category ?? "custom",
    triggerType: "manual",
    triggerConfig: null,
    isBuiltin: p.isBuiltin ?? true,
    isEnabled: true,
    createdBy: null,
    lastRunAt: null,
    runCount: 0,
    icon: null,
    inputFields: [],
    defaultTeam: [],
    appChannelSlug: null,
    systemInstruction: null,
    legacyScenarioKey: p.legacyScenarioKey ?? null,
    content: "",
    isPublic: p.isPublic ?? true,
    ownerEmployeeId: p.ownerEmployeeId ?? null,
    launchMode: "form",
    promptTemplate: null,
    createdAt: p.createdAt ?? new Date(),
    updatedAt: new Date(),
  }) as unknown as WorkflowTemplateRow;

describe("pickDefaultHotTopicTemplate", () => {
  it("优先选 xiaolei + legacy_scenario_key=breaking_news", () => {
    const candidates = [
      mk({ id: "a", ownerEmployeeId: "xiaolei", category: "news" }),
      mk({
        id: "b",
        ownerEmployeeId: "xiaolei",
        legacyScenarioKey: "breaking_news",
        category: "news",
      }),
      mk({ id: "c", ownerEmployeeId: "xiaoce", category: "news" }),
    ];
    expect(pickDefaultHotTopicTemplate(candidates)?.id).toBe("b");
  });

  it("fallback 到 xiaolei + category=news", () => {
    const candidates = [
      mk({ id: "a", ownerEmployeeId: "xiaoce", category: "news" }),
      mk({ id: "b", ownerEmployeeId: "xiaolei", category: "news" }),
    ];
    expect(pickDefaultHotTopicTemplate(candidates)?.id).toBe("b");
  });

  it("两规则都不匹配时返回 null", () => {
    const candidates = [
      mk({ ownerEmployeeId: "xiaoce", category: "social" }),
    ];
    expect(pickDefaultHotTopicTemplate(candidates)).toBeNull();
  });

  it("多个命中 priority 1 时按 createdAt 升序取最早", () => {
    const old = mk({
      id: "old",
      ownerEmployeeId: "xiaolei",
      legacyScenarioKey: "breaking_news",
      createdAt: new Date("2026-01-01"),
    });
    const newer = mk({
      id: "new",
      ownerEmployeeId: "xiaolei",
      legacyScenarioKey: "breaking_news",
      createdAt: new Date("2026-04-01"),
    });
    expect(pickDefaultHotTopicTemplate([newer, old])?.id).toBe("old");
  });
});
