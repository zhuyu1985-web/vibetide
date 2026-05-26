import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db / auth before importing the action
vi.mock("@/lib/auth/current-user", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "user-test" }),
}));
vi.mock("@/db", () => ({
  db: {
    query: {
      skills: {
        findFirst: vi.fn().mockResolvedValue({
          id: "skill-trending",
          name: "trending_topics",
          category: "data_collection",
          version: "3.0",
          description: "热榜聚合",
          content: "## SKILL.md content",
          inputSchema: { mode: "string", limit: "number" },
          outputSchema: { topics: "array" },
          runtimeConfig: null,
          type: "tool",
          pluginConfig: null,
        }),
      },
    },
  },
}));

const { invokeToolDirectlyMock } = vi.hoisted(() => ({
  invokeToolDirectlyMock: vi.fn(),
}));
vi.mock("@/lib/agent/tool-registry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agent/tool-registry")>(
    "@/lib/agent/tool-registry",
  );
  return {
    ...actual,
    isToolRegistered: (name: string) =>
      name === "trending_topics" || name === "archive_to_drafts" || name === "cms_publish",
    invokeToolDirectly: invokeToolDirectlyMock,
  };
});

import { testSkillExecution } from "../employee-advanced";

beforeEach(() => {
  invokeToolDirectlyMock.mockReset();
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_MODEL = "qwen3-max";
  process.env.OPENAI_API_BASE_URL = "https://example/v1";
});

describe("testSkillExecution real-tool path", () => {
  it("调用真工具并返回真实 payload,runtimeInfo.type 标 Tool", async () => {
    invokeToolDirectlyMock.mockResolvedValueOnce({
      ok: true,
      toolName: "trending_topics",
      params: { mode: "hot", limit: 20 },
      result: { topics: [{ title: "成都串串香", url: "https://weibo.com/x" }], fetchedAt: "2026-05-26T12:00:00Z" },
    });
    const res = await testSkillExecution("skill-trending", JSON.stringify({ mode: "hot", limit: 20 }));
    expect(res.runtimeInfo.type).toMatch(/Tool/);
    const execResult = res.executionResult as { success: boolean; output?: string };
    expect(execResult?.success).toBe(true);
    expect(execResult?.output).toContain("成都串串香");
    expect(res.validationChecks.some(c => c.check === "工具发现" && c.status === "pass")).toBe(true);
  });
});

describe("testSkillExecution write-tool dryRun", () => {
  it("cms_publish 测试入口自动注入 dryRun=true，工具不写 DB", async () => {
    // mock skill 行为 cms_publish
    const skillsMock = vi.mocked((await import("@/db")).db.query.skills.findFirst);
    skillsMock.mockResolvedValueOnce({
      id: "skill-cms",
      name: "cms_publish",
      category: "distribution",
      version: "1.0",
      description: "发到 CMS",
      content: "",
      inputSchema: {},
      outputSchema: {},
      runtimeConfig: null,
      type: "tool",
      pluginConfig: null,
    } as never);

    invokeToolDirectlyMock.mockResolvedValueOnce({
      ok: true,
      toolName: "cms_publish",
      params: { title: "X", body: "Y", dryRun: true },
      result: { dryRun: true, wouldInsert: { title: "X", body: "Y" }, note: "dry-run, no DB write" },
    });

    const res = await testSkillExecution("skill-cms", JSON.stringify({ title: "X", body: "Y" }));
    expect(invokeToolDirectlyMock).toHaveBeenCalledWith(
      "cms_publish",
      expect.objectContaining({ dryRun: true }),
      expect.anything(),
    );
    expect(res.runtimeInfo.type).toMatch(/dryRun/);
  });
});
