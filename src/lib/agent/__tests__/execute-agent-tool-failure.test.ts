/**
 * Phase 2 — executeAgent 透传 context + 工具失败追踪单测。
 *
 * 背景:
 *   - Bug A (context 透传): LLM agent 路径 generateText 调 tool 时若不把 organizationId /
 *     operatorId 通过 ToolContext 注入,cms_publish 等需要 org 上下文的工具会直接返回
 *     `{ success: false, error: { code: "missing_context" } }`。Phase 1 让
 *     toVercelTools 第 5 个参数收 context, Phase 2 让 executeAgent 透传给它。
 *   - Bug B (失败追踪): 当 tool 返回 success=false 时,LLM 会把失败写进文本叙述,但
 *     parseStepOutput 只看文本结构、识别不到失败,导致 output.status 仍是 "success"。
 *     Phase 2 在 onStepFinish 里扫 toolResults 检测 success=false, 覆盖 output.status
 *     为 "failed" 并填 errorMessage / errorCode。
 *
 * 4 个 case:
 *   1. 正常成功 → status 保持 (不被 override 为 failed)
 *   2. 工具返回 success=false → status=failed, errorMessage 含工具名 + code, errorCode 设
 *   3. 多个工具失败 → errorMessage 体现 "共 N 个工具失败"
 *   4. 传 context → executeAgent 签名兼容 (不抛错)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI SDK before importing execution.ts
const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({
  generateText: generateTextMock,
  stepCountIs: (n: number) => n,
  tool: (def: unknown) => def,
}));
vi.mock("../model-router", () => ({
  getLanguageModel: vi.fn(() => ({ provider: "test" })),
  applySkillOverride: vi.fn((base: unknown) => base),
}));

import { executeAgent } from "../execution";
import type { AssembledAgent, AgentExecutionInput } from "../types";

const baseAgent: AssembledAgent = {
  slug: "xiaolei",
  systemPrompt: "you are a test",
  authorityLevel: "core",
  modelConfig: { provider: "openai", model: "test", temperature: 0.5, maxTokens: 500 },
  tools: [],
  pluginConfigs: undefined,
  knowledgeBaseIds: undefined,
} as unknown as AssembledAgent;

const baseInput: AgentExecutionInput = {
  topicTitle: "测试选题",
  scenario: "test",
  stepLabel: "测试步骤",
  stepKey: "step-1",
  previousSteps: [],
  userInstructions: undefined,
  skillSpec: undefined,
} as unknown as AgentExecutionInput;

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("executeAgent — tool failure detection", () => {
  it("正常成功 → output.status 不被 override 为 failed", async () => {
    generateTextMock.mockImplementation(async ({ onStepFinish }) => {
      onStepFinish?.({
        toolCalls: [{ toolName: "web_search", args: {} }],
        toolResults: [
          { toolName: "web_search", output: { success: true, results: [{ id: 1 }] } },
        ],
      });
      return {
        text: "【执行摘要】成功\n\n【执行过程】\n1. 搜索...\n\n【产出结果】xxx\n\n【质量自评:85/100】",
        usage: { inputTokens: 100, outputTokens: 200 },
      };
    });

    const result = await executeAgent(baseAgent, baseInput);
    expect(result.output.status).not.toBe("failed");
    expect(result.output.errorMessage).toBeUndefined();
  });

  it("成功工具结果保留结构化字段，供下游步骤参数引用", async () => {
    generateTextMock.mockImplementation(async ({ onStepFinish }) => {
      onStepFinish?.({
        toolCalls: [{ toolName: "archive_to_drafts", args: {} }],
        toolResults: [
          {
            toolName: "archive_to_drafts",
            output: {
              success: true,
              totalCreated: 1,
              firstArticleId: "11111111-1111-4111-8111-111111111111",
              created: [
                {
                  articleId: "11111111-1111-4111-8111-111111111111",
                  title: "早报标题",
                },
              ],
            },
          },
        ],
      });
      return {
        text: "【执行摘要】稿件已入库\n\n【执行过程】\n1. 写入 articles\n\n【产出结果】已创建 1 篇稿件\n",
        usage: { inputTokens: 100, outputTokens: 200 },
      };
    });

    const result = await executeAgent(baseAgent, baseInput);

    expect(result.output.status).toBe("success");
    expect(result.output.firstArticleId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(result.output.created).toEqual([
      {
        articleId: "11111111-1111-4111-8111-111111111111",
        title: "早报标题",
      },
    ]);
  });

  it("content_generate 文本产出会暴露 articles[] 供 archive_to_drafts 消费", async () => {
    generateTextMock.mockImplementation(async () => ({
      text: `【执行摘要】完成成都早报撰写

【产出结果】
# 成都早报：城市更新与民生服务提速

今日成都聚焦城市更新、交通出行和公共服务优化。多个区县发布便民事项，产业园区也有新进展。

## 民生服务
社区服务窗口延长办理时间，方便上班族错峰办理。

【质量自评：86/100】`,
      usage: { inputTokens: 100, outputTokens: 200 },
    }));

    const result = await executeAgent(baseAgent, {
      ...baseInput,
      stepKey: "step-4",
      stepLabel: "早晚报撰写",
      skillSlug: "content_generate",
    });

    expect(result.output.title).toBe("成都早报：城市更新与民生服务提速");
    expect(result.output.body).toContain("今日成都聚焦城市更新");
    expect(result.output.articles).toEqual([
      expect.objectContaining({
        title: "成都早报：城市更新与民生服务提速",
        body: expect.stringContaining("今日成都聚焦城市更新"),
        language: "zh",
      }),
    ]);
  });

  it("content_generate JSON 产出会解包 title/bodyMarkdown 而不是把 JSON 入库", async () => {
    generateTextMock.mockImplementation(async () => ({
      text: `【执行摘要】完成成都早报撰写

【产出结果】
\`\`\`json
{
  "meta": { "contentId": "ai-brief-chengdu-20260530" },
  "title": "成都AI早晚报（2026年5月30日）",
  "summary": "今日成都AI领域迎来两大关键进展。",
  "bodyHtml": "<h1>成都AI早晚报（2026年5月30日）</h1><p>今日，成都AI领域迎来两大关键进展。</p>",
  "bodyMarkdown": "# 成都AI早晚报（2026年5月30日）\\n\\n今日，成都AI领域迎来两大关键进展。"
}
\`\`\`

【质量自评：88/100】`,
      usage: { inputTokens: 100, outputTokens: 200 },
    }));

    const result = await executeAgent(baseAgent, {
      ...baseInput,
      stepKey: "step-4",
      stepLabel: "早晚报撰写",
      skillSlug: "content_generate",
    });

    expect(result.output.title).toBe("成都AI早晚报（2026年5月30日）");
    expect(result.output.body).toBe(
      "# 成都AI早晚报（2026年5月30日）\n\n今日，成都AI领域迎来两大关键进展。",
    );
    expect(result.output.body).not.toContain('"meta"');
    expect(result.output.articles).toEqual([
      expect.objectContaining({
        title: "成都AI早晚报（2026年5月30日）",
        body: "# 成都AI早晚报（2026年5月30日）\n\n今日，成都AI领域迎来两大关键进展。",
        summary: "今日成都AI领域迎来两大关键进展。",
        language: "zh",
      }),
    ]);
  });

  it("工具返回 success=false → output.status=failed + errorMessage 含工具名和 code", async () => {
    generateTextMock.mockImplementation(async ({ onStepFinish }) => {
      onStepFinish?.({
        toolCalls: [{ toolName: "cms_publish", args: {} }],
        toolResults: [
          {
            toolName: "cms_publish",
            output: {
              success: false,
              error: { code: "missing_context", message: "cms_publish 需要 organizationId" },
            },
          },
        ],
      });
      return {
        text: "【执行摘要】调用 cms_publish 失败...\n\n【产出结果】无法入库\n",
        usage: { inputTokens: 100, outputTokens: 200 },
      };
    });

    const result = await executeAgent(baseAgent, baseInput);
    expect(result.output.status).toBe("failed");
    expect(result.output.errorMessage).toContain("cms_publish");
    expect(result.output.errorMessage).toContain("missing_context");
    expect(result.output.errorCode).toBe("missing_context");
  });

  it("多个工具失败 → errorMessage 描述总数", async () => {
    generateTextMock.mockImplementation(async ({ onStepFinish }) => {
      onStepFinish?.({
        toolCalls: [
          { toolName: "cms_publish", args: {} },
          { toolName: "archive_to_drafts", args: {} },
        ],
        toolResults: [
          {
            toolName: "cms_publish",
            output: { success: false, error: { code: "a", message: "fail1" } },
          },
          {
            toolName: "archive_to_drafts",
            output: { success: false, error: { code: "b", message: "fail2" } },
          },
        ],
      });
      return {
        text: "【产出结果】fail\n",
        usage: { inputTokens: 100, outputTokens: 200 },
      };
    });

    const result = await executeAgent(baseAgent, baseInput);
    expect(result.output.status).toBe("failed");
    expect(result.output.errorMessage).toMatch(/共\s*2\s*个/);
  });
});

describe("executeAgent — context parameter", () => {
  it("传 context → executeAgent 签名兼容,不抛错", async () => {
    generateTextMock.mockImplementation(async () => {
      return {
        text: "【产出结果】ok\n",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    });

    const result = await executeAgent(baseAgent, baseInput, undefined, undefined, {
      organizationId: "org-1",
      operatorId: "op-1",
    });
    expect(result).toBeDefined();
    expect(result.output.status).not.toBe("failed");
  });
});
