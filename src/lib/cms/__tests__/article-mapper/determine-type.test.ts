import { describe, it, expect } from "vitest";
import { determineType, type ArticleForTypeDetection } from "../../article-mapper/determine-type";

describe("determineType", () => {
  const base: ArticleForTypeDetection = {
    mediaType: "article",
    body: "<p>x</p>",
    externalUrl: null,
    galleryImages: null,
    videoId: null,
    audioId: null,
  };

  it("returns '1' for plain article with body", () => {
    expect(determineType(base)).toBe("1");
  });

  it("returns '2' when mediaType=gallery and galleryImages.length >= 3", () => {
    expect(
      determineType({
        ...base,
        mediaType: "gallery",
        galleryImages: [
          { url: "a", caption: null },
          { url: "b", caption: null },
          { url: "c", caption: null },
        ],
      }),
    ).toBe("2");
  });

  it("returns '1' when gallery has fewer than 3 images (fallback)", () => {
    expect(
      determineType({
        ...base,
        mediaType: "gallery",
        galleryImages: [{ url: "a", caption: null }],
      }),
    ).toBe("1");
  });

  it("returns '4' when externalUrl set and body empty", () => {
    expect(
      determineType({
        ...base,
        body: "",
        externalUrl: "https://ext",
      }),
    ).toBe("4");
  });

  it("prefers '1' over '4' when both body and externalUrl present", () => {
    expect(
      determineType({
        ...base,
        externalUrl: "https://ext",
        body: "<p>正文</p>",
      }),
    ).toBe("1");
  });

  it("returns '5' when videoId present (P1 预留，实际不走)", () => {
    expect(determineType({ ...base, body: "", videoId: "vms-123" })).toBe("5");
  });

  it("returns '11' when audioId present", () => {
    expect(determineType({ ...base, body: "", audioId: "audio-1" })).toBe("11");
  });

  it("throws when nothing to map (no body/external/video/audio)", () => {
    expect(() =>
      determineType({
        ...base,
        body: "",
        externalUrl: null,
        videoId: null,
        audioId: null,
      }),
    ).toThrow(/determine|empty|no content/i);
  });
});
