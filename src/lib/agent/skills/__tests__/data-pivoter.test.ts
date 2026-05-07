/**
 * A6 Phase 4 — data_pivoter tool 单测
 *
 * 3 case：
 *   1. 基础透视（无 current_report_id）→ pivot_config + chart_type + reasoning，applyUrl 为 undefined
 *   2. 含 filter + report_id → applyUrl 编码 pivot_config + chart_type
 *   3. xiaoyan 未 seed → 抛 "xiaoyan employee not seeded"
 *
 * Mock 策略：
 *   - `@/db`：stub `db.query.aiEmployees.findFirst`（避开真实 PG 连接）
 *   - `@/lib/agent/assembly`：stub `assembleAgent` 返回固定 systemPrompt + modelConfig
 *   - `@/lib/agent/model-router`：stub `getLanguageModel` 返回 dummy 对象
 *   - `ai`：stub `generateText` 按 case 返回不同 output；保留 `tool` / `Output` 真实导出
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks（必须在 import target 前 hoist） ──────────────────────────

vi.mock("@/db", () => ({
  db: {
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
import { createDataPivoterTool } from "../data-pivoter";

// ─── 测试 fixtures ──────────────────────────────────────────────────

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
    systemPrompt: "你是数据透视器小研 mock prompt",
    modelConfig: { provider: "mock", modelId: "mock.model" },
    tools: [],
    pluginConfigs: new Map(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helper：调 tool execute（绕开 ai SDK tool() 包装） ────────────

async function runTool(
  args: { user_request: string; current_report_id?: string },
  orgId = "test-org",
): Promise<unknown> {
  const t = createDataPivoterTool(orgId);
  // ai SDK v6 的 tool() 返回的对象上 execute 是一个 function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exec = (t as any).execute;
  return exec(args, {
    toolCallId: "tc-1",
    messages: [],
  });
}

// ─── Cases ──────────────────────────────────────────────────────────

describe("data_pivoter tool", () => {
  it("Case 1 — 基础透视（无 current_report_id）：pivot_config + chart_type，applyUrl undefined", async () => {
    setupXiaoyanMock();
    setupAssembleAgentMock();

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        pivot_config: {
          rows: "topic",
          cols: "district",
          measure: "count",
        },
        chart_type: "heatmap",
        reasoning:
          "按主题×区县做交叉透视，看不同区县在不同主题上的报道密度。双维度 → heatmap。",
      },
    });

    const result = (await runTool({
      user_request: "按主题×区县看分布",
    })) as {
      pivot_config: {
        rows: string;
        cols: string;
        measure: string;
        filter?: Record<string, string[]>;
      };
      chart_type: string;
      reasoning: string;
      applyUrl?: string;
    };

    expect(result.pivot_config.rows).toBe("topic");
    expect(result.pivot_config.cols).toBe("district");
    expect(result.pivot_config.measure).toBe("count");
    expect(result.chart_type).toBe("heatmap");
    expect(result.reasoning).toContain("交叉");

    // 无 current_report_id → applyUrl 不应存在
    expect(result.applyUrl).toBeUndefined();

    // assembleAgent 用 3 位置参数 + skillOverrides=['data_pivoter']
    expect(assembleAgent).toHaveBeenCalledWith(
      "emp-xiaoyan-uuid",
      undefined,
      { skillOverrides: ["data_pivoter"] },
    );
  });

  it("Case 2 — 含 filter + current_report_id：applyUrl 编码 pivot_config", async () => {
    setupXiaoyanMock();
    setupAssembleAgentMock();

    const reportId = "11111111-2222-3333-4444-555555555555";

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: {
        pivot_config: {
          rows: "district",
          cols: "date",
          measure: "count",
          filter: { date: ["2025-06"] },
        },
        chart_type: "bar",
        reasoning:
          "聚焦 6 月份单月，按区县看报道数。filter 限定 date=2025-06，单维度 + count → bar。",
      },
    });

    const result = (await runTool({
      user_request: "6 月份每个区县的报道数",
      current_report_id: reportId,
    })) as {
      pivot_config: {
        rows: string;
        cols: string;
        measure: string;
        filter?: Record<string, string[]>;
      };
      chart_type: string;
      applyUrl?: string;
    };

    expect(result.pivot_config.filter).toEqual({ date: ["2025-06"] });
    expect(result.chart_type).toBe("bar");

    // applyUrl: /research/reports/<uuid>?apply_pivot=<encoded JSON>
    expect(result.applyUrl).toBeDefined();
    expect(result.applyUrl).toContain(`/research/reports/${reportId}`);
    expect(result.applyUrl).toContain("apply_pivot=");

    const encoded = result.applyUrl!.split("apply_pivot=")[1];
    const decoded = JSON.parse(decodeURIComponent(encoded)) as {
      pivot_config: { rows: string; cols: string; filter?: { date?: string[] } };
      chart_type: string;
    };
    expect(decoded.pivot_config.rows).toBe("district");
    expect(decoded.pivot_config.cols).toBe("date");
    expect(decoded.pivot_config.filter).toEqual({ date: ["2025-06"] });
    expect(decoded.chart_type).toBe("bar");
  });

  it("Case 3 — xiaoyan 未 seed 时抛错", async () => {
    // 模拟 org 内未 seed xiaoyan：findFirst 返回 undefined
    (
      db.query.aiEmployees.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue(undefined);
    setupAssembleAgentMock();

    await expect(
      runTool({ user_request: "按主题×区县看分布" }),
    ).rejects.toThrow(/xiaoyan employee not seeded/);

    // generateText / assembleAgent 都不应被调用（早 return）
    expect(generateText).not.toHaveBeenCalled();
    expect(assembleAgent).not.toHaveBeenCalled();
  });
});
