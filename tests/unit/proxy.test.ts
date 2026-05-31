import { describe, it, expect } from "vitest";
import { isPublic } from "@/proxy";

describe("isPublic", () => {
  it.each([
    ["/", true],
    ["/login", true],
    ["/help", true],
    ["/help/workflows/start", true],
    ["/help/faq#wf-001", true],
    ["/home", false],
    ["/missions", false],
  ])("isPublic(%s) === %s", (p, expected) => {
    expect(isPublic(p)).toBe(expected);
  });
});
