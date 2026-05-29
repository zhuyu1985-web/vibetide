import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getNestedField,
  isArchiveDedupOnlyResult,
  parseCallParamsFromTaskDescription,
  renderStepParameters,
  buildImplicitTrendingTopicsParams,
  formatRegisteredSkillFallbackFailure,
  shouldBlockRegisteredSkillFallback,
  shouldForceInjectWorkflowTool,
  shouldUseStrictToolEnforcement,
} from "../mission-executor";

describe("renderStepParameters", () => {
  it("从 mission.inputParams 取 primitive string", () => {
    const rendered = renderStepParameters(
      { mode: "hot", limit: "{{topic_limit}}" },
      { inputParams: { topic_limit: 30 } } as never,
      [],
    );
    expect(rendered).toEqual({ mode: "hot", limit: "30" });
  });

  it("从 previousSteps 引用 step1.topics array (JSON-parsed)", () => {
    const rendered = renderStepParameters(
      { topics: "{{step1.topics}}" },
      { inputParams: {} } as never,
      [
        { outputData: { topics: [{ id: "t1", title: "A" }] } } as never,
      ],
    );
    expect(rendered.topics).toEqual([{ id: "t1", title: "A" }]);
  });

  it("从 mission.inputParams 取 array (JSON.stringify 后再 parse)", () => {
    const rendered = renderStepParameters(
      { categories: "{{categories}}" },
      { inputParams: { categories: [{ value: "food", label: "美食" }] } } as never,
      [],
    );
    expect(rendered.categories).toEqual([{ value: "food", label: "美食" }]);
  });

  it("primitive string 不被 JSON.parse fallthrough", () => {
    const rendered = renderStepParameters(
      { mode: "hot" },
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.mode).toBe("hot");
  });

  it("{{key}} 解析失败 → 保留空字符串", () => {
    const rendered = renderStepParameters(
      { foo: "{{missing_key}}" },
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.foo).toBe("");
  });

  it("{{stepN.field}} N 越界 → 保留空字符串", () => {
    const rendered = renderStepParameters(
      { foo: "{{step9.topics}}" },
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.foo).toBe("");
  });
});

describe("parseCallParamsFromTaskDescription", () => {
  it("从任务描述的调用参数块恢复 JSON 字符串和布尔值", () => {
    expect(
      parseCallParamsFromTaskDescription(`入英文稿件库（待审）（使用技能：稿件入库）

【调用参数（必须严格使用这些值调用工具，禁止自行修改）】
- articles: "{{step4.articles}}"
- category: "app_overseas_en"
- language: "en"
- initialStatus: "approved"
- dedupBySourceUrl: true`),
    ).toEqual({
      articles: "{{step4.articles}}",
      category: "app_overseas_en",
      language: "en",
      initialStatus: "approved",
      dedupBySourceUrl: true,
    });
  });

  it("没有调用参数块时返回空对象", () => {
    expect(parseCallParamsFromTaskDescription("普通任务描述")).toEqual({});
  });
});

describe("renderStepParameters with real-world StepOutput shape", () => {
  it("从 StepOutput 含 topics 字段能取到 (verify A.1.2.5 fix)", () => {
    // Mock production-like previousSteps shape: StepOutput with extra fields
    const previousSteps = [
      {
        outputData: {
          stepKey: "task-1",
          employeeSlug: "xiaolei",
          summary: "拉到 30 条",
          artifacts: [],
          metrics: {},
          status: "success",
          topics: [{ id: "t1", title: "X" }], // 额外字段，A.1.2.5 修后应保留
        },
      },
    ];
    const rendered = renderStepParameters(
      { topics: "{{step1.topics}}" },
      { inputParams: {} } as never,
      previousSteps,
    );
    expect(rendered.topics).toEqual([{ id: "t1", title: "X" }]);
  });

  it("CMS 发布链路按 step.order 解析 step4.articles 和 step6.firstArticleId", () => {
    const previousSteps: Array<{ outputData?: unknown }> = [];
    previousSteps[3] = {
      outputData: {
        articles: [
          {
            title: "成都早报",
            body: "正文内容足够长，用于入库测试",
            summary: "摘要",
            language: "zh",
          },
        ],
      },
    };
    previousSteps[5] = {
      outputData: {
        firstArticleId: "11111111-1111-4111-8111-111111111111",
      },
    };

    expect(
      renderStepParameters(
        { articles: "{{step4.articles}}", initialStatus: "approved" },
        { inputParams: {} } as never,
        previousSteps,
      ),
    ).toEqual({
      articles: [
        {
          title: "成都早报",
          body: "正文内容足够长，用于入库测试",
          summary: "摘要",
          language: "zh",
        },
      ],
      initialStatus: "approved",
    });

    expect(
      renderStepParameters(
        { articleId: "{{step6.firstArticleId}}", catalogId: "10462" },
        { inputParams: {} } as never,
        previousSteps,
      ),
    ).toEqual({
      articleId: "11111111-1111-4111-8111-111111111111",
      catalogId: "10462",
    });
  });
});

describe("renderStepParameters — nested path (dotted)", () => {
  // 抑制 console.warn 噪音（路径解不通的 case 会触发）
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("数组下标：{{step1.created.0.articleId}}", () => {
    const rendered = renderStepParameters(
      { articleId: "{{step1.created.0.articleId}}" },
      { inputParams: null },
      [{ outputData: { created: [{ articleId: "art-1" }, { articleId: "art-2" }] } }],
    );
    expect(rendered.articleId).toBe("art-1");
  });

  it("数组下标 + 第二项：{{step1.created.1.articleId}}", () => {
    const rendered = renderStepParameters(
      { articleId: "{{step1.created.1.articleId}}" },
      { inputParams: null },
      [{ outputData: { created: [{ articleId: "art-1" }, { articleId: "art-2" }] } }],
    );
    expect(rendered.articleId).toBe("art-2");
  });

  it("纯嵌套对象：{{step1.meta.user.name}}", () => {
    const rendered = renderStepParameters(
      { name: "{{step1.meta.user.name}}" },
      { inputParams: null },
      [{ outputData: { meta: { user: { name: "Alice" } } } }],
    );
    expect(rendered.name).toBe("Alice");
  });

  it("混合：{{step1.results.0.tags.2}}", () => {
    const rendered = renderStepParameters(
      { tag: "{{step1.results.0.tags.2}}" },
      { inputParams: null },
      [{ outputData: { results: [{ tags: ["a", "b", "c", "d"] }] } }],
    );
    expect(rendered.tag).toBe("c");
  });

  it("路径解不通 → 空字符串 fallback（不抛）", () => {
    const rendered = renderStepParameters(
      { x: "{{step1.foo.bar.baz}}" },
      { inputParams: null },
      [{ outputData: { other: "x" } }],
    );
    expect(rendered.x).toBe("");
  });

  it("数组越界 → 空字符串 fallback", () => {
    const rendered = renderStepParameters(
      { x: "{{step1.created.99.articleId}}" },
      { inputParams: null },
      [{ outputData: { created: [{ articleId: "art-1" }] } }],
    );
    expect(rendered.x).toBe("");
  });

  it("顶层 key 仍兼容（不带点）", () => {
    const rendered = renderStepParameters(
      { x: "{{step1.results}}" },
      { inputParams: null },
      [{ outputData: { results: ["a", "b"] } }],
    );
    expect(rendered.x).toEqual(["a", "b"]);
  });

  it("数组中含数字字段名时按数字优先解析为 index", () => {
    const rendered = renderStepParameters(
      { x: "{{step1.arr.0}}" },
      { inputParams: null },
      [{ outputData: { arr: ["alpha", "beta"] } }],
    );
    expect(rendered.x).toBe("alpha");
  });
});

describe("getNestedField — 独立单测", () => {
  it("undefined 输入 → undefined", () => {
    expect(getNestedField(undefined, "a.b")).toBeUndefined();
  });

  it("解到 primitive 后继续访问 → undefined", () => {
    expect(getNestedField({ a: 1 }, "a.b")).toBeUndefined();
  });
});

describe("isArchiveDedupOnlyResult", () => {
  it("全量 sourceUrl 去重命中且已有 articleId 可用时，不应按写入 0 条失败处理", () => {
    expect(
      isArchiveDedupOnlyResult({
        success: true,
        totalRequested: 2,
        totalCreated: 0,
        totalSkipped: 2,
        created: [
          { articleId: "existing-1", status: "existing" },
          { articleId: "existing-2", status: "existing" },
        ],
        skipped: [
          {
            sourceUrl: "https://example.com/1",
            existingArticleId: "existing-1",
            reason: "duplicate_source_url",
          },
          {
            sourceUrl: "https://example.com/2",
            existingArticleId: "existing-2",
            reason: "duplicate_source_url",
          },
        ],
      }),
    ).toBe(true);
  });

  it("写入 0 条但不是纯去重命中时，仍然保留失败防线", () => {
    expect(
      isArchiveDedupOnlyResult({
        success: true,
        totalRequested: 2,
        totalCreated: 0,
        totalSkipped: 2,
        created: [],
        skipped: [
          { sourceUrl: "https://example.com/1", reason: "invalid_language" },
          { sourceUrl: "https://example.com/2", reason: "invalid_language" },
        ],
      }),
    ).toBe(false);
  });

  it("多个输入命中同一篇已有稿时，只要有可用 articleId 就不是失败", () => {
    expect(
      isArchiveDedupOnlyResult({
        success: true,
        totalRequested: 2,
        totalCreated: 0,
        totalSkipped: 2,
        created: [{ articleId: "existing-1", status: "existing" }],
        skipped: [
          {
            sourceUrl: "https://example.com/dup",
            existingArticleId: "existing-1",
            reason: "duplicate_source_url",
          },
          {
            sourceUrl: "https://example.com/dup",
            existingArticleId: "existing-1",
            reason: "duplicate_source_url",
          },
        ],
      }),
    ).toBe(true);
  });
});

describe("shouldBlockRegisteredSkillFallback", () => {
  it("content_generate 无显式参数时允许走 agent 写稿路径", () => {
    expect(
      shouldBlockRegisteredSkillFallback({
        assignedRole: "content_generate",
        preExecAttempted: false,
        preExecUsedTool: false,
      }),
    ).toBe(false);
  });

  it("content_generate 显式短路尝试失败时仍阻止 fallback", () => {
    expect(
      shouldBlockRegisteredSkillFallback({
        assignedRole: "content_generate",
        preExecAttempted: true,
        preExecUsedTool: false,
      }),
    ).toBe(true);
  });

  it("写入工具缺少可用短路结果时阻止 fallback", () => {
    expect(
      shouldBlockRegisteredSkillFallback({
        assignedRole: "archive_to_drafts",
        preExecAttempted: false,
        preExecUsedTool: false,
      }),
    ).toBe(true);
  });

  it("短路失败文案透出真实 pre-exec 错误", () => {
    expect(
      formatRegisteredSkillFallbackFailure(
        "trending_topics",
        "TopHub /search returned 401",
      ),
    ).toContain("真实错误：TopHub /search returned 401");
  });
});

describe("workflow skill tool enforcement guards", () => {
  it("content_generate 不强制注入/调用同名 helper tool", () => {
    expect(shouldForceInjectWorkflowTool("content_generate")).toBe(false);
    expect(shouldUseStrictToolEnforcement("content_generate", false)).toBe(false);
  });

  it("开放式非工具 skill 不强制走占位工具", () => {
    expect(shouldForceInjectWorkflowTool("layout_design")).toBe(false);
    expect(shouldUseStrictToolEnforcement("layout_design", false)).toBe(false);
  });

  it("写入工具仍强制工具路径", () => {
    expect(shouldForceInjectWorkflowTool("archive_to_drafts")).toBe(true);
    expect(shouldUseStrictToolEnforcement("archive_to_drafts", false)).toBe(true);
  });
});

describe("buildImplicitTrendingTopicsParams", () => {
  it("本地场景缺少显式参数时用 city 构造 search 调用", () => {
    expect(
      buildImplicitTrendingTopicsParams("AI 早晚报(成都)", {
        city: "成都",
        edition: "morning",
      }),
    ).toEqual({ mode: "search", query: "成都", limit: 20 });
  });

  it("没有本地关键词时回退到全网 hot", () => {
    expect(buildImplicitTrendingTopicsParams("每日热点", {})).toEqual({
      mode: "hot",
      limit: 20,
    });
  });
});
