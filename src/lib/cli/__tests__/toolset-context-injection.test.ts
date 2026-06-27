/**
 * M3.6 回归测试（High bug 修复）—— context 注入 + validateParams 组合路径。
 *
 * 复现真实调用链：createCliToolset → toVercelTools（**真实** wrapToolExecuteWithContext）
 * → 注入真实 context { organizationId, operatorId } → 调用 tool.execute。
 *
 * 修复前：wrap 把 organizationId/operatorId 合并进 args，CLI execute 内的 **真实**
 * validateParams 因 "未知参数 organizationId" 抛错 → catch → {success:false}，
 * CLI 工具端到端跑不通。
 *
 * 本测试用 **真实** ../argv（validateParams/resolveArgv 不 mock），只 mock DAL /
 * spawn / asset-io / scratch / node:fs 这些 I/O 叶子，断言：经 context 注入后仍
 * 进入同步管道并返回 {success:true, assetId}。
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// tool-registry 顶层 import 了 @/db / @/db/schema —— mock 掉避免真实 DB 连接
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}));
vi.mock("@/db/schema/articles", () => ({ articles: {} }));
vi.mock("@/db/schema", () => ({ mediaAssets: {} }));
vi.mock("@/lib/cms", () => ({ publishArticleToCms: vi.fn() }));

// CLI 叶子 I/O —— mock；注意 ../argv **不 mock**（要真实 validateParams 暴露 bug）
vi.mock("@/lib/dal/cli-tools", () => ({
  listEnabledCliTools: vi.fn(),
  insertCliToolRun: vi.fn(),
  updateCliToolRun: vi.fn(),
}));
vi.mock("../allowlist", () => ({ assertAllowedBinary: vi.fn() }));
vi.mock("../spawn", () => ({ runCli: vi.fn() }));
vi.mock("../scratch", () => ({
  withScratchDir: vi.fn(async (fn: (dir: string) => Promise<unknown>) => fn("/tmp/scratch-xyz")),
}));
vi.mock("@/lib/media/asset-io", () => ({
  resolveOrgAsset: vi.fn(),
  downloadObjectToFile: vi.fn(),
  storeBufferAsAsset: vi.fn(),
  probeMedia: vi.fn(),
}));
// 只覆盖 promises.readFile（CLI 输出读取），其余 node:fs 保留真实实现 ——
// tool-registry → skill-loader 在 import 期会用 fs.existsSync/readdirSync。
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn().mockResolvedValue(Buffer.from("OUTPUT_BYTES")),
    },
  };
});

import {
  listEnabledCliTools,
  insertCliToolRun,
  updateCliToolRun,
} from "@/lib/dal/cli-tools";
import { runCli } from "../spawn";
import {
  resolveOrgAsset,
  downloadObjectToFile,
  storeBufferAsAsset,
  probeMedia,
} from "@/lib/media/asset-io";
import { createCliToolset } from "../toolset";
import { toVercelTools } from "@/lib/agent/tool-registry";

const mockList = vi.mocked(listEnabledCliTools);
const mockInsertRun = vi.mocked(insertCliToolRun);
const mockUpdateRun = vi.mocked(updateCliToolRun);
const mockRunCli = vi.mocked(runCli);
const mockResolveAsset = vi.mocked(resolveOrgAsset);
const mockDownload = vi.mocked(downloadObjectToFile);
const mockStore = vi.mocked(storeBufferAsAsset);
const mockProbe = vi.mocked(probeMedia);

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

beforeEach(() => {
  vi.clearAllMocks();
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

describe("createCliToolset — context 注入 + 真实 validateParams 回归（M3.6 High bug）", () => {
  test("经 toVercelTools 真实 wrap 注入 context 后，CLI execute 仍进入同步管道并 success", async () => {
    mockList.mockResolvedValue([makeRow()]);

    // 1. 真实地构造 CLI 工具集
    const cliToolset = await createCliToolset("org-1", { authorityLevel: "executor" });
    expect(cliToolset["cli__ffmpeg-transcode"]).toBeDefined();

    // 2. 经 **真实** toVercelTools 的 wrapToolExecuteWithContext 注入 context
    //    （第 5 参数 context，第 7 参数 cliTools）。这正是 4 个真实调用点的路径。
    const wrapped = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      { organizationId: "org-1", operatorId: "op-1" },
      undefined,
      cliToolset,
    );

    const exec = wrapped["cli__ffmpeg-transcode"].execute as (
      args: Record<string, unknown>,
      opts: unknown,
    ) => Promise<unknown>;

    // 3. AI SDK 触发 tool-call 时只传业务参数；wrap 会把 organizationId/operatorId 注入。
    const out = (await exec(
      { source: "asset-1", ext: "mp4" },
      { toolCallId: "tc-1", messages: [] },
    )) as { success: boolean; assetId?: string; error?: string };

    // 修复前这里会是 {success:false, error:'未知参数 "organizationId"...'}
    expect(out.error).toBeUndefined();
    expect(out.success).toBe(true);
    expect(out.assetId).toBe("asset-out");

    // 确认确实进了同步管道（注入键被剥离后没被 validateParams 拒掉）
    expect(mockInsertRun).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", cliToolId: "tool-1", status: "processing" }),
    );
    expect(mockRunCli).toHaveBeenCalledWith("ffmpeg", expect.any(Array), expect.objectContaining({ timeoutMs: 20000 }));
    expect(mockStore).toHaveBeenCalled();
    expect(mockUpdateRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "done", outputAssetId: "asset-out" }),
    );
  });

  test("注入的上下文键不会被透传进 resolveArgv 的 argv（仅业务参数解析）", async () => {
    mockList.mockResolvedValue([makeRow()]);
    const cliToolset = await createCliToolset("org-1", { authorityLevel: "executor" });
    const wrapped = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      { organizationId: "org-1", operatorId: "op-1", missionId: "m-1", taskId: "t-1" },
      undefined,
      cliToolset,
    );
    const exec = wrapped["cli__ffmpeg-transcode"].execute as (
      a: Record<string, unknown>,
      o: unknown,
    ) => Promise<unknown>;

    const out = (await exec({ source: "asset-1", ext: "mp4" }, { toolCallId: "tc", messages: [] })) as {
      success: boolean;
    };
    expect(out.success).toBe(true);

    // argv 由真实 resolveArgv 生成：-i <scratch input> <scratch output>，
    // 不含任何 organizationId/operatorId/missionId/taskId 字符串。
    const argv = mockRunCli.mock.calls[0][1] as string[];
    const joined = argv.join(" ");
    expect(joined).not.toContain("organizationId");
    expect(joined).not.toContain("op-1");
    expect(joined).not.toContain("m-1");
    expect(joined).not.toContain("t-1");
    expect(argv[0]).toBe("-i");
  });
});
