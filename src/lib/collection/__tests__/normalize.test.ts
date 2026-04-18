import { describe, it, expect } from "vitest";
import {
  normalizeTitle,
  normalizeUrl,
  computeUrlHash,
  computeContentFingerprint,
} from "../normalize";

describe("normalizeTitle", () => {
  it("strips whitespace and punctuation", () => {
    expect(normalizeTitle("  Hello, World!!  ")).toBe("helloworld");
  });

  it("lowercases ASCII letters", () => {
    expect(normalizeTitle("HELLO World")).toBe("helloworld");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeTitle("a    b\tc\n d")).toBe("abcd");
  });

  it("converts traditional Chinese to simplified", () => {
    // 國家 → 国家 (simplified)
    expect(normalizeTitle("國家大事")).toBe("国家大事");
  });

  it("strips common Chinese punctuation", () => {
    expect(normalizeTitle("【重磅】某某公司，今日上市！")).toBe("重磅某某公司今日上市");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });
});

describe("normalizeUrl", () => {
  it("strips fragment", () => {
    expect(normalizeUrl("https://a.com/p#frag")).toBe("https://a.com/p");
  });

  it("strips trailing slash except root", () => {
    expect(normalizeUrl("https://a.com/p/")).toBe("https://a.com/p");
    expect(normalizeUrl("https://a.com/")).toBe("https://a.com/");
  });

  it("lowercases scheme and host", () => {
    expect(normalizeUrl("HTTPS://A.COM/X")).toBe("https://a.com/X");
  });

  it("upgrades http to https", () => {
    expect(normalizeUrl("http://a.com/x")).toBe("https://a.com/x");
  });

  it("drops utm_* and common tracking params", () => {
    expect(normalizeUrl("https://a.com/?utm_source=t&utm_medium=m&id=1&fbclid=abc"))
      .toBe("https://a.com/?id=1");
  });

  it("sorts remaining query params", () => {
    expect(normalizeUrl("https://a.com/?b=2&a=1")).toBe("https://a.com/?a=1&b=2");
  });

  it("returns null for invalid URLs", () => {
    expect(normalizeUrl("not a url")).toBe(null);
    expect(normalizeUrl("")).toBe(null);
  });
});

describe("computeUrlHash", () => {
  it("produces same hash for equivalent URLs", () => {
    expect(computeUrlHash("https://A.COM/x/?utm_source=t&id=1"))
      .toBe(computeUrlHash("http://a.com/x?id=1"));
  });

  it("returns null for invalid URL", () => {
    expect(computeUrlHash("not a url")).toBe(null);
  });

  it("produces 32-char hex md5", () => {
    const h = computeUrlHash("https://example.com/");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("computeContentFingerprint", () => {
  it("produces same fingerprint for same title + same day", () => {
    const day = new Date("2026-04-18T10:00:00Z");
    const nextHour = new Date("2026-04-18T14:00:00Z");
    expect(computeContentFingerprint("Hello world", day))
      .toBe(computeContentFingerprint("  HELLO  WORLD!  ", nextHour));
  });

  it("produces different fingerprints across days when publishedAt set", () => {
    const day1 = new Date("2026-04-18T23:00:00Z");
    const day2 = new Date("2026-04-19T01:00:00Z");
    expect(computeContentFingerprint("Hello", day1))
      .not.toBe(computeContentFingerprint("Hello", day2));
  });

  it("uses 7d bucket when publishedAt null - captured dates within 7d share bucket", () => {
    // captured_at 2026-04-18 and 2026-04-20 should share the same 7d bucket
    const capture1 = new Date("2026-04-18T10:00:00Z");
    const capture2 = new Date("2026-04-20T10:00:00Z");
    expect(computeContentFingerprint("Hello", null, capture1))
      .toBe(computeContentFingerprint("Hello", null, capture2));
  });

  it("differs when capture dates span 7d boundary with null publishedAt", () => {
    const capture1 = new Date("2026-04-01T10:00:00Z");
    const capture2 = new Date("2026-04-15T10:00:00Z");
    expect(computeContentFingerprint("Hello", null, capture1))
      .not.toBe(computeContentFingerprint("Hello", null, capture2));
  });

  it("produces 32-char hex md5", () => {
    const fp = computeContentFingerprint("hello", new Date());
    expect(fp).toMatch(/^[0-9a-f]{32}$/);
  });
});
