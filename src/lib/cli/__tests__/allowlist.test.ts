import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { allowedBinaries, assertAllowedBinary, probeBinary } from "../allowlist";

describe("allowedBinaries()", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLI_ALLOWED_BINARIES;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CLI_ALLOWED_BINARIES;
    } else {
      process.env.CLI_ALLOWED_BINARIES = originalEnv;
    }
  });

  it("解析逗号分隔列表", () => {
    process.env.CLI_ALLOWED_BINARIES = "ffmpeg,ffprobe";
    expect(allowedBinaries()).toEqual(["ffmpeg", "ffprobe"]);
  });

  it("修剪各条目两端空白", () => {
    process.env.CLI_ALLOWED_BINARIES = " ffmpeg , ffprobe , yt-dlp ";
    expect(allowedBinaries()).toEqual(["ffmpeg", "ffprobe", "yt-dlp"]);
  });

  it("过滤空条目", () => {
    process.env.CLI_ALLOWED_BINARIES = "ffmpeg,,ffprobe,";
    expect(allowedBinaries()).toEqual(["ffmpeg", "ffprobe"]);
  });

  it("未设置环境变量时返回空数组", () => {
    delete process.env.CLI_ALLOWED_BINARIES;
    expect(allowedBinaries()).toEqual([]);
  });

  it("环境变量为空字符串时返回空数组", () => {
    process.env.CLI_ALLOWED_BINARIES = "";
    expect(allowedBinaries()).toEqual([]);
  });
});

describe("assertAllowedBinary()", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLI_ALLOWED_BINARIES;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CLI_ALLOWED_BINARIES;
    } else {
      process.env.CLI_ALLOWED_BINARIES = originalEnv;
    }
  });

  it("白名单包含该命令时不抛出", () => {
    process.env.CLI_ALLOWED_BINARIES = "ffmpeg,ffprobe";
    expect(() => assertAllowedBinary("ffmpeg")).not.toThrow();
    expect(() => assertAllowedBinary("ffprobe")).not.toThrow();
  });

  it("命令不在白名单时抛出", () => {
    process.env.CLI_ALLOWED_BINARIES = "ffmpeg,ffprobe";
    expect(() => assertAllowedBinary("bash")).toThrow(
      /命令未在 CLI_ALLOWED_BINARIES 白名单：bash/
    );
  });

  it("白名单为空时任何命令都抛出", () => {
    process.env.CLI_ALLOWED_BINARIES = "";
    expect(() => assertAllowedBinary("ffmpeg")).toThrow(
      /命令未在 CLI_ALLOWED_BINARIES 白名单：ffmpeg/
    );
  });

  it("未设置环境变量时任何命令都抛出", () => {
    delete process.env.CLI_ALLOWED_BINARIES;
    expect(() => assertAllowedBinary("ffmpeg")).toThrow(
      /命令未在 CLI_ALLOWED_BINARIES 白名单：ffmpeg/
    );
  });

  it("错误消息包含被拒绝的命令名", () => {
    process.env.CLI_ALLOWED_BINARIES = "ffmpeg";
    expect(() => assertAllowedBinary("curl")).toThrow(/curl/);
  });
});

describe("probeBinary()", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLI_ALLOWED_BINARIES;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CLI_ALLOWED_BINARIES;
    } else {
      process.env.CLI_ALLOWED_BINARIES = originalEnv;
    }
  });

  it("命令不在白名单时拒绝（不实际执行 binary）", async () => {
    process.env.CLI_ALLOWED_BINARIES = "ffmpeg";
    await expect(probeBinary("bash")).rejects.toThrow(
      /命令未在 CLI_ALLOWED_BINARIES 白名单：bash/
    );
  });

  it("不存在的 binary 返回 ok:false", async () => {
    process.env.CLI_ALLOWED_BINARIES = "__nonexistent_binary_xyz__";
    const result = await probeBinary("__nonexistent_binary_xyz__");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/binary 不可用：__nonexistent_binary_xyz__/);
  });
});
