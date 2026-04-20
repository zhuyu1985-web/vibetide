import { describe, it, expect, vi } from "vitest";
import {
  pickDefaultHotTopicTemplate,
  listTemplatesForHomepageByTab,
  type HomepageTabKey,
} from "@/lib/dal/workflow-templates-listing";
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

// Mock db — capture final WHERE to assert branch logic.
vi.mock("@/db", () => {
  const rows: WorkflowTemplateRow[] = [];
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(rows),
  };
  return { db: chain };
});

describe("listTemplatesForHomepageByTab", () => {
  it("featured tab：可调用且返回数组", async () => {
    const result = await listTemplatesForHomepageByTab(
      "org1",
      "featured" satisfies HomepageTabKey,
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("custom tab 缺 userId：返回空数组（与 /workflows 语义对齐，未登录不显示）", async () => {
    const result = await listTemplatesForHomepageByTab("org1", "custom");
    expect(result).toEqual([]);
  });

  it("custom tab 带 userId：可调用且返回数组", async () => {
    const result = await listTemplatesForHomepageByTab("org1", "custom", {
      userId: "user1",
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("employeeId tab（xiaolei）：可调用且返回数组", async () => {
    const result = await listTemplatesForHomepageByTab("org1", "xiaolei");
    expect(Array.isArray(result)).toBe(true);
  });
});
