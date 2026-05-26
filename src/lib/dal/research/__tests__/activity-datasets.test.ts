import { describe, it, expect } from "vitest";
import type { ActivityDatasetSummary, ActivityDatasetDetail } from "../activity-datasets";

describe("activity-datasets DAL types", () => {
  it("ActivityDatasetSummary 类型签名", () => {
    const sample: ActivityDatasetSummary = {
      id: "x", name: "y", year: 2025, sourceFileName: "x.xlsx",
      districtCount: 39, totalActivities: 5341,
      activityThemes: ["六五环境日", "815全国生态日", "志愿服务活动",
                       "环保设施向公众开放", "美丽重庆六进活动"],
      isDefault: true,
      createdAt: new Date(),
      createdByName: "Zhuyu",
    };
    expect(sample.year).toBe(2025);
    expect(sample.activityThemes).toHaveLength(5);
  });

  it("ActivityDatasetDetail 含 data 数组", () => {
    const sample: ActivityDatasetDetail = {
      id: "x", name: "y", year: 2025, sourceFileName: null,
      districtCount: 0, totalActivities: 0, activityThemes: [],
      isDefault: false,
      createdAt: new Date(),
      createdByName: null,
      data: [],
    };
    expect(sample.data).toEqual([]);
  });
});
