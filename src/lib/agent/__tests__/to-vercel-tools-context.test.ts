/**
 * Phase 1 — toVercelTools 第 5 个参数 `context` 注入 organizationId / operatorId 的单测。
 *
 * 背景：
 *   - 直接路径 `invokeToolDirectly(name, params, context)` 已经支持把 organizationId /
 *     operatorId 合并进 rawParams 再走 schema 校验，所以 mission-executor 测试入口
 *     调 cms_publish 没问题。
 *   - LLM agent 路径走 `toVercelTools(agentTools, ...)` 把 ALL_TOOLS[t.name] 原样塞进
 *     AI SDK 的 generateText({ tools })，LLM 触发 tool_call 时**没人注入 orgId**，
 *     于是 cms_publish 直接返回 `{ error: { code: "missing_context" } }`。
 *
 * Phase 1 修复：toVercelTools 加第 5 个可选 `context` 参数，内部 wrap 每个 tool 的 execute
 *   把 organizationId / operatorId 合并进 args 再调原 execute。
 *
 * 3 个 case：
 *   1. 不传 context → 行为与今天完全一致（向后兼容）
 *   2. 传 context.organizationId → execute 收到注入的 organizationId
 *   3. args 显式带 organizationId → 显式值优先，context 不覆盖
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const publishArticleToCmsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    success: true,
    publicationId: "pub-1",
    cmsArticleId: "9999",
    cmsState: "submitted",
    publishedUrl: "https://web/article/9999",
    previewUrl: "https://preview/9999",
    timings: { totalMs: 1, mappingMs: 1, httpMs: 1 },
  }),
);
const insertMock = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: "art-1" }]));

vi.mock("@/lib/cms", () => ({
  publishArticleToCms: publishArticleToCmsMock,
}));
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertMock })),
    })),
  },
}));
vi.mock("@/db/schema/articles", () => ({ articles: {} }));

import { toVercelTools } from "../tool-registry";

beforeEach(() => {
  process.env.CMS_HOST = "https://cms.test";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "t";
  process.env.CMS_USERNAME = "u";
  process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "true";
  publishArticleToCmsMock.mockClear();
  insertMock.mockClear();
});

describe("toVercelTools — context 注入", () => {
  const cmsAgentTool = {
    name: "cms_publish",
    description: "x",
    parameters: {},
  };

  it("不传 context → execute 收到的 args 没有 organizationId/operatorId（向后兼容）", async () => {
    const tools = toVercelTools([cmsAgentTool], undefined, undefined, undefined);
    const cms = tools.cms_publish;
    expect(cms).toBeDefined();
    expect(typeof cms.execute).toBe("function");

    const result = (await (
      cms.execute as (args: Record<string, unknown>, opts: unknown) => Promise<unknown>
    )(
      { title: "T", body: "B" },
      { toolCallId: "x", messages: [] },
    )) as { success: boolean; error?: { code?: string } };

    // 因为 organizationId 不在 args 也不在 context，工具会按 missing_context 走错误分支
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("missing_context");
    expect(publishArticleToCmsMock).not.toHaveBeenCalled();
  });

  it("传 context.organizationId → execute 收到注入的 organizationId & operatorId", async () => {
    const tools = toVercelTools([cmsAgentTool], undefined, undefined, undefined, {
      organizationId: "org-1",
      operatorId: "op-1",
    });
    const cms = tools.cms_publish;

    await (cms.execute as (args: Record<string, unknown>, opts: unknown) => Promise<unknown>)(
      { title: "T", body: "B" },
      { toolCallId: "x", messages: [] },
    );

    // organizationId 注入后，工具走入 publishArticleToCms 真实路径
    expect(insertMock).toHaveBeenCalled();
    expect(publishArticleToCmsMock).toHaveBeenCalledWith(
      expect.objectContaining({ operatorId: "op-1" }),
    );
  });

  it("显式 args.organizationId 优先（context 不覆盖）", async () => {
    const tools = toVercelTools([cmsAgentTool], undefined, undefined, undefined, {
      organizationId: "ctx-org",
      operatorId: "ctx-op",
    });
    const cms = tools.cms_publish;

    await (cms.execute as (args: Record<string, unknown>, opts: unknown) => Promise<unknown>)(
      {
        title: "T",
        body: "B",
        organizationId: "explicit-org",
        operatorId: "explicit-op",
      },
      { toolCallId: "x", messages: [] },
    );

    expect(publishArticleToCmsMock).toHaveBeenCalledWith(
      expect.objectContaining({ operatorId: "explicit-op" }),
    );
  });
});
