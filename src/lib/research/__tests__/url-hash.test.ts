import { describe, it, expect } from "vitest";
import { normalizeUrl, hashUrl } from "../url-hash";

describe("normalizeUrl", () => {
  it("strips fragment and trailing slash", () => {
    expect(normalizeUrl("https://a.com/path/#frag")).toBe("https://a.com/path");
  });

  it("lowercases host and scheme", () => {
    expect(normalizeUrl("HTTPS://A.COM/X")).toBe("https://a.com/X");
  });

  it("drops utm_* params", () => {
    expect(normalizeUrl("https://a.com/?utm_source=twitter&id=1"))
      .toBe("https://a.com/?id=1");
  });

  it("sorts remaining query params", () => {
    expect(normalizeUrl("https://a.com/?b=2&a=1"))
      .toBe("https://a.com/?a=1&b=2");
  });

  it("keeps root slash", () => {
    expect(normalizeUrl("https://a.com/")).toBe("https://a.com/");
  });
});

describe("hashUrl", () => {
  it("hashes two differently-formatted URLs to same value", () => {
    expect(hashUrl("https://A.COM/x/?utm_source=t&id=1"))
      .toBe(hashUrl("https://a.com/x?id=1"));
  });
  it("returns 64-char hex", () => {
    expect(hashUrl("https://a.com/")).toMatch(/^[a-f0-9]{64}$/);
  });
});
