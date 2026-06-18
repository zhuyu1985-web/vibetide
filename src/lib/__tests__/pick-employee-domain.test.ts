import { describe, it, expect } from "vitest";
import { pickEmployeeForStep, type EmployeeWithSkills } from "../mission-core";

const reporter = (slug: string, domainId?: string, isPreset = 1): EmployeeWithSkills => ({
  id: slug, slug, name: slug, title: "记者", nickname: slug, skills: [],
  roleType: "reporter", isPreset, domainId,
});

describe("pickEmployeeForStep × 领域", () => {
  const finance = reporter("fin", "dom-finance");
  const sports = reporter("spo", "dom-sports");
  const generic = reporter("gen", undefined);

  it("领域精确命中：requiredCraft=reporter + domainId=finance → 选财经记者", () => {
    const r = pickEmployeeForStep(
      { config: { requiredCraft: "reporter", domainId: "dom-finance" } },
      [], [finance, sports, generic],
    );
    expect(r.employee?.slug).toBe("fin");
    expect(r.domainFallback).toBe(false);
  });

  it("领域无匹配实例 → fallback 通用实例 + domainFallback=true", () => {
    const r = pickEmployeeForStep(
      { config: { requiredCraft: "reporter", domainId: "dom-tech" } },
      [], [finance, sports, generic],
    );
    expect(r.employee?.slug).toBe("gen");
    expect(r.domainFallback).toBe(true);
  });

  it("不指定 domainId → 走现状逻辑，domainFallback=false", () => {
    const r = pickEmployeeForStep(
      { config: { requiredCraft: "reporter" } },
      [], [finance, sports],
    );
    expect(r.employee?.roleType).toBe("reporter");
    expect(r.domainFallback).toBe(false);
  });
});
