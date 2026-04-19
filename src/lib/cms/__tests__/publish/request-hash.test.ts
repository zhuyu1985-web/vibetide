import { describe, it, expect } from "vitest";
import { hashRequestPayload } from "../../publish/request-hash";

describe("hashRequestPayload", () => {
  it("returns identical hash for identical payloads", () => {
    const payload = { title: "a", catalogId: 1, content: "x" };
    expect(hashRequestPayload(payload)).toBe(hashRequestPayload(payload));
  });

  it("returns identical hash regardless of key order (stable)", () => {
    const a = { title: "a", catalogId: 1, content: "x" };
    const b = { content: "x", title: "a", catalogId: 1 };
    expect(hashRequestPayload(a)).toBe(hashRequestPayload(b));
  });

  it("returns different hash when any field differs", () => {
    const a = { title: "a", catalogId: 1, content: "x" };
    const b = { title: "a", catalogId: 1, content: "y" };
    expect(hashRequestPayload(a)).not.toBe(hashRequestPayload(b));
  });

  it("ignores volatile fields (addTime, publishDate) per design", () => {
    const now = Date.now();
    const a = { title: "a", catalogId: 1, addTime: now, publishDate: now };
    const b = {
      title: "a",
      catalogId: 1,
      addTime: now + 1000,
      publishDate: now + 1000,
    };
    expect(hashRequestPayload(a)).toBe(hashRequestPayload(b));
  });

  it("returns SHA-256 hex of 64 chars", () => {
    const h = hashRequestPayload({ title: "x" });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});
