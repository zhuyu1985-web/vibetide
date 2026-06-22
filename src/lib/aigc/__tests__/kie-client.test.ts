import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  kieCreateTask,
  kiePollTask,
  kieGenerateImage,
  KieConfigError,
  KieError,
} from "../kie-client";

const FAKE_KEY = "test-api-key";

beforeEach(() => {
  process.env.KIE_API_KEY = FAKE_KEY;
  process.env.KIE_BASE_URL = "https://api.kie.ai";
});

afterEach(() => {
  delete process.env.KIE_API_KEY;
  delete process.env.KIE_BASE_URL;
  delete process.env.KIE_IMAGE_MODEL;
  vi.restoreAllMocks();
});

// ─── kieCreateTask ──────────────────────────────────────────────────────────

describe("kieCreateTask", () => {
  it("code:200 → 返回 taskId", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: async () => ({ code: 200, data: { taskId: "task123" } }),
    } as Response);

    const taskId = await kieCreateTask("nano-banana-pro", { prompt: "a cat" });
    expect(taskId).toBe("task123");
  });

  it("无 KIE_API_KEY → 抛 KieConfigError", async () => {
    delete process.env.KIE_API_KEY;
    await expect(
      kieCreateTask("nano-banana-pro", { prompt: "a cat" })
    ).rejects.toThrow(KieConfigError);
  });

  it("code≠200 → 抛 KieError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: async () => ({ code: 400, msg: "bad request" }),
    } as Response);

    await expect(
      kieCreateTask("nano-banana-pro", { prompt: "a cat" })
    ).rejects.toThrow(KieError);
  });
});

// ─── kiePollTask ────────────────────────────────────────────────────────────

describe("kiePollTask", () => {
  it("waiting → success → 返回 resultUrls", async () => {
    const mockFetch = vi
      .spyOn(globalThis, "fetch")
      // 第一次：waiting
      .mockResolvedValueOnce({
        json: async () => ({
          code: 200,
          data: { state: "waiting" },
        }),
      } as Response)
      // 第二次：success
      .mockResolvedValueOnce({
        json: async () => ({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://img.example.com/1.png"],
            }),
          },
        }),
      } as Response);

    const urls = await kiePollTask("task123", {
      timeoutMs: 5000,
      intervalMs: 10,
    });
    expect(urls).toEqual(["https://img.example.com/1.png"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("直接 success → 返回 resultUrls", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: async () => ({
        code: 200,
        data: {
          state: "success",
          resultJson: JSON.stringify({
            resultUrls: ["https://img.example.com/2.png"],
          }),
        },
      }),
    } as Response);

    const urls = await kiePollTask("task456", {
      timeoutMs: 5000,
      intervalMs: 10,
    });
    expect(urls).toEqual(["https://img.example.com/2.png"]);
  });

  it("fail → 抛 KieError 含 failMsg", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: async () => ({
        code: 200,
        data: { state: "fail", failMsg: "内容违规" },
      }),
    } as Response);

    await expect(kiePollTask("task789", { timeoutMs: 5000, intervalMs: 10 })).rejects.toThrow(
      /内容违规/
    );
  });

  it("超时 → 抛 KieError '超时'", async () => {
    // 始终返回 queuing，让真实时间超过 timeoutMs
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({
        code: 200,
        data: { state: "queuing" },
      }),
    } as Response);

    await expect(
      kiePollTask("taskTimeout", { timeoutMs: 50, intervalMs: 10 })
    ).rejects.toThrow(/超时/);
  }, 10000);
});

// ─── kieGenerateImage ───────────────────────────────────────────────────────

describe("kieGenerateImage", () => {
  it("createTask + poll 串联，返回 urls", async () => {
    process.env.KIE_IMAGE_MODEL = "test-model";

    vi.spyOn(globalThis, "fetch")
      // createTask
      .mockResolvedValueOnce({
        json: async () => ({ code: 200, data: { taskId: "taskGen1" } }),
      } as Response)
      // poll → success
      .mockResolvedValueOnce({
        json: async () => ({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://img.example.com/gen.png"],
            }),
          },
        }),
      } as Response);

    const urls = await kieGenerateImage({ prompt: "a beautiful sunset" });
    expect(urls).toEqual(["https://img.example.com/gen.png"]);
  });

  it("不设 KIE_IMAGE_MODEL 时使用默认模型", async () => {
    const mockFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        json: async () => ({ code: 200, data: { taskId: "taskDef" } }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://img.example.com/def.png"],
            }),
          },
        }),
      } as Response);

    await kieGenerateImage({ prompt: "a cat" });

    // 第一次调用（createTask）的 body 包含默认模型
    const firstCall = mockFetch.mock.calls[0];
    const body = JSON.parse(firstCall[1]?.body as string);
    expect(body.model).toBe("nano-banana-pro");
  });
});
