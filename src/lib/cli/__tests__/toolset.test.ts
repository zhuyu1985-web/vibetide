import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — factories must NOT reference outer variables (vitest hoisting)
// ---------------------------------------------------------------------------

vi.mock("@/lib/dal/cli-tools", () => ({
  listEnabledCliTools: vi.fn(),
  insertCliToolRun: vi.fn(),
  updateCliToolRun: vi.fn(),
}));

vi.mock("../allowlist", () => ({
  assertAllowedBinary: vi.fn(),
}));

vi.mock("../spawn", () => ({
  runCli: vi.fn(),
}));

// scratch: run fn with a fake dir, no real fs
vi.mock("../scratch", () => ({
  withScratchDir: vi.fn(async (fn: (dir: string) => Promise<unknown>) => fn("/tmp/scratch-xyz")),
}));

vi.mock("@/lib/media/asset-io", () => ({
  resolveOrgAsset: vi.fn(),
  downloadObjectToFile: vi.fn(),
  storeBufferAsAsset: vi.fn(),
  probeMedia: vi.fn(),
}));

// inngest client — async 路径 fire-and-return（动态 import）
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));

// argv: keep real validateParams/resolveArgv? We mock to isolate the pipeline,
// but validateParams must still reject unknown — so use lightweight fakes that
// preserve the contract used by the toolset.
vi.mock("../argv", () => ({
  validateParams: vi.fn((schema: Record<string, unknown>, params: Record<string, unknown>) => {
    // mimic "reject unknown" minimally is not needed for these tests; pass-through
    return { ...params };
  }),
  resolveArgv: vi.fn(() => ["-i", "/tmp/scratch-xyz/in.mp4", "/tmp/scratch-xyz/out.mp4"]),
}));

// node:fs readFile → return a buffer for the output
vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(Buffer.from("OUTPUT_BYTES")),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import {
  listEnabledCliTools,
  insertCliToolRun,
  updateCliToolRun,
} from "@/lib/dal/cli-tools";
import { assertAllowedBinary } from "../allowlist";
import { runCli } from "../spawn";
import { validateParams } from "../argv";
import {
  resolveOrgAsset,
  downloadObjectToFile,
  storeBufferAsAsset,
  probeMedia,
} from "@/lib/media/asset-io";
import { inngest } from "@/inngest/client";
import { createCliToolset } from "../toolset";

const mockList = vi.mocked(listEnabledCliTools);
const mockInsertRun = vi.mocked(insertCliToolRun);
const mockUpdateRun = vi.mocked(updateCliToolRun);
const mockAssertBinary = vi.mocked(assertAllowedBinary);
const mockRunCli = vi.mocked(runCli);
const mockValidate = vi.mocked(validateParams);
const mockResolveAsset = vi.mocked(resolveOrgAsset);
const mockDownload = vi.mocked(downloadObjectToFile);
const mockStore = vi.mocked(storeBufferAsAsset);
const mockProbe = vi.mocked(probeMedia);
const mockSend = vi.mocked(inngest.send);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Row = Awaited<ReturnType<typeof listEnabledCliTools>>[number];

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "tool-1",
    organizationId: "org-1",
    name: "FFmpeg 转码",
    slug: "ffmpeg-transcode",
    description: "把视频转码为 mp4",
    command: "ffmpeg",
    argsSchema: {
      source: { type: "asset", required: true },
      ext: { type: "enum", values: ["mp4", "webm"], required: true },
    },
    argvTemplate: ["-i", { param: "source" }, { output: "out" }],
    executionMode: "sync",
    syncTimeoutMs: 20000,
    outputKind: "media_asset",
    toolClass: "write",
    enabled: 1,
    createdAt: new Date(),
    ...overrides,
  } as Row;
}

function getExecute(toolset: Record<string, unknown>, key: string) {
  const t = toolset[key] as { execute: (...a: unknown[]) => Promise<unknown> };
  return t.execute;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidate.mockImplementation((_schema, params) => ({ ...(params as object) }) as never);
  mockResolveAsset.mockResolvedValue({
    id: "asset-1",
    tosObjectKey: "org-1/uploads/clip.mp4",
  } as never);
  mockDownload.mockResolvedValue(undefined);
  mockProbe.mockResolvedValue({ durationSeconds: 12, width: 1920, height: 1080 });
  mockStore.mockResolvedValue({ assetId: "asset-out", publicUrl: "https://cdn/x.mp4" });
  mockInsertRun.mockResolvedValue({ id: "run-1" });
  mockUpdateRun.mockResolvedValue(undefined);
  mockRunCli.mockResolvedValue({ exitCode: 0, stderrTail: "" });
});

// ---------------------------------------------------------------------------
// ① Authority gate
// ---------------------------------------------------------------------------

describe("createCliToolset — authority gate", () => {
  test("write 类工具对 advisor 隐藏", async () => {
    mockList.mockResolvedValue([makeRow({ toolClass: "write" })]);
    const ts = await createCliToolset("org-1", { authorityLevel: "advisor" });
    expect(Object.keys(ts)).toHaveLength(0);
  });

  test("write 类工具对 executor 暴露", async () => {
    mockList.mockResolvedValue([makeRow({ toolClass: "write" })]);
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    expect(ts["cli__ffmpeg-transcode"]).toBeDefined();
  });

  test("write 类工具对 coordinator 暴露", async () => {
    mockList.mockResolvedValue([makeRow({ toolClass: "write" })]);
    const ts = await createCliToolset("org-1", { authorityLevel: "coordinator" });
    expect(ts["cli__ffmpeg-transcode"]).toBeDefined();
  });

  test("read 类工具始终暴露（即使 advisor / 无 authorityLevel）", async () => {
    mockList.mockResolvedValue([makeRow({ toolClass: "read", slug: "probe-info" })]);
    const ts1 = await createCliToolset("org-1", { authorityLevel: "advisor" });
    expect(ts1["cli__probe-info"]).toBeDefined();
    const ts2 = await createCliToolset("org-1", {});
    expect(ts2["cli__probe-info"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ② Sync execute pipeline
// ---------------------------------------------------------------------------

describe("createCliToolset — sync execute pipeline", () => {
  test("跑完整管道并返回 {success, assetId}", async () => {
    mockList.mockResolvedValue([makeRow()]);
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    const exec = getExecute(ts, "cli__ffmpeg-transcode");

    const out = (await exec({ source: "asset-1", ext: "mp4" })) as {
      success: boolean;
      assetId?: string;
    };

    expect(out.success).toBe(true);
    expect(out.assetId).toBe("asset-out");

    // pipeline order assertions
    expect(mockValidate).toHaveBeenCalled();
    expect(mockInsertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        cliToolId: "tool-1",
        status: "processing",
        inputAssetId: "asset-1",
      }),
    );
    expect(mockResolveAsset).toHaveBeenCalledWith("org-1", "asset-1");
    expect(mockDownload).toHaveBeenCalled();
    expect(mockAssertBinary).toHaveBeenCalledWith("ffmpeg");
    expect(mockRunCli).toHaveBeenCalledWith(
      "ffmpeg",
      expect.any(Array),
      expect.objectContaining({ timeoutMs: 20000 }),
    );
    expect(mockStore).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ organizationId: "org-1", slug: "ffmpeg-transcode" }),
    );
    // run row updated to done with output asset
    expect(mockUpdateRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "done", outputAssetId: "asset-out" }),
    );
  });
});

// ---------------------------------------------------------------------------
// ③ Async-mode enqueue（M3.8 替换占位）
// ---------------------------------------------------------------------------

describe("createCliToolset — async enqueue", () => {
  test("async 工具落 queued run 行 + 派 cli/run.requested + 返回 {status:queued,runId}，不跑同步管道", async () => {
    mockInsertRun.mockResolvedValue({ id: "run-async-1" });
    mockList.mockResolvedValue([makeRow({ executionMode: "async" })]);
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    const exec = getExecute(ts, "cli__ffmpeg-transcode");

    const out = (await exec({ source: "asset-1", ext: "mp4" })) as {
      success: boolean;
      status?: string;
      runId?: string;
    };

    expect(out.success).toBe(true);
    expect(out.status).toBe("queued");
    expect(out.runId).toBe("run-async-1");

    // 落 queued run 行（带 inputAssetId）
    expect(mockInsertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        cliToolId: "tool-1",
        status: "queued",
        inputAssetId: "asset-1",
      }),
    );

    // 派 cli/run.requested 事件，dedup id = runId，携带 resolvedParams
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "run-async-1",
        name: "cli/run.requested",
        data: expect.objectContaining({
          organizationId: "org-1",
          cliToolId: "tool-1",
          runId: "run-async-1",
          inputAssetId: "asset-1",
          resolvedParams: expect.objectContaining({ source: "asset-1", ext: "mp4" }),
        }),
      }),
    );

    // 绝不在 execute 内跑同步管道
    expect(mockRunCli).not.toHaveBeenCalled();
    expect(mockStore).not.toHaveBeenCalled();
    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  test("async 工具从 rawArgs 读注入的 missionId/taskId 填进 run 行与事件", async () => {
    mockInsertRun.mockResolvedValue({ id: "run-async-2" });
    mockList.mockResolvedValue([makeRow({ executionMode: "async" })]);
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    const exec = getExecute(ts, "cli__ffmpeg-transcode");

    // 模拟 wrap 把上下文键合并进 args
    await exec({
      source: "asset-1",
      ext: "mp4",
      organizationId: "org-1",
      missionId: "m-9",
      taskId: "t-9",
    });

    expect(mockInsertRun).toHaveBeenCalledWith(
      expect.objectContaining({ missionId: "m-9", taskId: "t-9" }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ missionId: "m-9", taskId: "t-9" }),
      }),
    );
    // 注入键不会污染 resolvedParams（被 RESERVED_CONTEXT_KEYS 剥离）
    const sentData = mockSend.mock.calls[0][0] as {
      data: { resolvedParams: Record<string, unknown> };
    };
    expect(sentData.data.resolvedParams).not.toHaveProperty("organizationId");
    expect(sentData.data.resolvedParams).not.toHaveProperty("missionId");
  });

  test("async 工具从 rawArgs 读注入的 conversationId 填进 run 行与事件", async () => {
    mockInsertRun.mockResolvedValue({ id: "run-async-3" });
    mockList.mockResolvedValue([makeRow({ executionMode: "async" })]);
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    const exec = getExecute(ts, "cli__ffmpeg-transcode");

    // 模拟 wrapToolExecuteWithContext 把 conversationId 合并进 args（M3.9+ 路径）
    await exec({
      source: "asset-1",
      ext: "mp4",
      organizationId: "org-1",
      conversationId: "conv-88",
    });

    // (a) run 行写入 conversationId
    expect(mockInsertRun).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv-88" }),
    );

    // (b) cli/run.requested 事件携带 conversationId
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ conversationId: "conv-88" }),
      }),
    );

    // (c) conversationId 被 RESERVED_CONTEXT_KEYS 剥离，不污染 resolvedParams
    const sentData = mockSend.mock.calls[0][0] as {
      data: { resolvedParams: Record<string, unknown> };
    };
    expect(sentData.data.resolvedParams).not.toHaveProperty("conversationId");
    expect(sentData.data.resolvedParams).not.toHaveProperty("organizationId");
  });
});

// ---------------------------------------------------------------------------
// ④ execute never throws
// ---------------------------------------------------------------------------

describe("createCliToolset — execute never throws", () => {
  test("管道内抛错 → 返回 {success:false,error}（不抛出）", async () => {
    mockList.mockResolvedValue([makeRow()]);
    mockResolveAsset.mockResolvedValue(null as never); // 触发 "资产不存在或无权访问"
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    const exec = getExecute(ts, "cli__ffmpeg-transcode");

    const out = (await exec({ source: "asset-x", ext: "mp4" })) as {
      success: boolean;
      error?: string;
    };

    expect(out.success).toBe(false);
    expect(out.error).toContain("资产不存在或无权访问");
    // run 行被标 failed
    expect(mockUpdateRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
  });

  test("validateParams 抛错 → 返回 {success:false}（run 行未创建）", async () => {
    mockList.mockResolvedValue([makeRow()]);
    mockValidate.mockImplementation(() => {
      throw new Error('未知参数 "evil"');
    });
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    const exec = getExecute(ts, "cli__ffmpeg-transcode");

    const out = (await exec({ evil: "x" })) as { success: boolean; error?: string };
    expect(out.success).toBe(false);
    expect(out.error).toContain("未知参数");
    expect(mockInsertRun).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ⑤ Nonzero exit code
// ---------------------------------------------------------------------------

describe("createCliToolset — nonzero exit code", () => {
  test("exitCode!==0 → 返回 {success:false} + stderrTail，并标 run failed", async () => {
    mockList.mockResolvedValue([makeRow()]);
    mockRunCli.mockResolvedValue({ exitCode: 1, stderrTail: "boom" });
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    const exec = getExecute(ts, "cli__ffmpeg-transcode");

    const out = (await exec({ source: "asset-1", ext: "mp4" })) as {
      success: boolean;
      error?: string;
      stderrTail?: string;
    };

    expect(out.success).toBe(false);
    expect(out.error).toContain("退出码 1");
    expect(out.stderrTail).toBe("boom");
    expect(mockStore).not.toHaveBeenCalled();
    expect(mockUpdateRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed", exitCode: 1 }),
    );
  });
});

// ---------------------------------------------------------------------------
// per-tool build isolation
// ---------------------------------------------------------------------------

describe("createCliToolset — per-tool build isolation", () => {
  test("单条 row 构建抛错不影响其他工具", async () => {
    // 第一条 argsSchema 故意为 null → buildInputSchema 内 Object.entries 抛错
    mockList.mockResolvedValue([
      makeRow({ id: "bad", slug: "bad-tool", argsSchema: null as never }),
      makeRow({ id: "good", slug: "good-tool" }),
    ]);
    const ts = await createCliToolset("org-1", { authorityLevel: "executor" });
    expect(ts["cli__bad-tool"]).toBeUndefined();
    expect(ts["cli__good-tool"]).toBeDefined();
  });
});
