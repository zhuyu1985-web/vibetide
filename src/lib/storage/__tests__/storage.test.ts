import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock SDK（顶层，ESM 要求 vi.mock 在 import 之前提升）──
// 使用普通函数（非箭头函数）作为构造函数，以支持 new TosClient() / new COS()

vi.mock("@volcengine/tos-sdk", () => {
  function TosClient() {
    return {
      getPreSignedUrl: () => "https://fake-tos-presigned/key",
      deleteObject: vi.fn().mockResolvedValue({}),
    };
  }
  class TosClientError extends Error {}
  class TosServerError extends Error {}
  return { TosClient, TosClientError, TosServerError };
});

vi.mock("cos-nodejs-sdk-v5", () => {
  function COS() {
    return {
      getObjectUrl: () => "https://fake-cos-presigned/key",
      deleteObject: (_params: unknown, cb: (err: null) => void) => cb(null),
    };
  }
  return { default: COS };
});

// ── 引入被测模块（在 mock 声明之后）──
import { volcStorage } from "../volc";
import { tencentStorage } from "../tencent";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────
// getPublicUrl 字符串拼接格式验证
// ─────────────────────────────────────────

describe("volcStorage.getPublicUrl", () => {
  it("格式：https://{bucket}.{endpoint}/{key}，不含 myqcloud.com", () => {
    const url = volcStorage.getPublicUrl("org1/aigc/abc.png");
    expect(url).toMatch(/^https:\/\/.+\/.+/);
    expect(url).toContain("org1/aigc/abc.png");
    expect(url).not.toContain("myqcloud.com");
  });
});

describe("tencentStorage.getPublicUrl", () => {
  it("格式包含 .cos.{region}.myqcloud.com/{key}", () => {
    const url = tencentStorage.getPublicUrl("org1/aigc/xyz.jpg");
    // 测试环境 COS_BUCKET 未配置，bucket 为空串，但域名格式仍可验证
    expect(url).toContain(".cos.");
    expect(url).toContain("myqcloud.com");
    expect(url).toContain("org1/aigc/xyz.jpg");
  });
});

// ─────────────────────────────────────────
// provider 格式区分（无 myqcloud vs 有 myqcloud）
// ─────────────────────────────────────────

describe("volc vs tencent getPublicUrl 格式区分", () => {
  it("volc 不含 myqcloud.com；tencent 含 myqcloud.com", () => {
    const volcUrl = volcStorage.getPublicUrl("test/key.png");
    const cosUrl = tencentStorage.getPublicUrl("test/key.png");
    expect(volcUrl).not.toContain("myqcloud.com");
    expect(cosUrl).toContain("myqcloud.com");
    expect(volcUrl).toContain("test/key.png");
    expect(cosUrl).toContain("test/key.png");
  });
});

// ─────────────────────────────────────────
// volcStorage.putObject：fetch 成功 / 失败
// ─────────────────────────────────────────

describe("volcStorage.putObject", () => {
  it("fetch ok → resolve undefined", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
    } as Response);

    await expect(
      volcStorage.putObject("test/key.png", Buffer.from("data"), "image/png")
    ).resolves.toBeUndefined();
  });

  it("fetch 非 ok → 抛 Error 含 'TOS putObject 失败'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as Response);

    await expect(
      volcStorage.putObject("test/key.png", Buffer.from("data"), "image/png")
    ).rejects.toThrow(/TOS putObject 失败/);
  });
});

// ─────────────────────────────────────────
// tencentStorage.putObject：fetch 成功 / 失败
// ─────────────────────────────────────────

describe("tencentStorage.putObject", () => {
  it("fetch ok → resolve undefined", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
    } as Response);

    await expect(
      tencentStorage.putObject("test/key.png", Buffer.from("data"), "image/png")
    ).resolves.toBeUndefined();
  });

  it("fetch 非 ok → 抛 Error 含 'COS putObject 失败'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as Response);

    await expect(
      tencentStorage.putObject("test/key.png", Buffer.from("data"), "image/png")
    ).rejects.toThrow(/COS putObject 失败/);
  });
});
