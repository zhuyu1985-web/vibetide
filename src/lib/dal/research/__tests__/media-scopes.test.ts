import { describe, it, expect } from "vitest";
import type { MediaScopeSummary, MediaScopeDetail } from "../media-scopes";

describe("media-scopes DAL types", () => {
  it("MediaScopeSummary 类型签名", () => {
    const sample: MediaScopeSummary = {
      id: "x", name: "y", description: null, sourceFileName: "x.xlsx",
      totalUnits: 94, centralCount: 4, industryCount: 2,
      municipalCount: 6, districtRmtCount: 41, districtGovCount: 41,
      isDefault: true,
      createdAt: new Date(),
      createdByName: "Zhuyu",
    };
    expect(sample.totalUnits).toBe(94);
    expect(sample.centralCount + sample.industryCount + sample.municipalCount
         + sample.districtRmtCount + sample.districtGovCount).toBe(94);
  });

  it("MediaScopeDetail 含 units 数组", () => {
    const sample: MediaScopeDetail = {
      id: "x", name: "y", description: null, sourceFileName: null,
      totalUnits: 0, centralCount: 0, industryCount: 0,
      municipalCount: 0, districtRmtCount: 0, districtGovCount: 0,
      isDefault: false,
      createdAt: new Date(),
      createdByName: null,
      units: [],
    };
    expect(sample.units).toEqual([]);
  });
});
