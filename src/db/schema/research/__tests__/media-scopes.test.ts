import { describe, it, expect } from "vitest";
import {
  researchMediaScopes,
  researchMediaScopeUnits,
  scopeUnitTierEnum,
} from "../media-scopes";

describe("research_media_scopes schema", () => {
  it("scopeUnitTierEnum 包含 5 个 tier", () => {
    expect(scopeUnitTierEnum.enumValues).toEqual([
      "central",
      "industry",
      "municipal",
      "district_rmt",
      "district_gov",
    ]);
  });

  it("研究媒体名单表有所有必要字段", () => {
    const columns = Object.keys(researchMediaScopes);
    expect(columns).toContain("id");
    expect(columns).toContain("organizationId");
    expect(columns).toContain("name");
    expect(columns).toContain("totalUnits");
    expect(columns).toContain("centralCount");
    expect(columns).toContain("industryCount");
    expect(columns).toContain("municipalCount");
    expect(columns).toContain("districtRmtCount");
    expect(columns).toContain("districtGovCount");
    expect(columns).toContain("isDefault");
    expect(columns).toContain("sourceFileName");
    expect(columns).toContain("sourceFileUrl");
  });

  it("名单单位表有 resolvedOutletIds 数组字段 + xlsxRow + tier", () => {
    const columns = Object.keys(researchMediaScopeUnits);
    expect(columns).toContain("resolvedOutletIds");
    expect(columns).toContain("xlsxRow");
    expect(columns).toContain("tier");
    expect(columns).toContain("scopeId");
    expect(columns).toContain("websites");
    expect(columns).toContain("wechatNames");
    expect(columns).toContain("wechatGhid");
    expect(columns).toContain("weiboUid");
    expect(columns).toContain("districtNormalized");
  });
});
