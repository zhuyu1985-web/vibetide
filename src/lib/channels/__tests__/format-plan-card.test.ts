import { describe, it, expect } from "vitest";
import { formatPlanCard } from "../format-plan-card";

const steps = [
  { employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓科技热榜" },
  { employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "写800字短稿" },
];

describe("formatPlanCard", () => {
  it("渲染步骤 + 开始提示", () => {
    const card = formatPlanCard("抓个科技热点写成稿", steps as never);
    expect(card).toContain("抓科技热榜");
    expect(card).toContain("写800字短稿");
    expect(card).toContain("开始");
  });
});
