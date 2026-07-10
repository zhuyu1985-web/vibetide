/**
 * M2.3 — toVercelTools 第 6 个参数 `mcpTools` 的单测。
 *
 * 验证点：
 *   1. 传入 mcpTools → 结果中包含对应的 key
 *   2. wrapToolExecuteWithContext 已被应用 — context 里的 organizationId / operatorId
 *      会被合并进 execute 的 args（与 missionTools / knowledgeBaseTools 行为一致）
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

describe("toVercelTools — mcpTools (M2.3)", () => {
  it("mcpTools 的 key 出现在结果 ToolSet 中", () => {
    const executeMock = vi.fn().mockResolvedValue({ ok: true });
    const tools = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      { organizationId: "org-1", operatorId: "op-1" },
      {
        "mcp__srv__x": {
          execute: executeMock,
        },
      } as never,
    );

    expect(tools["mcp__srv__x"]).toBeDefined();
    expect(typeof tools["mcp__srv__x"].execute).toBe("function");
  });

  it("wrapToolExecuteWithContext 已应用 — context 字段注入进 execute args", async () => {
    const executeMock = vi.fn().mockResolvedValue({ ok: true });
    const tools = toVercelTools(
      [],
      undefined,
      undefined,
      undefined,
      { organizationId: "org-1", operatorId: "op-1" },
      {
        "mcp__srv__x": {
          execute: executeMock,
        },
      } as never,
    );

    await (
      tools["mcp__srv__x"].execute as (
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

  it("mcpTools 未传 → 不影响其他 key", () => {
    const tools = toVercelTools([], undefined, undefined, undefined, undefined, undefined);
    // 没有报错，结果是空对象即可
    expect(Object.keys(tools)).toHaveLength(0);
  });
});
