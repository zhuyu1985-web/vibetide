import { describe, expect, it, vi, beforeEach } from "vitest";

const executeAgentMock = vi.hoisted(() => vi.fn());
const assembleAgentMock = vi.hoisted(() => vi.fn());
const getCurrentUserMock = vi.hoisted(() => vi.fn());
const findFirstProfileMock = vi.hoisted(() => vi.fn());
const loadAvailableEmployeesMock = vi.hoisted(() => vi.fn());
const pickEmployeeForStepMock = vi.hoisted(() => vi.fn());
const getOrProvisionLeaderMock = vi.hoisted(() => vi.fn());
const invokeToolDirectlyMock = vi.hoisted(() => vi.fn());
const isToolRegisteredMock = vi.hoisted(() =>
  vi.fn((slug: string) => {
    void slug;
    return false;
  }),
);
const isWriteToolMock = vi.hoisted(() =>
  vi.fn((slug: string) => {
    void slug;
    return false;
  }),
);

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      userProfiles: {
        findFirst: findFirstProfileMock,
      },
    },
  },
}));

vi.mock("@/db/schema", () => ({
  userProfiles: { id: "user_profiles.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left, right) => ({ left, right })),
}));

vi.mock("@/lib/agent", () => ({
  assembleAgent: assembleAgentMock,
  executeAgent: executeAgentMock,
}));

vi.mock("@/lib/agent/tool-registry", () => ({
  invokeToolDirectly: invokeToolDirectlyMock,
  isToolRegistered: isToolRegisteredMock,
  isWriteTool: isWriteToolMock,
}));

vi.mock("@/lib/agent/llm-skill-dispatch", () => ({
  invokeLLMSkillDirectly: vi.fn(),
  isLLMSkillRegistered: vi.fn(() => false),
}));

vi.mock("@/lib/mission-executor", () => ({
  renderStepParameters: vi.fn((params) => params),
}));

vi.mock("@/lib/skill-loader", () => ({
  loadSkillContent: vi.fn(() => "# layout_design"),
}));

vi.mock("@/lib/mission-core", () => ({
  loadAvailableEmployees: loadAvailableEmployeesMock,
  pickEmployeeForStep: pickEmployeeForStepMock,
}));

vi.mock("@/app/actions/missions", () => ({
  getOrProvisionLeader: getOrProvisionLeaderMock,
}));

vi.mock("@/lib/scenario-template", () => ({
  renderScenarioTemplate: vi.fn((template) => template),
}));

import { POST } from "../route";

describe("POST /api/workflows/test-run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    findFirstProfileMock.mockResolvedValue({ organizationId: "org-1" });
    loadAvailableEmployeesMock.mockResolvedValue([
      { id: "employee-1", slug: "xiaowen", name: "小文" },
    ]);
    pickEmployeeForStepMock.mockReturnValue({
      id: "employee-1",
      slug: "xiaowen",
      name: "小文",
    });
    getOrProvisionLeaderMock.mockResolvedValue({
      id: "leader-1",
      slug: "leader",
      name: "任务总监",
    });
    assembleAgentMock.mockResolvedValue({
      slug: "xiaowen",
      tools: [],
    });
    executeAgentMock.mockResolvedValue({
      output: {
        stepKey: "step-1",
        employeeSlug: "xiaowen",
        summary: "排版完成",
        artifacts: [],
        metrics: { qualityScore: 80 },
        status: "success",
      },
    });
    invokeToolDirectlyMock.mockResolvedValue({
      ok: true,
      toolName: "archive_to_drafts",
      params: {},
      result: {
        success: true,
        dryRun: true,
        totalRequested: 0,
        totalCreated: 0,
        totalSkipped: 0,
        totalAvailable: 0,
        created: [],
        inserted: [],
        articles: [],
        skipped: [],
        failed: [],
      },
    });
    isToolRegisteredMock.mockReturnValue(false);
    isWriteToolMock.mockReturnValue(false);
  });

  it("passes skillSlug to executeAgent so layout_design uses its model override", async () => {
    const req = new Request("http://localhost/api/workflows/test-run", {
      method: "POST",
      body: JSON.stringify({
        triggerType: "manual",
        steps: [
          {
            id: "step-1",
            order: 1,
            name: "推送排版设计",
            type: "skill",
            config: {
              skillSlug: "layout_design",
              skillName: "排版设计",
              skillCategory: "content_gen",
              parameters: {},
            },
            dependsOn: [],
          },
        ],
      }),
    });

    const res = await POST(req);
    await res.text();

    expect(executeAgentMock).toHaveBeenCalledTimes(1);
    expect(executeAgentMock.mock.calls[0][1]).toMatchObject({
      skillSpec: "# layout_design",
      skillSlug: "layout_design",
    });
  });

  it("passes only declared dependency outputs to agent steps", async () => {
    executeAgentMock.mockImplementation(async (_agent, input) => ({
      output: {
        stepKey: input.stepKey,
        employeeSlug: "xiaowen",
        summary: `summary ${input.stepKey}`,
        artifacts: [
          {
            id: `${input.stepKey}-artifact`,
            type: "generic",
            title: input.stepKey,
            content: `content ${input.stepKey}`,
          },
        ],
        metrics: { qualityScore: 80 },
        status: "success",
      },
    }));

    const req = new Request("http://localhost/api/workflows/test-run", {
      method: "POST",
      body: JSON.stringify({
        triggerType: "manual",
        steps: [
          {
            id: "step-1",
            order: 1,
            name: "本地信源聚合",
            type: "skill",
            config: { skillSlug: "news_aggregation", skillName: "新闻聚合", parameters: {} },
            dependsOn: [],
          },
          {
            id: "step-2",
            order: 2,
            name: "早晚报撰写",
            type: "skill",
            config: { skillSlug: "content_generate", skillName: "内容生成", parameters: {} },
            dependsOn: ["step-1"],
          },
          {
            id: "step-3",
            order: 3,
            name: "推送排版设计",
            type: "skill",
            config: { skillSlug: "layout_design", skillName: "排版设计", parameters: {} },
            dependsOn: ["step-2"],
          },
        ],
      }),
    });

    const res = await POST(req);
    await res.text();

    expect(executeAgentMock).toHaveBeenCalledTimes(3);
    const layoutInput = executeAgentMock.mock.calls[2][1];
    expect(layoutInput.previousSteps).toHaveLength(1);
    expect(layoutInput.previousSteps[0].stepKey).toBe("step-2");
  });

  it("forces dryRun for write tools during workflow test-run", async () => {
    isToolRegisteredMock.mockImplementation((slug: string) => slug === "archive_to_drafts");
    isWriteToolMock.mockImplementation((slug: string) => slug === "archive_to_drafts");
    invokeToolDirectlyMock.mockResolvedValueOnce({
      ok: true,
      toolName: "archive_to_drafts",
      params: {
        articles: [{ title: "Draft", body: "Body with enough chars" }],
        dryRun: true,
      },
      result: {
        success: true,
        dryRun: true,
        totalRequested: 1,
        totalCreated: 1,
        totalSkipped: 0,
        totalAvailable: 1,
        created: [
          {
            articleId: "00000000-0000-4000-8000-000000000001",
            title: "Draft",
            status: "created",
          },
        ],
        inserted: [
          {
            articleId: "00000000-0000-4000-8000-000000000001",
            title: "Draft",
            status: "created",
          },
        ],
        articles: [
          {
            articleId: "00000000-0000-4000-8000-000000000001",
            title: "Draft",
            status: "created",
          },
        ],
        skipped: [],
        failed: [],
      },
    });

    const req = new Request("http://localhost/api/workflows/test-run", {
      method: "POST",
      body: JSON.stringify({
        triggerType: "manual",
        steps: [
          {
            id: "step-1",
            order: 1,
            name: "入英文稿件库",
            type: "skill",
            config: {
              skillSlug: "archive_to_drafts",
              skillName: "稿件入库",
              parameters: {
                articles: [{ title: "Draft", body: "Body with enough chars" }],
              },
            },
            dependsOn: [],
          },
        ],
      }),
    });

    const res = await POST(req);
    await res.text();

    expect(invokeToolDirectlyMock).toHaveBeenCalledTimes(1);
    expect(invokeToolDirectlyMock.mock.calls[0][1]).toMatchObject({
      dryRun: true,
      articles: [{ title: "Draft", body: "Body with enough chars" }],
    });
  });
});
