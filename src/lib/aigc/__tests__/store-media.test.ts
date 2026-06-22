import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/storage", () => ({
  putObject: vi.fn().mockResolvedValue(undefined),
  getPublicUrl: vi.fn().mockReturnValue("https://pub/x.png"),
  defaultBucket: "vibetide-media",
}));

vi.mock("@/db/schema", () => ({
  mediaAssets: { id: "id" },
}));

vi.mock("@/db", () => {
  const mockReturning = vi.fn().mockResolvedValue([{ id: "asset1" }]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  return {
    db: { insert: mockInsert },
  };
});

import { storeRemoteMediaToTos } from "../store-media";
import * as volcTos from "@/lib/storage";
import { db } from "@/db";

const mockArrayBuffer = new ArrayBuffer(8);

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(volcTos.putObject).mockResolvedValue(undefined);
  vi.mocked(volcTos.getPublicUrl).mockReturnValue("https://pub/x.png");

  const mockReturning = vi.fn().mockResolvedValue([{ id: "asset1" }]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  vi.mocked(db.insert).mockReturnValue({
    values: mockValues,
  } as unknown as ReturnType<typeof db.insert>);

  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    arrayBuffer: async () => mockArrayBuffer,
  } as Response);
});

const baseArgs = {
  organizationId: "org-123",
  articleId: "art-456",
  title: "测试文章",
};

describe("storeRemoteMediaToTos — image", () => {
  it("putObject contentType = image/png", async () => {
    await storeRemoteMediaToTos("https://example.com/1.png", {
      ...baseArgs,
      mediaType: "image",
    });
    const [objectKey, , contentType] = vi.mocked(volcTos.putObject).mock.calls[0];
    expect(objectKey).toMatch(/\.png$/);
    expect(contentType).toBe("image/png");
  });

  it("insert values.type = 'image'", async () => {
    await storeRemoteMediaToTos("https://example.com/1.png", {
      ...baseArgs,
      mediaType: "image",
    });
    const insertResult = vi.mocked(db.insert).mock.results[0].value;
    const valuesArgs = vi.mocked(insertResult.values).mock.calls[0][0];
    expect(valuesArgs.type).toBe("image");
    expect(valuesArgs.mimeType).toBe("image/png");
  });

  it("返回 assetId 和 publicUrl", async () => {
    const result = await storeRemoteMediaToTos("https://example.com/1.png", {
      ...baseArgs,
      mediaType: "image",
    });
    expect(result).toEqual({ assetId: "asset1", publicUrl: "https://pub/x.png" });
  });
});

describe("storeRemoteMediaToTos — video", () => {
  it("putObject contentType = video/mp4", async () => {
    await storeRemoteMediaToTos("https://example.com/1.mp4", {
      ...baseArgs,
      mediaType: "video",
    });
    const [objectKey, , contentType] = vi.mocked(volcTos.putObject).mock.calls[0];
    expect(objectKey).toMatch(/\.mp4$/);
    expect(contentType).toBe("video/mp4");
  });

  it("insert values.type = 'video'", async () => {
    await storeRemoteMediaToTos("https://example.com/1.mp4", {
      ...baseArgs,
      mediaType: "video",
    });
    const insertResult = vi.mocked(db.insert).mock.results[0].value;
    const valuesArgs = vi.mocked(insertResult.values).mock.calls[0][0];
    expect(valuesArgs.type).toBe("video");
    expect(valuesArgs.mimeType).toBe("video/mp4");
  });

  it("title 含 '配视频'", async () => {
    await storeRemoteMediaToTos("https://example.com/1.mp4", {
      ...baseArgs,
      mediaType: "video",
    });
    const insertResult = vi.mocked(db.insert).mock.results[0].value;
    const valuesArgs = vi.mocked(insertResult.values).mock.calls[0][0];
    expect(valuesArgs.title).toContain("配视频");
  });
});

describe("storeRemoteMediaToTos — audio", () => {
  it("putObject contentType = audio/mpeg", async () => {
    await storeRemoteMediaToTos("https://example.com/1.mp3", {
      ...baseArgs,
      mediaType: "audio",
    });
    const [objectKey, , contentType] = vi.mocked(volcTos.putObject).mock.calls[0];
    expect(objectKey).toMatch(/\.mp3$/);
    expect(contentType).toBe("audio/mpeg");
  });

  it("insert values.type = 'audio'", async () => {
    await storeRemoteMediaToTos("https://example.com/1.mp3", {
      ...baseArgs,
      mediaType: "audio",
    });
    const insertResult = vi.mocked(db.insert).mock.results[0].value;
    const valuesArgs = vi.mocked(insertResult.values).mock.calls[0][0];
    expect(valuesArgs.type).toBe("audio");
    expect(valuesArgs.mimeType).toBe("audio/mpeg");
  });

  it("title 含 '播客'", async () => {
    await storeRemoteMediaToTos("https://example.com/1.mp3", {
      ...baseArgs,
      mediaType: "audio",
    });
    const insertResult = vi.mocked(db.insert).mock.results[0].value;
    const valuesArgs = vi.mocked(insertResult.values).mock.calls[0][0];
    expect(valuesArgs.title).toContain("播客");
  });
});

describe("storeRemoteMediaToTos — 错误处理", () => {
  it("fetch 失败 → 抛 Error 含 '下载媒体失败'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(
      storeRemoteMediaToTos("https://example.com/gone.mp4", {
        ...baseArgs,
        mediaType: "video",
      })
    ).rejects.toThrow(/下载媒体失败/);
  });
});
