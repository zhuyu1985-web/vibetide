import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const insertCalls = vi.hoisted(() => [] as Array<{ values: Record<string, unknown> }>);
const updateSetCalls = vi.hoisted(() => [] as Array<{ values: Record<string, unknown> }>);
const deleteCalls = vi.hoisted(() => [] as string[]);
const getCliToolByIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "u1" }),
}));
vi.mock("@/lib/dal/auth", () => ({
  getCurrentUserOrg: vi.fn().mockResolvedValue("org1"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/dal/cli-tools", () => ({
  getCliToolById: getCliToolByIdMock,
}));

vi.mock("@/db/schema", () => ({
  cliTools: {} as never,
}));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        insertCalls.push({ values });
        return {
          returning: vi.fn().mockResolvedValue([{ id: "new-tool-id" }]),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        updateSetCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      },
    })),
    delete: vi.fn(() => ({
      where: vi.fn((where: unknown) => {
        deleteCalls.push(String(where));
        return Promise.resolve();
      }),
    })),
  },
}));

// allowlist mock — controls which binaries are "allowed"
const assertAllowedBinaryMock = vi.hoisted(() => vi.fn());
const probeBinaryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cli/allowlist", () => ({
  assertAllowedBinary: assertAllowedBinaryMock,
  probeBinary: probeBinaryMock,
  allowedBinaries: vi.fn().mockReturnValue(["ffmpeg", "yt-dlp"]),
}));

vi.mock("@/lib/cli/toolset", () => ({
  createCliToolset: vi.fn().mockResolvedValue({}),
}));

import {
  createCliTool,
  updateCliTool,
  toggleCliTool,
  deleteCliTool,
  testRunCliTool,
} from "../cli-tools";

const VALID_ARGS_SCHEMA = JSON.stringify({ input: { type: "asset", required: true } });
const VALID_ARGV_TEMPLATE = JSON.stringify([{ param: "input" }, { output: "out" }]);

const EXISTING_TOOL = {
  id: "tool-1",
  organizationId: "org1",
  name: "FFmpeg Transcode",
  description: "视频转码",
  slug: "ffmpeg-transcode",
  command: "ffmpeg",
  argsSchema: { input: { type: "asset", required: true } },
  argvTemplate: [{ param: "input" }, { output: "out" }],
  executionMode: "sync",
  toolClass: "write",
  syncTimeoutMs: 20000,
  outputKind: "media_asset",
  enabled: 1,
  createdAt: new Date(),
};

beforeEach(() => {
  insertCalls.length = 0;
  updateSetCalls.length = 0;
  deleteCalls.length = 0;
  getCliToolByIdMock.mockReset();
  getCliToolByIdMock.mockResolvedValue(EXISTING_TOOL);
  assertAllowedBinaryMock.mockReset();
  assertAllowedBinaryMock.mockImplementation(() => {
    // default: allow "ffmpeg"
  });
  probeBinaryMock.mockReset();
  probeBinaryMock.mockResolvedValue({ ok: true });
});

// ─── createCliTool ──────────────────────────────────────────────────────────

describe("createCliTool", () => {
  it("rejects command not in allowlist (assertAllowedBinary throws)", async () => {
    assertAllowedBinaryMock.mockImplementation((cmd: string) => {
      throw new Error(`命令未在 CLI_ALLOWED_BINARIES 白名单：${cmd}`);
    });

    await expect(
      createCliTool({
        name: "Bad Tool",
        description: "测试",
        command: "rm",
        argsSchemaJson: VALID_ARGS_SCHEMA,
        argvTemplateJson: VALID_ARGV_TEMPLATE,
        executionMode: "sync",
        toolClass: "write",
      })
    ).rejects.toThrow("CLI_ALLOWED_BINARIES 白名单");

    expect(insertCalls.length).toBe(0);
  });

  it("rejects empty name", async () => {
    await expect(
      createCliTool({
        name: "   ",
        description: "测试",
        command: "ffmpeg",
        argsSchemaJson: VALID_ARGS_SCHEMA,
        argvTemplateJson: VALID_ARGV_TEMPLATE,
        executionMode: "sync",
        toolClass: "write",
      })
    ).rejects.toThrow("不能为空");
    expect(insertCalls.length).toBe(0);
  });

  it("rejects invalid argsSchema JSON", async () => {
    await expect(
      createCliTool({
        name: "Test",
        description: "测试",
        command: "ffmpeg",
        argsSchemaJson: "not-json",
        argvTemplateJson: VALID_ARGV_TEMPLATE,
        executionMode: "sync",
        toolClass: "write",
      })
    ).rejects.toThrow("JSON 格式错误");
    expect(insertCalls.length).toBe(0);
  });

  it("rejects argsSchema that is not an object", async () => {
    await expect(
      createCliTool({
        name: "Test",
        description: "测试",
        command: "ffmpeg",
        argsSchemaJson: "[1,2,3]",
        argvTemplateJson: VALID_ARGV_TEMPLATE,
        executionMode: "sync",
        toolClass: "write",
      })
    ).rejects.toThrow("必须是 JSON 对象");
    expect(insertCalls.length).toBe(0);
  });

  it("rejects argvTemplate that is not an array", async () => {
    await expect(
      createCliTool({
        name: "Test",
        description: "测试",
        command: "ffmpeg",
        argsSchemaJson: VALID_ARGS_SCHEMA,
        argvTemplateJson: '{"not": "array"}',
        executionMode: "sync",
        toolClass: "write",
      })
    ).rejects.toThrow("必须是 JSON 数组");
    expect(insertCalls.length).toBe(0);
  });

  it("inserts with correct org-scoped fields for valid input", async () => {
    const result = await createCliTool({
      name: "FFmpeg Tool",
      description: "转码工具",
      command: "ffmpeg",
      argsSchemaJson: VALID_ARGS_SCHEMA,
      argvTemplateJson: VALID_ARGV_TEMPLATE,
      executionMode: "sync",
      toolClass: "write",
      syncTimeoutMs: 30000,
    });

    expect(result.id).toBe("new-tool-id");
    expect(insertCalls.length).toBe(1);
    const vals = insertCalls[0].values;
    expect(vals.organizationId).toBe("org1");
    expect(vals.name).toBe("FFmpeg Tool");
    expect(vals.slug).toBe("ffmpeg-tool");
    expect(vals.command).toBe("ffmpeg");
    expect(vals.syncTimeoutMs).toBe(30000);
  });

  it("returns probeWarning when binary is not installed (non-fatal)", async () => {
    probeBinaryMock.mockResolvedValue({ ok: false, error: "binary 不可用：ffmpeg" });

    const result = await createCliTool({
      name: "Test",
      description: "测试",
      command: "ffmpeg",
      argsSchemaJson: VALID_ARGS_SCHEMA,
      argvTemplateJson: VALID_ARGV_TEMPLATE,
      executionMode: "sync",
      toolClass: "write",
    });

    // Should still insert — probe failure is non-fatal
    expect(insertCalls.length).toBe(1);
    expect(result.probeWarning).toBeTruthy();
    expect(result.probeWarning).toContain("ffmpeg");
  });

  it("returns no probeWarning when binary is available", async () => {
    probeBinaryMock.mockResolvedValue({ ok: true });

    const result = await createCliTool({
      name: "Test",
      description: "测试",
      command: "ffmpeg",
      argsSchemaJson: VALID_ARGS_SCHEMA,
      argvTemplateJson: VALID_ARGV_TEMPLATE,
      executionMode: "sync",
      toolClass: "write",
    });

    expect(result.probeWarning).toBeUndefined();
  });
});

// ─── updateCliTool ──────────────────────────────────────────────────────────

describe("updateCliTool", () => {
  it("throws when tool not found (org isolation)", async () => {
    getCliToolByIdMock.mockResolvedValueOnce(null);
    await expect(
      updateCliTool("missing-id", { name: "new name" })
    ).rejects.toThrow("不存在或无权访问");
    expect(updateSetCalls.length).toBe(0);
  });

  it("rejects command update with non-allowlisted binary", async () => {
    assertAllowedBinaryMock.mockImplementation((cmd: string) => {
      if (cmd !== "ffmpeg") throw new Error(`命令未在 CLI_ALLOWED_BINARIES 白名单：${cmd}`);
    });

    await expect(
      updateCliTool("tool-1", { command: "curl" })
    ).rejects.toThrow("CLI_ALLOWED_BINARIES 白名单");
    expect(updateSetCalls.length).toBe(0);
  });

  it("rejects empty name on update", async () => {
    await expect(
      updateCliTool("tool-1", { name: "  " })
    ).rejects.toThrow("不能为空");
    expect(updateSetCalls.length).toBe(0);
  });

  it("updates only provided fields", async () => {
    await updateCliTool("tool-1", { toolClass: "read" });
    expect(updateSetCalls.length).toBe(1);
    expect(updateSetCalls[0].values.toolClass).toBe("read");
    expect(updateSetCalls[0].values.name).toBeUndefined();
  });
});

// ─── toggleCliTool ──────────────────────────────────────────────────────────

describe("toggleCliTool", () => {
  it("throws when tool not found", async () => {
    getCliToolByIdMock.mockResolvedValueOnce(null);
    await expect(toggleCliTool("missing", true)).rejects.toThrow(
      "不存在或无权访问"
    );
  });

  it("sets enabled=1 when enabling", async () => {
    await toggleCliTool("tool-1", true);
    expect(updateSetCalls[0].values.enabled).toBe(1);
  });

  it("sets enabled=0 when disabling", async () => {
    await toggleCliTool("tool-1", false);
    expect(updateSetCalls[0].values.enabled).toBe(0);
  });
});

// ─── deleteCliTool ──────────────────────────────────────────────────────────

describe("deleteCliTool", () => {
  it("throws when tool not found", async () => {
    getCliToolByIdMock.mockResolvedValueOnce(null);
    await expect(deleteCliTool("missing")).rejects.toThrow("不存在或无权访问");
    expect(deleteCalls.length).toBe(0);
  });

  it("deletes when tool exists in org", async () => {
    await deleteCliTool("tool-1");
    expect(deleteCalls.length).toBe(1);
  });
});

// ─── testRunCliTool ─────────────────────────────────────────────────────────

describe("testRunCliTool", () => {
  it("returns error when tool not found", async () => {
    getCliToolByIdMock.mockResolvedValueOnce(null);
    const result = await testRunCliTool("missing", {});
    expect(result).toEqual({
      ok: false,
      error: "CLI 工具不存在或无权访问",
    });
  });

  it("returns error when tool key not found in toolset", async () => {
    const { createCliToolset } = await import("@/lib/cli/toolset");
    vi.mocked(createCliToolset).mockResolvedValueOnce({});

    const result = await testRunCliTool("tool-1", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("未找到");
  });

  it("returns ok:true on successful execute", async () => {
    const { createCliToolset } = await import("@/lib/cli/toolset");
    // slug "ffmpeg-transcode" → sanitize → "cli__ffmpeg-transcode" (hyphens preserved)
    vi.mocked(createCliToolset).mockResolvedValueOnce({
      "cli__ffmpeg-transcode": {
        inputSchema: {} as never,
        description: "test",
        execute: vi.fn().mockResolvedValue({
          success: true,
          assetId: "asset-123",
          publicUrl: "https://cdn.example.com/out.mp4",
        }),
      },
    });

    const result = await testRunCliTool("tool-1", { input: "some-asset" });
    expect(result.ok).toBe(true);
    expect(result.assetId).toBe("asset-123");
  });

  it("returns ok:false on execute failure", async () => {
    const { createCliToolset } = await import("@/lib/cli/toolset");
    // slug "ffmpeg-transcode" → sanitize → "cli__ffmpeg-transcode" (hyphens preserved)
    vi.mocked(createCliToolset).mockResolvedValueOnce({
      "cli__ffmpeg-transcode": {
        inputSchema: {} as never,
        description: "test",
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: "CLI 退出码 1",
          stderrTail: "No such file or directory",
        }),
      },
    });

    const result = await testRunCliTool("tool-1", { input: "bad-asset" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("CLI 退出码 1");
    expect(result.stderrTail).toBe("No such file or directory");
  });

  it("never throws — returns error object on unexpected exception", async () => {
    const { createCliToolset } = await import("@/lib/cli/toolset");
    vi.mocked(createCliToolset).mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await testRunCliTool("tool-1", {});
    expect(result.ok).toBe(false);
    expect(result.error).toBe("DB connection lost");
  });
});
