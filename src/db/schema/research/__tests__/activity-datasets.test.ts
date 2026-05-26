import { describe, it, expect } from "vitest";
import { researchActivityDatasets, type ActivityDataPoint } from "../activity-datasets";

describe("research_activity_datasets schema", () => {
  it("有 jsonb data 字段存 ActivityDataPoint[]", () => {
    expect(Object.keys(researchActivityDatasets)).toContain("data");
  });

  it("有 year + districtCount + totalActivities + activityThemes 字段", () => {
    const columns = Object.keys(researchActivityDatasets);
    expect(columns).toContain("year");
    expect(columns).toContain("districtCount");
    expect(columns).toContain("totalActivities");
    expect(columns).toContain("activityThemes");
  });

  it("ActivityDataPoint 类型签名", () => {
    const sample: ActivityDataPoint = {
      district: "两江新区",
      themes: { "六五环境日": 5, "815全国生态日": 5 },
      total: 10,
      firstDate: "2025-01-17",
      lastDate: "2025-12-19",
      spanDays: 337,
      freq: 10 / 337,
    };
    expect(sample.district).toBe("两江新区");
    expect(sample.themes["六五环境日"]).toBe(5);
    expect(sample.spanDays).toBe(337);
  });
});
