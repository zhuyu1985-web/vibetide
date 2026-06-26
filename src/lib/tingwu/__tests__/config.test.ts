import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isTingwuEnabled, requireTingwuConfig, TingwuConfigError } from "../config";

const KEYS = [
  "VIDEO_ANALYSIS_PROVIDER",
  "ALIBABA_CLOUD_ACCESS_KEY_ID",
  "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
  "TINGWU_APP_KEY",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("isTingwuEnabled", () => {
  it("缺 key → false（优雅跳过）", () => {
    process.env.VIDEO_ANALYSIS_PROVIDER = "aliyun_tingwu";
    expect(isTingwuEnabled()).toBe(false);
  });

  it("provider 不是 aliyun_tingwu → false", () => {
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = "id";
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = "secret";
    process.env.TINGWU_APP_KEY = "app";
    expect(isTingwuEnabled()).toBe(false);
  });

  it("flag + 三 key 齐全 → true", () => {
    process.env.VIDEO_ANALYSIS_PROVIDER = "aliyun_tingwu";
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = "id";
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = "secret";
    process.env.TINGWU_APP_KEY = "app";
    expect(isTingwuEnabled()).toBe(true);
  });
});

describe("requireTingwuConfig", () => {
  it("缺 key → 抛 TingwuConfigError", () => {
    expect(() => requireTingwuConfig()).toThrow(TingwuConfigError);
  });

  it("齐全 → 返回 config（endpoint 默认 cn-beijing）", () => {
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = "id";
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = "secret";
    process.env.TINGWU_APP_KEY = "app";
    const c = requireTingwuConfig();
    expect(c.appKey).toBe("app");
    expect(c.endpoint).toContain("tingwu.cn-beijing");
  });
});
