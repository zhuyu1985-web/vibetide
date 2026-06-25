import { describe, it, expect } from "vitest";
import { suggestInputs } from "../input-suggestions";

describe("suggestInputs", () => {
  it("空会话给立项类建议", () => {
    const s = suggestInputs({ messageCount: 0, hasDraft: false, hasRunningMission: false });
    expect(s.some((x) => x.fill.includes("立项"))).toBe(true);
  });

  it("有稿件给多版本/送审建议", () => {
    const s = suggestInputs({ messageCount: 4, hasDraft: true, hasRunningMission: false });
    expect(s.some((x) => x.label.includes("多版本"))).toBe(true);
    expect(s.some((x) => x.label.includes("送审"))).toBe(true);
  });

  it("mission 执行中给看进度建议（优先级高于 hasDraft）", () => {
    const s = suggestInputs({ messageCount: 2, hasDraft: true, hasRunningMission: true });
    expect(s.some((x) => x.label.includes("进度"))).toBe(true);
    expect(s.some((x) => x.label.includes("多版本"))).toBe(false);
  });

  it("非空非草稿会话给兜底建议", () => {
    const s = suggestInputs({ messageCount: 2, hasDraft: false, hasRunningMission: false });
    expect(s.length).toBeGreaterThan(0);
  });

  it("每条都有 label 与 fill 且不超过 4 条", () => {
    for (const ctx of [
      { messageCount: 0, hasDraft: false, hasRunningMission: false },
      { messageCount: 4, hasDraft: true, hasRunningMission: false },
      { messageCount: 2, hasDraft: false, hasRunningMission: true },
      { messageCount: 1, hasDraft: false, hasRunningMission: false },
    ]) {
      const s = suggestInputs(ctx);
      expect(s.length).toBeLessThanOrEqual(4);
      expect(s.every((x) => x.label && x.fill)).toBe(true);
    }
  });
});
