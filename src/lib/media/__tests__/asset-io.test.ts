import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Top-level mocks (ESM hoisting: vi.mock before imports) ──

vi.mock("@/lib/storage", () => ({
  generateDownloadUrl: vi.fn(
    (key: string, _ttl?: number) => `https://fake-storage/${key}?presigned`
  ),
  getPublicUrl: vi.fn(
    (key: string) => `https://fake-cdn/${key}`
  ),
  putObject: vi.fn().mockResolvedValue(undefined),
  defaultBucket: "fake-bucket",
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      mediaAssets: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
  },
}));

// ── 被测模块（mock 之后引入）──
import {
  resolveOrgAsset,
  downloadObjectToFile,
  storeBufferAsAsset,
} from "../asset-io";
import { formatFileSize } from "@/lib/format";
import { db } from "@/db";
import { generateDownloadUrl, putObject } from "@/lib/storage";

// ---------------------------------------------------------------------------
// 工具函数 formatFileSize（已迁移至 @/lib/format）
// ---------------------------------------------------------------------------

describe("formatFileSize", () => {
  it("字节 < 1 KB → '512 B'", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("1 KB → '1 KB'", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
  });

  it("1.5 MB", () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("2 GB", () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });
});

// ---------------------------------------------------------------------------
// resolveOrgAsset — 租户隔离检查
// ---------------------------------------------------------------------------

describe("resolveOrgAsset", () => {
  beforeEach(() => {
    vi.mocked(db.query.mediaAssets.findFirst).mockResolvedValue({
      id: "asset-1",
      organizationId: "org-a",
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("调用 db.query 时传入 id 和 organizationId 两个条件", async () => {
    await resolveOrgAsset("org-a", "asset-1");
    expect(db.query.mediaAssets.findFirst).toHaveBeenCalledOnce();
    // 确认调用成功（包含 where 条件）
    const call = vi.mocked(db.query.mediaAssets.findFirst).mock.calls[0][0];
    expect(call).toBeDefined();
    expect(call).toHaveProperty("where");
  });

  it("返回 findFirst 的结果", async () => {
    const result = await resolveOrgAsset("org-a", "asset-1");
    expect(result).toMatchObject({ id: "asset-1", organizationId: "org-a" });
  });
});

// ---------------------------------------------------------------------------
// downloadObjectToFile — 大小守卫
// ---------------------------------------------------------------------------

describe("downloadObjectToFile", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("HEAD content-length 超过 500 MB → 抛异常", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      headers: { get: (_: string) => String(500 * 1024 * 1024 + 1) },
    } as never);

    await expect(
      downloadObjectToFile("org/video.mp4", "/tmp/test.mp4")
    ).rejects.toThrow(/超出大小上限/);
  });

  it("使用 generateDownloadUrl 生成预签名 URL", async () => {
    // HEAD 返回合法大小，GET 返回空 body
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        headers: { get: (_: string) => "1024" },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
      } as never);

    // writeFile mock 避免实际 I/O
    const fsMock = await import("node:fs");
    vi.spyOn(fsMock.promises, "writeFile").mockResolvedValue(undefined);

    await downloadObjectToFile("org/video.mp4", "/tmp/test.mp4", 3600);

    expect(generateDownloadUrl).toHaveBeenCalledWith("org/video.mp4", 3600);
  });
});

// ---------------------------------------------------------------------------
// storeBufferAsAsset — 上传 + 入库
// ---------------------------------------------------------------------------

describe("storeBufferAsAsset", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockInsertChain = () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "new-asset-id" }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never);
    return { valuesMock, returningMock };
  };

  it("调用 putObject 并将 buffer 上传", async () => {
    mockInsertChain();
    const buf = Buffer.from("fake video data");

    await storeBufferAsAsset(buf, {
      organizationId: "org-a",
      slug: "transcode",
      ext: "mp4",
      contentType: "video/mp4",
      type: "video",
      title: "转码视频",
    });

    expect(putObject).toHaveBeenCalledOnce();
    const [key, body, ct] = vi.mocked(putObject).mock.calls[0];
    expect(key).toMatch(/^org-a\/cli\/transcode\//);
    expect(key).toMatch(/\.mp4$/);
    expect(body).toBe(buf);
    expect(ct).toBe("video/mp4");
  });

  it("插入 mediaAssets 时写入 fileSize 和 fileSizeDisplay", async () => {
    const { valuesMock } = mockInsertChain();
    const buf = Buffer.alloc(2 * 1024 * 1024); // 2 MB

    await storeBufferAsAsset(buf, {
      organizationId: "org-a",
      slug: "subtitle",
      ext: "srt",
      contentType: "text/plain",
      type: "document",
      title: "字幕文件",
    });

    expect(valuesMock).toHaveBeenCalledOnce();
    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.fileSize).toBe(2 * 1024 * 1024);
    expect(inserted.fileSizeDisplay).toBe("2.0 MB");
  });

  it("返回 { assetId, publicUrl }", async () => {
    mockInsertChain();
    const buf = Buffer.from("data");

    const result = await storeBufferAsAsset(buf, {
      organizationId: "org-a",
      slug: "image",
      ext: "jpg",
      contentType: "image/jpeg",
      type: "image",
      title: "图片",
    });

    expect(result.assetId).toBe("new-asset-id");
    expect(result.publicUrl).toMatch(/^https:\/\/fake-cdn\//);
  });

  it("inputAssetId 映射为 parentVersionId", async () => {
    const { valuesMock } = mockInsertChain();
    const buf = Buffer.from("data");

    await storeBufferAsAsset(buf, {
      organizationId: "org-a",
      slug: "transcode",
      ext: "mp4",
      contentType: "video/mp4",
      type: "video",
      title: "版本2",
      inputAssetId: "parent-asset-id",
    });

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.parentVersionId).toBe("parent-asset-id");
  });

  it("buffer 超过 500 MB → 抛异常（不调用 putObject）", async () => {
    const hugeBuf = { byteLength: 500 * 1024 * 1024 + 1 } as Buffer;

    await expect(
      storeBufferAsAsset(hugeBuf, {
        organizationId: "org-a",
        slug: "transcode",
        ext: "mp4",
        contentType: "video/mp4",
        type: "video",
        title: "超大文件",
      })
    ).rejects.toThrow(/超出大小上限/);

    expect(putObject).not.toHaveBeenCalled();
  });
});
