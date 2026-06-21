import { describe, it, expect } from "vitest";
import { DEFAULT_DOMAINS } from "@/lib/domains-defaults";

describe("DEFAULT_DOMAINS", () => {
  it("slug 全局唯一", () => {
    const slugs = DEFAULT_DOMAINS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("每条都有 slug + name", () => {
    for (const d of DEFAULT_DOMAINS) {
      expect(d.slug).toBeTruthy();
      expect(d.name).toBeTruthy();
    }
  });
  it("财经带口径包（promptGuidance + 权威源）", () => {
    const fin = DEFAULT_DOMAINS.find((d) => d.slug === "finance");
    expect(fin?.promptGuidance).toBeTruthy();
    expect((fin?.authoritySources ?? []).length).toBeGreaterThan(0);
  });
});
