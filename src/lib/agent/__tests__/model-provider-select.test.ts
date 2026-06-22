import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { getActiveProvider, getDefaultModel } from "../model-router";

const ENV_KEYS = ["LLM_PROVIDER", "OPENAI_MODEL", "DASHSCOPE_MODEL", "ZHIPU_MODEL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("getActiveProvider（按 LLM_PROVIDER 选活动 provider）", () => {
  it("未设 / 空 / openai → openai（默认，向后兼容）", () => {
    delete process.env.LLM_PROVIDER;
    expect(getActiveProvider()).toBe("openai");
    process.env.LLM_PROVIDER = "";
    expect(getActiveProvider()).toBe("openai");
    process.env.LLM_PROVIDER = "openai";
    expect(getActiveProvider()).toBe("openai");
  });

  it("dashscope 及通义别名 → dashscope", () => {
    for (const v of ["dashscope", "qwen", "tongyi", "bailian", "aliyun", "DashScope", " dashscope "]) {
      process.env.LLM_PROVIDER = v;
      expect(getActiveProvider()).toBe("dashscope");
    }
  });

  it("zhipu → zhipu", () => {
    process.env.LLM_PROVIDER = "zhipu";
    expect(getActiveProvider()).toBe("zhipu");
  });
});

describe("getDefaultModel（按活动 provider 取对应 *_MODEL）", () => {
  it("openai → OPENAI_MODEL", () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.OPENAI_MODEL = "deepseek-chat";
    expect(getDefaultModel()).toBe("deepseek-chat");
  });

  it("dashscope → DASHSCOPE_MODEL，缺省 qwen-max", () => {
    process.env.LLM_PROVIDER = "dashscope";
    delete process.env.DASHSCOPE_MODEL;
    expect(getDefaultModel()).toBe("qwen-max");
    process.env.DASHSCOPE_MODEL = "qwen-plus";
    expect(getDefaultModel()).toBe("qwen-plus");
  });

  it("zhipu → ZHIPU_MODEL，缺省 glm-4", () => {
    process.env.LLM_PROVIDER = "zhipu";
    delete process.env.ZHIPU_MODEL;
    expect(getDefaultModel()).toBe("glm-4");
  });

  it("openai 且 OPENAI_MODEL 未配 → 抛错（提示可切 dashscope）", () => {
    process.env.LLM_PROVIDER = "openai";
    delete process.env.OPENAI_MODEL;
    expect(() => getDefaultModel()).toThrow(/OPENAI_MODEL|dashscope/);
  });
});
