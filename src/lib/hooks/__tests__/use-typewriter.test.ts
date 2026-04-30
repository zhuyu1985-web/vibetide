import { describe, it, expect } from "vitest";
import { nextRevealLength } from "../use-typewriter";

describe("nextRevealLength", () => {
  it("returns 0 at start (now == startedAt)", () => {
    expect(nextRevealLength("hello world", 1000, 30, 1000)).toBe(0);
  });

  it("reveals proportionally to elapsed time", () => {
    // 30 chars/sec, 500ms elapsed → 15 chars revealed
    expect(nextRevealLength("a".repeat(50), 1000, 30, 1500)).toBe(15);
  });

  it("clamps to text length when elapsed time would exceed it", () => {
    // 30 chars/sec, 10s elapsed → 300 chars wanted, but text is 5 chars
    expect(nextRevealLength("hello", 1000, 30, 11_000)).toBe(5);
  });

  it("returns 0 for empty text", () => {
    expect(nextRevealLength("", 1000, 30, 5000)).toBe(0);
  });

  it("returns full text length when charsPerSec is non-positive", () => {
    // Non-positive speed → no animation, reveal full immediately
    expect(nextRevealLength("hello", 1000, 0, 1500)).toBe(5);
    expect(nextRevealLength("hello", 1000, -10, 1500)).toBe(5);
  });
});
