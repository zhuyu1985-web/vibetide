import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  missionReturning,
  taskReturning,
  missionValues,
  taskValues,
  insert,
  getOrProvisionLeader,
  loadAvailableEmployees,
  buildAdHocTasks,
} = vi.hoisted(() => {
  const missionReturning = vi.fn();
  const taskReturning = vi.fn();
  const missionValues = vi.fn(() => ({ returning: missionReturning }));
  const taskValues = vi.fn(() => ({ returning: taskReturning }));
  // insert 每次调用后返回 values，通过调用次序区分 mission vs task
  const insertCalls: number[] = [];
  let callIdx = 0;
  const insert = vi.fn(() => {
    const idx = callIdx++;
    // 第 0 次是 mission，后续是 tasks
    return idx === 0 ? { values: missionValues } : { values: taskValues };
  });
  return {
    missionReturning,
    taskReturning,
    missionValues,
    taskValues,
    insert,
    insertCalls,
    getOrProvisionLeader: vi.fn(),
    loadAvailableEmployees: vi.fn(),
    buildAdHocTasks: vi.fn(),
  };
});

vi.mock("@/db", () => ({ db: { insert } }));
vi.mock("@/app/actions/missions", () => ({ getOrProvisionLeader }));
vi.mock("@/lib/mission-core", () => ({ loadAvailableEmployees }));
vi.mock("@/lib/agent/intent-to-tasks", () => ({ buildAdHocTasks }));

import { materializeAdHocMission } from "../materialize-ad-hoc";

beforeEach(() => {
  vi.clearAllMocks();
  // 重置闭包计数器：通过 mockImplementation 重建计数状态
  let n = 0;
  insert.mockImplementation(() =>
    n++ === 0 ? { values: missionValues } : { values: taskValues },
  );
});

describe("materializeAdHocMission", () => {
  it("插入 mission(scenario=custom) + 透传 sourceModule/sourceEntityId", async () => {
    getOrProvisionLeader.mockResolvedValue({ id: "leader1" });
    loadAvailableEmployees.mockResolvedValue([]);
    buildAdHocTasks.mockReturnValue({ tasks: [], teamMemberIds: ["leader1"] });
    missionReturning.mockResolvedValue([{ id: "m1" }]);

    const r = await materializeAdHocMission("org1", {
      message: "抓个热点",
      steps: [
        {
          employeeSlug: "xiaolei",
          employeeName: "小蕾",
          skills: ["x"],
          taskDescription: "抓热点",
        },
      ],
      summary: "热点",
      sourceModule: "channel:dingtalk",
      sourceEntityId: "msg1",
    });

    expect(r.missionId).toBe("m1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (missionValues.mock.calls as any[][])[0][0];
    expect(v).toMatchObject({
      organizationId: "org1",
      scenario: "custom",
      sourceModule: "channel:dingtalk",
      sourceEntityId: "msg1",
      inputParams: {
        query: "抓个热点",
        intentSummary: "热点",
      },
    });
  });

  it("无 sourceModule/sourceEntityId 时字段不出现在 values", async () => {
    getOrProvisionLeader.mockResolvedValue({ id: "leader1" });
    loadAvailableEmployees.mockResolvedValue([]);
    buildAdHocTasks.mockReturnValue({ tasks: [], teamMemberIds: ["leader1"] });
    missionReturning.mockResolvedValue([{ id: "m2" }]);

    await materializeAdHocMission("org1", {
      message: "写稿",
      steps: [
        {
          employeeSlug: "xiaowen",
          employeeName: "小文",
          skills: [],
          taskDescription: "写文章",
        },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (missionValues.mock.calls as any[][])[0][0];
    expect(v).not.toHaveProperty("sourceModule");
    expect(v).not.toHaveProperty("sourceEntityId");
  });
});
