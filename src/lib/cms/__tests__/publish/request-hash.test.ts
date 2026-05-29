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

describe("hashRequestPayload — _target 字段", () => {
  const baseDto = { title: "t", body: "b", siteId: 81 } as const;

  it("相同 dto + 相同 _target → 哈希稳定", () => {
    const h1 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10462 } });
    const h2 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10462 } });
    expect(h1).toBe(h2);
  });

  it("_target.catalogId 变化 → 哈希变化（防止跨栏目重推命中旧 publication）", () => {
    const h1 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10462 } });
    const h2 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10127 } });
    expect(h1).not.toBe(h2);
  });

  it("有无 _target 字段 → 哈希不同", () => {
    const h1 = hashRequestPayload(baseDto);
    const h2 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10462 } });
    expect(h1).not.toBe(h2);
  });
});
