import { describe, expect, it } from "vitest";
import { matchDistrictsForItem, type DistrictWithName } from "../district-matcher";

const districts: DistrictWithName[] = [
  { id: "d1", name: "涪陵区" },
  { id: "d2", name: "渝中区" },
  { id: "d3", name: "两江新区" },
];

describe("matchDistrictsForItem", () => {
  it("主名命中", () => {
    const r = matchDistrictsForItem("涪陵区生态环境局发布", districts);
    expect(r.length).toBe(1);
    expect(r[0]!.districtId).toBe("d1");
  });

  it("变体命中（涪陵县 历史称谓）", () => {
    const r = matchDistrictsForItem("涪陵县长江保护工作", districts);
    expect(r.length).toBe(1);
    expect(r[0]!.districtId).toBe("d1");
    expect(r[0]!.matchedKeyword).toBe("涪陵县");
  });

  it("简化称谓命中（涪陵）", () => {
    const r = matchDistrictsForItem("涪陵的环保进展", districts);
    expect(r.length).toBe(1);
  });

  it("多区县同时命中", () => {
    const r = matchDistrictsForItem("两江新区与涪陵区合作", districts);
    expect(r.map(m => m.districtId).sort()).toEqual(["d1", "d3"]);
  });

  it("无命中", () => {
    const r = matchDistrictsForItem("成都市政府发文", districts);
    expect(r).toEqual([]);
  });
});
