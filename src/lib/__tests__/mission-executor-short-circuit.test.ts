import { describe, it, expect } from "vitest";
import { renderStepParameters } from "../mission-executor";

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
