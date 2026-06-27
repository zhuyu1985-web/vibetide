/**
 * M3.6 — toVercelTools 第 7 个参数 `cliTools` 的单测。
 *
 * 验证点：
 *   1. 传入 cliTools → 结果中包含对应的 key（在 mcpTools 之后合并，互不覆盖）
 *   2. wrapToolExecuteWithContext 已被应用 — context 里的 organizationId /
 *      operatorId 会被合并进 execute 的 args（与 mcpTools 行为一致）
 */

import { describe, it, expect, vi } from "vitest";

// 隔离 DB 相关依赖，避免 tool-registry 顶层 import 触发 DB 连接
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}));
vi.mock("@/db/schema/articles", () => ({ articles: {} }));
vi.mock("@/db/schema", () => ({ mediaAssets: {} }));
vi.mock("@/lib/cms", () => ({ publishArticleToCms: vi.fn() }));

import { toVercelTools } from "../tool-registry";

describe("toVercelTools — cliTools (M3.6)", () => {
  it("cliTools 的 key 出现在结果 ToolSet 中", () => {
    const executeMock = vi.fn().mockResolvedValue({ success: true });
    const tools = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      { organizationId: "org-1", operatorId: "op-1" },
      undefined, // mcpTools
      {
        "cli__ffmpeg-burn-sub": {
          execute: executeMock,
        },
      } as never,
    );

    expect(tools["cli__ffmpeg-burn-sub"]).toBeDefined();
    expect(typeof tools["cli__ffmpeg-burn-sub"].execute).toBe("function");
  });

  it("wrapToolExecuteWithContext 已应用 — context 字段注入进 execute args", async () => {
    const executeMock = vi.fn().mockResolvedValue({ success: true });
    const tools = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      { organizationId: "org-1", operatorId: "op-1" },
      undefined,
      {
        "cli__x": {
          execute: executeMock,
        },
      } as never,
    );

    await (
      tools["cli__x"].execute as (
        args: Record<string, unknown>,
        opts: unknown,
      ) => Promise<unknown>
    )({}, { toolCallId: "tc-1", messages: [] });

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        operatorId: "op-1",
      }),
      { toolCallId: "tc-1", messages: [] },
    );
  });

  it("wrapToolExecuteWithContext 注入 conversationId — 与 missionId 行为一致", async () => {
    const executeMock = vi.fn().mockResolvedValue({ success: true });
    const tools = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      { organizationId: "org-1", operatorId: "op-1", conversationId: "conv-42" },
      undefined,
      {
        "cli__y": {
          execute: executeMock,
        },
      } as never,
    );

    await (
      tools["cli__y"].execute as (
        args: Record<string, unknown>,
        opts: unknown,
      ) => Promise<unknown>
    )({}, { toolCallId: "tc-2", messages: [] });

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        operatorId: "op-1",
        conversationId: "conv-42",
      }),
      { toolCallId: "tc-2", messages: [] },
    );
  });

  it("conversationId 未设时不注入（graceful）", async () => {
    const executeMock = vi.fn().mockResolvedValue({ success: true });
    const tools = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      { organizationId: "org-1", operatorId: "op-1" }, // no conversationId
      undefined,
      { "cli__z": { execute: executeMock } } as never,
    );

    await (
      tools["cli__z"].execute as (
        args: Record<string, unknown>,
        opts: unknown,
      ) => Promise<unknown>
    )({}, { toolCallId: "tc-3", messages: [] });

    const calledArgs = executeMock.mock.calls[0][0] as Record<string, unknown>;
    expect(calledArgs).not.toHaveProperty("conversationId");
  });

  it("cliTools 与 mcpTools 同传 → 两者的 key 都在结果里", () => {
    const tools = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      { "mcp__srv__m": { execute: vi.fn() } } as never,
      { "cli__c": { execute: vi.fn() } } as never,
    );
    expect(tools["mcp__srv__m"]).toBeDefined();
    expect(tools["cli__c"]).toBeDefined();
  });

  it("cliTools 未传 → 不影响其他 key", () => {
    const tools = toVercelTools([], undefined, undefined, undefined, undefined, undefined, undefined);
    expect(Object.keys(tools)).toHaveLength(0);
  });
});
