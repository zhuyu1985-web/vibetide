import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks（factory 不引用外部变量；vi.hoisted 提供共享 spy）
// ---------------------------------------------------------------------------

const {
  getCliToolById,
  updateCliToolRun,
  executeCliPipeline,
  surfaceCliOutput,
  appendMessage,
} = vi.hoisted(() => ({
  getCliToolById: vi.fn(),
  updateCliToolRun: vi.fn(),
  executeCliPipeline: vi.fn(),
  surfaceCliOutput: vi.fn(),
  appendMessage: vi.fn(),
}));

// createFunction 直接返回 handler，便于驱动；记录 fn 配置供断言
vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (opts: unknown, trigger: unknown, handler: unknown) =>
      Object.assign(handler as object, { __opts: opts, __trigger: trigger }),
  },
}));
vi.mock("@/lib/dal/cli-tools", () => ({ getCliToolById, updateCliToolRun }));
vi.mock("@/lib/cli/pipeline", () => ({ executeCliPipeline }));
vi.mock("@/lib/cli/surface", () => ({ surfaceCliOutput }));
vi.mock("@/lib/dal/cowork-conversations", () => ({ appendMessage }));

import { cliRun, cliRunFailureHandler } from "../cli-run";

// ---------------------------------------------------------------------------
// 假 step harness：按调用顺序记录 step 名，逐个 await fn()
// ---------------------------------------------------------------------------

function makeStep() {
  const order: string[] = [];
  const step = {
    run: vi.fn(async (name: string, fn: () => unknown) => {
      order.push(name);
      return fn();
    }),
  };
  return { step, order };
}

const baseTool = {
  id: "tool-1",
  name: "FFmpeg 转码",
  slug: "ffmpeg-transcode",
  command: "ffmpeg",
  argsSchema: { source: { type: "asset", required: true } },
  argvTemplate: ["-i", { param: "source" }, { output: "out" }],
  syncTimeoutMs: 20000,
};

const baseData = {
  organizationId: "org-1",
  cliToolId: "tool-1",
  runId: "run-1",
  resolvedParams: { source: "asset-1", ext: "mp4" },
  inputAssetId: "asset-1",
  missionId: "m-1",
  taskId: "t-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  getCliToolById.mockResolvedValue(baseTool);
  updateCliToolRun.mockResolvedValue(undefined);
  surfaceCliOutput.mockResolvedValue(undefined);
  appendMessage.mockResolvedValue(undefined);
  executeCliPipeline.mockResolvedValue({
    assetId: "asset-out",
    publicUrl: "https://cdn/x.mp4",
    assetType: "video",
    exitCode: 0,
    stderrTail: "",
    argvResolved: ["-i", "/tmp/in.mp4", "/tmp/out.mp4"],
  });
});

// ---------------------------------------------------------------------------
// ② cliRun — step 顺序 + 各步副作用
// ---------------------------------------------------------------------------

describe("cliRun — durable 步骤", () => {
  it("配置：id/并发/重试", () => {
    const opts = (cliRun as unknown as { __opts: Record<string, unknown> }).__opts;
    expect(opts.id).toBe("cli-run");
    expect(opts.retries).toBe(2);
    expect(opts.concurrency).toMatchObject({ limit: 4, key: "event.data.organizationId" });
  });

  it("成功：mark-processing → run-cli → surface → finish(done)", async () => {
    const { step, order } = makeStep();
    const res = await (cliRun as unknown as (a: unknown) => Promise<unknown>)({
      event: { data: baseData },
      step,
    });

    expect(order).toEqual(["mark-processing", "run-cli", "surface", "finish"]);

    // mark-processing
    expect(updateCliToolRun).toHaveBeenNthCalledWith(1, "run-1", { status: "processing" });
    // run-cli 取工具 + 跑管道
    expect(getCliToolById).toHaveBeenCalledWith("org-1", "tool-1");
    expect(executeCliPipeline).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ id: "tool-1", command: "ffmpeg" }),
      baseData.resolvedParams,
    );
    // surface 带 missionId/taskId + 工具名 + 产物
    expect(surfaceCliOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        missionId: "m-1",
        taskId: "t-1",
        cliToolName: "FFmpeg 转码",
      }),
      expect.objectContaining({ assetId: "asset-out", assetType: "video", publicUrl: "https://cdn/x.mp4" }),
    );
    // finish 标 done + outputAssetId + exitCode
    expect(updateCliToolRun).toHaveBeenLastCalledWith(
      "run-1",
      expect.objectContaining({ status: "done", outputAssetId: "asset-out", exitCode: 0 }),
    );
    expect(res).toMatchObject({ ok: true, runId: "run-1", assetId: "asset-out" });
  });

  it("工具不存在 → run-cli step 抛错（不进 surface/finish）", async () => {
    getCliToolById.mockResolvedValue(undefined);
    const { step, order } = makeStep();
    await expect(
      (cliRun as unknown as (a: unknown) => Promise<unknown>)({ event: { data: baseData }, step }),
    ).rejects.toThrow("CLI 工具不存在");
    expect(order).toEqual(["mark-processing", "run-cli"]);
    expect(surfaceCliOutput).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ③ cliRunFailureHandler — function_id 匹配才动作
// ---------------------------------------------------------------------------

describe("cliRunFailureHandler", () => {
  it("function_id=cli-run → 标 run failed + 有 conversationId 追加失败卡片", async () => {
    const { step } = makeStep();
    await (cliRunFailureHandler as unknown as (a: unknown) => Promise<unknown>)({
      event: {
        data: {
          function_id: "cli-run",
          error: { message: "转码超时" },
          event: { data: { ...baseData, conversationId: "conv-1" } },
        },
      },
      step,
    });
    expect(updateCliToolRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed", errorMessage: "转码超时" }),
    );
    expect(appendMessage).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ kind: "import_card", content: expect.stringContaining("转码超时") }),
    );
  });

  it("无 conversationId → 只标 failed，不追加卡片", async () => {
    const { step } = makeStep();
    await (cliRunFailureHandler as unknown as (a: unknown) => Promise<unknown>)({
      event: {
        data: {
          function_id: "cli-run",
          error: { message: "boom" },
          event: { data: baseData },
        },
      },
      step,
    });
    expect(updateCliToolRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(appendMessage).not.toHaveBeenCalled();
  });

  it("function_id 不匹配 → no-op（不标 failed）", async () => {
    const { step } = makeStep();
    await (cliRunFailureHandler as unknown as (a: unknown) => Promise<unknown>)({
      event: {
        data: {
          function_id: "tingwu-analyze",
          error: { message: "x" },
          event: { data: baseData },
        },
      },
      step,
    });
    expect(updateCliToolRun).not.toHaveBeenCalled();
    expect(appendMessage).not.toHaveBeenCalled();
  });
});
