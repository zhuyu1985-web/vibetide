import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock 必须在 import 实现模块之前，且工厂函数不能引用外部变量
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

import { storeRemoteImageToTos } from "../store-image";
import * as volcTos from "@/lib/storage";
import { db } from "@/db";

const mockArrayBuffer = new ArrayBuffer(8);

beforeEach(() => {
  vi.clearAllMocks();

  // Re-setup volc-tos mocks after clearAllMocks
  vi.mocked(volcTos.putObject).mockResolvedValue(undefined);
  vi.mocked(volcTos.getPublicUrl).mockReturnValue("https://pub/x.png");

  // Re-setup db mock chain after clearAllMocks
  const mockReturning = vi.fn().mockResolvedValue([{ id: "asset1" }]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  vi.mocked(db.insert).mockReturnValue({ values: mockValues } as unknown as ReturnType<typeof db.insert>);

  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    arrayBuffer: async () => mockArrayBuffer,
  } as Response);
});

describe("storeRemoteImageToTos", () => {
  const args = {
    organizationId: "org-123",
    articleId: "art-456",
    title: "测试文章",
  };

  it("成功 → 返回 assetId 和 publicUrl", async () => {
    const result = await storeRemoteImageToTos("https://img.example.com/1.png", args);
    expect(result).toEqual({ assetId: "asset1", publicUrl: "https://pub/x.png" });
  });

  it("调用了 putObject", async () => {
    await storeRemoteImageToTos("https://img.example.com/1.png", args);
    expect(volcTos.putObject).toHaveBeenCalledOnce();
    const [objectKey, buf, contentType] = vi.mocked(volcTos.putObject).mock.calls[0];
    expect(objectKey).toMatch(/^org-123\/aigc\/art-456\/.+\.png$/);
    expect(buf).toBeInstanceOf(Buffer);
    expect(contentType).toBe("image/png");
  });

  it("insert values 含 type:'image' 和 organizationId", async () => {
    await storeRemoteImageToTos("https://img.example.com/1.png", args);
    expect(db.insert).toHaveBeenCalledOnce();
    // 获取 values 调用的参数
    const insertResult = vi.mocked(db.insert).mock.results[0].value;
    const valuesArgs = vi.mocked(insertResult.values).mock.calls[0][0];
    expect(valuesArgs.type).toBe("image");
    expect(valuesArgs.organizationId).toBe("org-123");
    expect(valuesArgs.title).toContain("配图");
  });

  it("fetch 失败 → 抛 Error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(
      storeRemoteImageToTos("https://img.example.com/gone.png", args)
    ).rejects.toThrow(/下载媒体失败/);
  });
});
