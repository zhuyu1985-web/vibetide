import { describe, it, expect } from "vitest";
import { templateToScenarioSlug } from "../workflow-template-slug";

describe("templateToScenarioSlug", () => {
  it("returns legacyScenarioKey when set", () => {
    const slug = templateToScenarioSlug({
      legacyScenarioKey: "breaking_news",
      name: "突发新闻",
    });
    expect(slug).toBe("breaking_news");
  });

  it("generates custom_${nanoid} when legacyScenarioKey is null", () => {
    const slug = templateToScenarioSlug({
      legacyScenarioKey: null,
      name: "快讯工作流",
    });
    expect(slug).toMatch(/^custom_[A-Za-z0-9_-]{6}$/);
  });

  it("returns different slugs on repeated calls for same custom template", () => {
    const a = templateToScenarioSlug({ legacyScenarioKey: null, name: "x" });
    const b = templateToScenarioSlug({ legacyScenarioKey: null, name: "x" });
    expect(a).not.toBe(b);
  });

  it("handles empty string legacyScenarioKey as falsy (returns custom_...)", () => {
    const slug = templateToScenarioSlug({ legacyScenarioKey: "", name: "y" });
    expect(slug).toMatch(/^custom_/);
  });
});
