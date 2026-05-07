/**
 * A6 Phase 3 — research_query_builder tool 单测
 *
 * 4 case：
 *   1. 正常 user_intent → conditions / sidebarFilter / applyUrl 正确
 *   2. district 名找不到 → reasoning 显式说明降级（LLM 自主决策，单测仅验证 mock 输出形态）
 *   3. topic 名找不到 → reasoning 类似降级
 *   4. >10 conditions → zod schema 拦截抛错
 *
 * Mock 策略：
 *   - `@/db`：stub `db.select(...).from(...)` 链 + `db.query.aiEmployees.findFirst`
 *     避开真实 PG 连接
 *   - `@/lib/agent/assembly`：stub `assembleAgent` 返回固定 systemPrompt + modelConfig
 *   - `@/lib/agent/model-router`：stub `getLanguageModel` 返回 dummy 对象
 *   - `ai`：stub `generateText` 按 case 返回不同 output；保留 `tool` / `Output` 真实导出
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks（必须在 import target 前 hoist） ──────────────────────────

vi.mock("@/db", () => ({
  db: {
    // db.select({ ... }).from(table) → 返回一个 Promise<rows>
    select: vi.fn(),
    query: {
      aiEmployees: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/agent/assembly", () => ({
  assembleAgent: vi.fn(),
}));

vi.mock("@/lib/agent/model-router", () => ({
  getLanguageModel: vi.fn(() => ({ __mockModel: true })),
}));

// ai 模块只 stub generateText；tool / Output 保留真实实现
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

// ─── 现在再 import target & mocked deps ─────────────────────────────

import { generateText } from "ai";
import { db } from "@/db";
import { assembleAgent } from "@/lib/agent/assembly";
import { createResearchQueryBuilderTool } from "../research-query-builder";

// ─── 测试 fixtures ──────────────────────────────────────────────────

const FIXTURE_DISTRICTS = [
  { id: "d-fuling", name: "涪陵区" },
  { id: "d-yongchuan", name: "永川区" },
];
const FIXTURE_TOPICS = [
  { id: "t-rural", name: "乡村振兴" },
  { id: "t-edu", name: "教育" },
];

function setupDbDictionaryMocks() {
  // db.select({ id, name }).from(table) 链：
  //   select() 返回 { from: () => Promise<rows> }
  // 第一次调用 → districts；第二次 → topics（按 createResearchQueryBuilderTool
  // 里 Promise.all 顺序）。Promise.all 不保证 await 顺序但保证 fn 调用顺序，所以
  // 用 mockReturnValueOnce 串两次。
  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce({
      from: vi.fn().mockResolvedValue(FIXTURE_DISTRICTS),
    })
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(FIXTURE_TOPICS),
      }),
    });
}

function setupXiaoyanMock() {
  (
    db.query.aiEmployees.findFirst as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    id: "emp-xiaoyan-uuid",
    slug: "xiaoyan",
    organizationId: "test-org",
  });
}

function setupAssembleAgentMock() {
  (assembleAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
    systemPrompt: "你是研究检索构建 mock prompt",
    modelConfig: { provider: "mock", modelId: "mock.model" },
    tools: [],
    pluginConfigs: new Map(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helper：调 tool execute（绕开 ai SDK tool() 包装， execute 直接拿到） ─

async function runTool(
  user_intent: string,
  orgId = "test-org",
): Promise<unknown> {
  const t = createResearchQueryBuilderTool(orgId);
  // ai SDK v6 的 tool() 返回的对象上 execute 是一个 function
  // 第二个参数是 ToolCallOptions（包含 messages / toolCallId 等），单测只
  // 用第一个参数，第二个用 stub 即可。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exec = (t as any).execute;
  return exec({ user_intent }, {
    toolCallId: "tc-1",
    messages: [],
  });
}

// ─── Cases ──────────────────────────────────────────────────────────

describe("research_query_builder tool", () => {
  it("Case 1 — 正常 user_intent: 输出 conditions + sidebarFilter + applyUrl", async () => {
    setupDbDictionaryMocks();
    setupXiaoyanMock();
    setupAssembleAgentMock();

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        conditions: [
          { field: "topic", operator: "equals", value: "乡村振兴", logic: "and" },
          {
            field: "publishedAt",
            operator: "between",
            value: ["2025-01-01", "2025-06-30"],
            logic: "and",
          },
          {
            field: "outletTier",
            operator: "equals",
            value: "provincial_municipal",
            logic: "or",
          },
          { field: "outletTier", operator: "equals", value: "central", logic: "or" },
          {
            field: "outletRegion",
            operator: "equals",
            value: "重庆",
            logic: "and",
          },
        ],
        sidebarFilter: { topicIds: ["t-rural"] },
        reasoning:
          "拆 5 条：主题=乡村振兴；时间=2025 上半年；'省级及以上'=省市级 OR 央级（2 条 OR）；区域=重庆。同步把主题 ID 放进 sidebarFilter。",
      },
    });

    const result = (await runTool(
      "我想看 2025 上半年重庆乡村振兴的省级及以上媒体报道",
    )) as {
      conditions: unknown[];
      sidebarFilter: { topicIds?: string[] } | null;
      reasoning: string;
      applyUrl: string;
    };

    expect(result.conditions).toHaveLength(5);
    expect(result.sidebarFilter).toEqual({ topicIds: ["t-rural"] });
    expect(result.reasoning).toContain("乡村振兴");

    // applyUrl: /research?mode=advanced&apply_query_builder=<encoded JSON>
    expect(result.applyUrl).toMatch(
      /^\/research\?mode=advanced&apply_query_builder=/,
    );
    const encoded = result.applyUrl.split("apply_query_builder=")[1];
    const decoded = JSON.parse(decodeURIComponent(encoded)) as {
      conditions: unknown[];
    };
    expect(decoded.conditions).toHaveLength(5);

    // assembleAgent 用 3 位置参数 + skillOverrides=['research_query_builder']
    expect(assembleAgent).toHaveBeenCalledWith(
      "emp-xiaoyan-uuid",
      undefined,
      { skillOverrides: ["research_query_builder"] },
    );
  });

  it("Case 2 — district 名找不到时 LLM 自主降级，reasoning 显式说明", async () => {
    setupDbDictionaryMocks();
    setupXiaoyanMock();
    setupAssembleAgentMock();

    // user 提到 "巴南区不存在的镇" — 字典里只有涪陵/永川。
    // mock LLM 输出：不带 district condition，改用 content contains，
    // reasoning 显式 "字典里找不到"。
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        conditions: [
          {
            field: "content",
            operator: "contains",
            value: "巴南区不存在的镇",
            logic: "and",
          },
        ],
        sidebarFilter: null,
        reasoning:
          "available_districts 字典里没有匹配项（仅含涪陵区/永川区），降级用 content contains 模糊匹配关键词。",
      },
    });

    const result = (await runTool(
      "查 2025 年巴南区不存在的镇相关报道",
    )) as { reasoning: string; conditions: unknown[] };

    expect(result.conditions).toHaveLength(1);
    expect(result.reasoning).toMatch(/降级|找不到|没有匹配|字典/);
  });

  it("Case 3 — topic 名找不到时 LLM 降级到 title contains", async () => {
    setupDbDictionaryMocks();
    setupXiaoyanMock();
    setupAssembleAgentMock();

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        conditions: [
          {
            field: "title",
            operator: "contains",
            value: "区块链",
            logic: "and",
          },
        ],
        sidebarFilter: null,
        reasoning:
          "字典 available_topics 里没有'区块链'主题（仅含乡村振兴/教育），降级用 title contains 关键词模糊匹配。",
      },
    });

    const result = (await runTool("查区块链相关报道")) as {
      reasoning: string;
      conditions: unknown[];
    };

    expect(result.conditions).toHaveLength(1);
    expect(result.reasoning).toMatch(/降级|没有|字典/);
  });

  it("Case 4 — generateText 返回 11 条 conditions 时 zod 拦截抛错", async () => {
    setupDbDictionaryMocks();
    setupXiaoyanMock();
    setupAssembleAgentMock();

    // ai SDK v6 的 Output.object({ schema }) 内部走 zod；当 LLM 输出超 10 条时，
    // generateText 内部会抛 NoObjectGeneratedError / SchemaValidationError。
    // 单测里 generateText 是 mock，无法触发真实 schema 验证；改用：mock 抛错来
    // 模拟 ai SDK 校验失败的等效行为，断言 tool execute 把错往上传。
    (generateText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error(
        "[zod] conditions: Array must contain at most 10 element(s)",
      ),
    );

    await expect(
      runTool("我要 11 个条件…（构造一个会让 LLM 拆超 10 条的 intent）"),
    ).rejects.toThrow(/at most 10|conditions|zod/i);
  });
});
