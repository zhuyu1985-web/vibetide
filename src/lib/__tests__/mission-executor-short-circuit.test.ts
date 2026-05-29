import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderStepParameters, getNestedField } from "../mission-executor";

describe("renderStepParameters", () => {
  it("从 mission.inputParams 取 primitive string", () => {
    const rendered = renderStepParameters(
      { mode: "hot", limit: "{{topic_limit}}" },
      { inputParams: { topic_limit: 30 } } as never,
      [],
    );
    expect(rendered).toEqual({ mode: "hot", limit: "30" });
  });

  it("从 previousSteps 引用 step1.topics array (JSON-parsed)", () => {
    const rendered = renderStepParameters(
      { topics: "{{step1.topics}}" },
      { inputParams: {} } as never,
      [
        { outputData: { topics: [{ id: "t1", title: "A" }] } } as never,
      ],
    );
    expect(rendered.topics).toEqual([{ id: "t1", title: "A" }]);
  });

  it("从 mission.inputParams 取 array (JSON.stringify 后再 parse)", () => {
    const rendered = renderStepParameters(
      { categories: "{{categories}}" },
      { inputParams: { categories: [{ value: "food", label: "美食" }] } } as never,
      [],
    );
    expect(rendered.categories).toEqual([{ value: "food", label: "美食" }]);
  });

  it("primitive string 不被 JSON.parse fallthrough", () => {
    const rendered = renderStepParameters(
      { mode: "hot" },
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.mode).toBe("hot");
  });

  it("{{key}} 解析失败 → 保留空字符串", () => {
    const rendered = renderStepParameters(
      { foo: "{{missing_key}}" },
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.foo).toBe("");
  });

  it("{{stepN.field}} N 越界 → 保留空字符串", () => {
    const rendered = renderStepParameters(
      { foo: "{{step9.topics}}" },
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.foo).toBe("");
  });
});

describe("renderStepParameters with real-world StepOutput shape", () => {
  it("从 StepOutput 含 topics 字段能取到 (verify A.1.2.5 fix)", () => {
    // Mock production-like previousSteps shape: StepOutput with extra fields
    const previousSteps = [
      {
        outputData: {
          stepKey: "task-1",
          employeeSlug: "xiaolei",
          summary: "拉到 30 条",
          artifacts: [],
          metrics: {},
          status: "success",
          topics: [{ id: "t1", title: "X" }], // 额外字段，A.1.2.5 修后应保留
        },
      },
    ];
    const rendered = renderStepParameters(
      { topics: "{{step1.topics}}" },
      { inputParams: {} } as never,
      previousSteps,
    );
    expect(rendered.topics).toEqual([{ id: "t1", title: "X" }]);
  });
});

describe("renderStepParameters — nested path (dotted)", () => {
  // 抑制 console.warn 噪音（路径解不通的 case 会触发）
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("数组下标：{{step1.created.0.articleId}}", () => {
    const rendered = renderStepParameters(
      { articleId: "{{step1.created.0.articleId}}" },
      { inputParams: null },
      [{ outputData: { created: [{ articleId: "art-1" }, { articleId: "art-2" }] } }],
    );
    expect(rendered.articleId).toBe("art-1");
  });

  it("数组下标 + 第二项：{{step1.created.1.articleId}}", () => {
    const rendered = renderStepParameters(
      { articleId: "{{step1.created.1.articleId}}" },
      { inputParams: null },
      [{ outputData: { created: [{ articleId: "art-1" }, { articleId: "art-2" }] } }],
    );
    expect(rendered.articleId).toBe("art-2");
  });

  it("纯嵌套对象：{{step1.meta.user.name}}", () => {
    const rendered = renderStepParameters(
      { name: "{{step1.meta.user.name}}" },
      { inputParams: null },
      [{ outputData: { meta: { user: { name: "Alice" } } } }],
    );
    expect(rendered.name).toBe("Alice");
  });

  it("混合：{{step1.results.0.tags.2}}", () => {
    const rendered = renderStepParameters(
      { tag: "{{step1.results.0.tags.2}}" },
      { inputParams: null },
      [{ outputData: { results: [{ tags: ["a", "b", "c", "d"] }] } }],
    );
    expect(rendered.tag).toBe("c");
  });

  it("路径解不通 → 空字符串 fallback（不抛）", () => {
    const rendered = renderStepParameters(
      { x: "{{step1.foo.bar.baz}}" },
      { inputParams: null },
      [{ outputData: { other: "x" } }],
    );
    expect(rendered.x).toBe("");
  });

  it("数组越界 → 空字符串 fallback", () => {
    const rendered = renderStepParameters(
      { x: "{{step1.created.99.articleId}}" },
      { inputParams: null },
      [{ outputData: { created: [{ articleId: "art-1" }] } }],
    );
    expect(rendered.x).toBe("");
  });

  it("顶层 key 仍兼容（不带点）", () => {
    const rendered = renderStepParameters(
      { x: "{{step1.results}}" },
      { inputParams: null },
      [{ outputData: { results: ["a", "b"] } }],
    );
    expect(rendered.x).toEqual(["a", "b"]);
  });

  it("数组中含数字字段名时按数字优先解析为 index", () => {
    const rendered = renderStepParameters(
      { x: "{{step1.arr.0}}" },
      { inputParams: null },
      [{ outputData: { arr: ["alpha", "beta"] } }],
    );
    expect(rendered.x).toBe("alpha");
  });
});

describe("getNestedField — 独立单测", () => {
  it("undefined 输入 → undefined", () => {
    expect(getNestedField(undefined, "a.b")).toBeUndefined();
  });

  it("解到 primitive 后继续访问 → undefined", () => {
    expect(getNestedField({ a: 1 }, "a.b")).toBeUndefined();
  });
});
