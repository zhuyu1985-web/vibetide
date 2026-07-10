import { describe, it, expect } from "vitest";
import { toIntentChipView } from "../intent-chip-view";
import type { IntentResult } from "@/lib/agent/types";

function makeIntent(over: Partial<IntentResult>): IntentResult {
  return {
    intentType: "general_chat",
    summary: "",
    confidence: 0.9,
    steps: [],
    reasoning: "",
    ...over,
  } as IntentResult;
}

describe("toIntentChipView", () => {
  it("返回 intentType 中文 label", () => {
    const v = toIntentChipView(makeIntent({ intentType: "content_creation" }));
    expect(v.typeLabel).toBe("内容创作");
  });

  it("从 steps 提取派单员工（去重、保序）", () => {
    const v = toIntentChipView(
      makeIntent({
        intentType: "media_production",
        steps: [
          { employeeSlug: "xiaofa", employeeName: "渠道运营师", skills: [], taskDescription: "" },
          { employeeSlug: "xiaofa", employeeName: "渠道运营师", skills: [], taskDescription: "" },
          { employeeSlug: "xiaojian", employeeName: "剪辑师", skills: [], taskDescription: "" },
        ],
      } as Partial<IntentResult>),
    );
    expect(v.employees.map((e) => e.slug)).toEqual(["xiaofa", "xiaojian"]);
  });

  it("低置信度标记 tentative，且 general_chat 无派单员工", () => {
    const v = toIntentChipView(makeIntent({ intentType: "general_chat", confidence: 0.3 }));
    expect(v.tentative).toBe(true);
    expect(v.employees).toEqual([]);
  });

  it("未知 intentType 回退原值", () => {
    const v = toIntentChipView(makeIntent({ intentType: "weird_type" as never }));
    expect(v.typeLabel).toBe("weird_type");
  });
});
