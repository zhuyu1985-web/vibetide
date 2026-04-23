import { describe, it, expect, vi } from "vitest";
import {
  pickDefaultHotTopicTemplate,
  listTemplatesForHomepageByTab,
  sortTemplatesForHomepageTab,
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

  // P0：org settings.defaultTemplates.hotTopic
  it("P0 pinnedTemplateId 命中时优先返回，跳过 P1/P2 默认", () => {
    const candidates = [
      mk({
        id: "default-breaking",
        ownerEmployeeId: "xiaolei",
        legacyScenarioKey: "breaking_news",
      }),
      mk({
        id: "pinned",
        ownerEmployeeId: "xiaolei",
        legacyScenarioKey: "national_hotspot",
        category: "news",
      }),
    ];
    expect(
      pickDefaultHotTopicTemplate(candidates, "pinned")?.id,
    ).toBe("pinned");
  });

  it("P0 允许 pin 自定义模板（isBuiltin=false 也接受）", () => {
    const candidates = [
      mk({
        id: "default-breaking",
        ownerEmployeeId: "xiaolei",
        legacyScenarioKey: "breaking_news",
      }),
      mk({
        id: "custom",
        ownerEmployeeId: null,
        category: "custom",
        isBuiltin: false,
      }),
    ];
    expect(
      pickDefaultHotTopicTemplate(candidates, "custom")?.id,
    ).toBe("custom");
  });

  it("P0 pinnedTemplateId 不存在时落回 P1/P2 默认", () => {
    const candidates = [
      mk({
        id: "default-breaking",
        ownerEmployeeId: "xiaolei",
        legacyScenarioKey: "breaking_news",
      }),
    ];
    expect(
      pickDefaultHotTopicTemplate(candidates, "ghost-id-not-here")?.id,
    ).toBe("default-breaking");
  });
});

// Mock db — capture final WHERE to assert branch logic.
vi.mock("@/db", () => {
  const rows: WorkflowTemplateRow[] = [];
  const chain: {
    select: () => typeof chain;
    from: () => typeof chain;
    leftJoin: () => typeof chain;
    where: () => Promise<WorkflowTemplateRow[]> & typeof chain;
    orderBy: () => Promise<WorkflowTemplateRow[]>;
    then: Promise<WorkflowTemplateRow[]>["then"];
  } = {
    select: () => chain,
    from: () => chain,
    leftJoin: () => chain,
    // `where` is thenable so the leftJoin branch (which doesn't call orderBy)
    // can resolve directly to the rows array.
    where: () => {
      const p = Promise.resolve(rows);
      return Object.assign(chain, {
        then: p.then.bind(p),
      }) as unknown as Promise<WorkflowTemplateRow[]> & typeof chain;
    },
    orderBy: () => Promise.resolve(rows),
    then: Promise.resolve(rows).then.bind(Promise.resolve(rows)),
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

describe("sortTemplatesForHomepageTab", () => {
  const mkOrder = (p: Partial<{ pinnedAt: Date | null; sortOrder: number }>) => ({
    pinnedAt: p.pinnedAt ?? null,
    sortOrder: p.sortOrder ?? 0,
  });

  it("置顶区（pinned_at DESC）排在非置顶区（sort_order ASC）前；未入表落末尾", () => {
    const rows = [
      { tpl: mk({ id: "a" }), order: mkOrder({ sortOrder: 0 }) },
      {
        tpl: mk({ id: "b" }),
        order: mkOrder({ pinnedAt: new Date("2026-04-01"), sortOrder: 999 }),
      },
      {
        tpl: mk({ id: "c" }),
        order: mkOrder({ pinnedAt: new Date("2026-04-20") }),
      },
      { tpl: mk({ id: "d" }), order: null },
    ];
    const sorted = sortTemplatesForHomepageTab(rows);
    expect(sorted.map((r) => r.tpl.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("未入表的行按 createdAt ASC 兜底", () => {
    const rows = [
      { tpl: mk({ id: "new2", createdAt: new Date("2026-04-20") }), order: null },
      { tpl: mk({ id: "new1", createdAt: new Date("2026-04-10") }), order: null },
    ];
    const sorted = sortTemplatesForHomepageTab(rows);
    expect(sorted.map((r) => r.tpl.id)).toEqual(["new1", "new2"]);
  });

  it("非置顶区内，sort_order 相同则 createdAt ASC 兜底", () => {
    const rows = [
      {
        tpl: mk({ id: "x", createdAt: new Date("2026-04-20") }),
        order: mkOrder({ sortOrder: 10 }),
      },
      {
        tpl: mk({ id: "y", createdAt: new Date("2026-04-10") }),
        order: mkOrder({ sortOrder: 10 }),
      },
    ];
    const sorted = sortTemplatesForHomepageTab(rows);
    expect(sorted.map((r) => r.tpl.id)).toEqual(["y", "x"]);
  });
});
