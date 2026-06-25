import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getActiveAsrProvider,
  isAsrProviderConfigured,
  getAsrMinConfidence,
} from "../config";
import { ensureAsrFormat, defaultSampleRate } from "../transcode";
import { transcribeAudio } from "../index";
import { AsrUnsupportedFormatError, AsrProviderNotConfiguredError } from "../types";

const ASR_KEYS = [
  "ASR_PROVIDER",
  "ASR_MIN_CONFIDENCE",
  "ALIYUN_NLS_APP_KEY",
  "ALIYUN_NLS_TOKEN",
  "ALIYUN_NLS_AK_ID",
  "ALIYUN_NLS_AK_SECRET",
  "TENCENT_ASR_SECRET_ID",
  "TENCENT_ASR_SECRET_KEY",
];

describe("asr/config", () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {};
    for (const k of ASR_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ASR_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("默认 provider 为 aliyun", () => {
    expect(getActiveAsrProvider()).toBe("aliyun");
  });

  it("显式 tencent 生效", () => {
    process.env.ASR_PROVIDER = "tencent";
    expect(getActiveAsrProvider()).toBe("tencent");
  });

  it("非法值回退 aliyun", () => {
    process.env.ASR_PROVIDER = "whisper";
    expect(getActiveAsrProvider()).toBe("aliyun");
  });

  it("置信度门槛默认 0.6，合法值生效，非法回退", () => {
    expect(getAsrMinConfidence()).toBe(0.6);
    process.env.ASR_MIN_CONFIDENCE = "0.8";
    expect(getAsrMinConfidence()).toBe(0.8);
    process.env.ASR_MIN_CONFIDENCE = "abc";
    expect(getAsrMinConfidence()).toBe(0.6);
    process.env.ASR_MIN_CONFIDENCE = "2"; // 越界
    expect(getAsrMinConfidence()).toBe(0.6);
  });

  it("aliyun 需 AppKey + (Token 或 AK 对)", () => {
    expect(isAsrProviderConfigured("aliyun")).toBe(false);
    process.env.ALIYUN_NLS_APP_KEY = "ak";
    expect(isAsrProviderConfigured("aliyun")).toBe(false); // 缺 token/ak
    process.env.ALIYUN_NLS_TOKEN = "t";
    expect(isAsrProviderConfigured("aliyun")).toBe(true);
    delete process.env.ALIYUN_NLS_TOKEN;
    process.env.ALIYUN_NLS_AK_ID = "id";
    process.env.ALIYUN_NLS_AK_SECRET = "secret";
    expect(isAsrProviderConfigured("aliyun")).toBe(true);
  });

  it("tencent 需 secretId + secretKey", () => {
    expect(isAsrProviderConfigured("tencent")).toBe(false);
    process.env.TENCENT_ASR_SECRET_ID = "id";
    process.env.TENCENT_ASR_SECRET_KEY = "key";
    expect(isAsrProviderConfigured("tencent")).toBe(true);
  });
});

describe("asr/transcode", () => {
  it("amr/wav/pcm 直透", async () => {
    const buf = Buffer.from([1, 2, 3]);
    for (const fmt of ["amr", "wav", "pcm"] as const) {
      const r = await ensureAsrFormat(buf, fmt);
      expect(r.format).toBe(fmt);
      expect(r.buffer).toBe(buf);
    }
  });

  it("silk 抛 AsrUnsupportedFormatError", async () => {
    await expect(ensureAsrFormat(Buffer.from([0]), "silk")).rejects.toBeInstanceOf(
      AsrUnsupportedFormatError,
    );
  });

  it("采样率按格式推断：amr→8000，其余→16000", () => {
    expect(defaultSampleRate("amr")).toBe(8000);
    expect(defaultSampleRate("wav")).toBe(16000);
  });
});

describe("asr/transcribeAudio 路由", () => {
  it("silk 在进入任何 provider 前就被格式门挡下", async () => {
    await expect(
      transcribeAudio(Buffer.from([0]), "silk", { forceProvider: "aliyun" }),
    ).rejects.toBeInstanceOf(AsrUnsupportedFormatError);
  });

  it("tencent provider 为 P0 占位，抛未配置错误", async () => {
    await expect(
      transcribeAudio(Buffer.from([0]), "amr", { forceProvider: "tencent" }),
    ).rejects.toBeInstanceOf(AsrProviderNotConfiguredError);
  });
});
