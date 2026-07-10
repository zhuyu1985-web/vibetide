import { describe, it, expect, vi, afterEach } from "vitest";
import { extractVideoMeta, detectVideoSource } from "../video-source";

describe("extractVideoMeta", () => {
  it("og:video 直链 → videoUrl + og:image 封面", () => {
    const html = `<html><head>
      <meta property="og:video" content="https://x/y.mp4">
      <meta property="og:image" content="https://x/cover.jpg">
    </head></html>`;
    const r = extractVideoMeta(html);
    expect(r.videoUrl).toBe("https://x/y.mp4");
    expect(r.thumbnailUrl).toBe("https://x/cover.jpg");
  });

  it("og:video:secure_url 优先", () => {
    const html = `<head>
      <meta property="og:video" content="https://x/a.mp4">
      <meta property="og:video:secure_url" content="https://x/secure.mp4">
    </head>`;
    expect(extractVideoMeta(html).videoUrl).toBe("https://x/secure.mp4");
  });

  it("<video src> 兜底", () => {
    const html = `<body><video src="https://x/v.mp4"></video></body>`;
    expect(extractVideoMeta(html).videoUrl).toBe("https://x/v.mp4");
  });

  it("无视频 → undefined", () => {
    expect(extractVideoMeta(`<head><title>t</title></head>`).videoUrl).toBeUndefined();
  });
});

describe("detectVideoSource", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hint 是直链 mp4 → direct，不抓取", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await detectVideoSource("https://news/x", "https://cdn/v.mp4");
    expect(r.kind).toBe("direct");
    expect(r.videoUrl).toBe("https://cdn/v.mp4");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("og:video mp4 → direct", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<meta property="og:video" content="https://x/y.mp4">`,
    }));
    const r = await detectVideoSource("https://news/x");
    expect(r.kind).toBe("direct");
    expect(r.videoUrl).toBe("https://x/y.mp4");
  });

  it("m3u8 → stream（不下载）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<meta property="og:video" content="https://x/y.m3u8">`,
    }));
    const r = await detectVideoSource("https://news/x");
    expect(r.kind).toBe("stream");
  });

  it("无视频 → none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<title>t</title>`,
    }));
    const r = await detectVideoSource("https://news/x");
    expect(r.kind).toBe("none");
  });

  it("已知平台 host → platform 字段标注", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<title>t</title>`,
    }));
    const r = await detectVideoSource("https://www.douyin.com/video/123");
    expect(r.platform).toBe("douyin");
  });
});
