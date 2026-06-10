/**
 * buildAdHocTasks 单测 —— 把意图识别的 steps 物化成 ad-hoc mission 的 task 定义。
 *
 * 覆盖:
 *   1. employeeSlug → id 解析,查不到回退 leader
 *   2. assignedRole 取第一个非空 skill,无 skill 为 null
 *   3. dependsOn 只保留合法的后向依赖(0<=dep<index),前向/越界丢弃(防环)
 *   4. teamMemberIds 去重
 *   5. priority 递减 + title 截断(description 保留全文)
 */
import { describe, expect, it } from "vitest";
import { buildAdHocTasks } from "../intent-to-tasks";
import type { IntentStep } from "../types";

const employees = [
  { id: "e-lei", slug: "xiaolei" },
  { id: "e-wen", slug: "xiaowen" },
];
const LEADER = "leader-id";

function step(partial: Partial<IntentStep>): IntentStep {
  return {
    employeeSlug: "xiaolei",
    employeeName: "小雷",
    skills: [],
    taskDescription: "做点事",
    ...partial,
  } as IntentStep;
}

describe("buildAdHocTasks", () => {
  it("按 employeeSlug 解析 assignedEmployeeId,查不到回退 leader", () => {
    const { tasks } = buildAdHocTasks(
      [step({ employeeSlug: "xiaowen" }), step({ employeeSlug: "unknown_slug" as IntentStep["employeeSlug"] })],
      employees,
      LEADER,
    );
    expect(tasks[0].assignedEmployeeId).toBe("e-wen");
    expect(tasks[1].assignedEmployeeId).toBe(LEADER);
  });

  it("assignedRole 取第一个非空 skill;无 skill 为 null", () => {
    const { tasks } = buildAdHocTasks(
      [step({ skills: ["", "  ", "trending_topics"] }), step({ skills: [] })],
      employees,
      LEADER,
    );
    expect(tasks[0].assignedRole).toBe("trending_topics");
    expect(tasks[1].assignedRole).toBeNull();
  });

  it("dependsOn 只保留合法的后向依赖,前向/越界丢弃", () => {
    const { tasks } = buildAdHocTasks(
      [
        step({}), // index 0
        step({ dependsOn: 0 }), // index 1 → 依赖 0 合法
        step({ dependsOn: 5 }), // index 2 → 越界丢弃
        step({ dependsOn: 3 }), // index 3 → dep==index 非后向,丢弃
      ],
      employees,
      LEADER,
    );
    expect(tasks[0].dependsOnIndices).toEqual([]);
    expect(tasks[1].dependsOnIndices).toEqual([0]);
    expect(tasks[2].dependsOnIndices).toEqual([]);
    expect(tasks[3].dependsOnIndices).toEqual([]);
  });

  it("teamMemberIds 去重", () => {
    const { teamMemberIds } = buildAdHocTasks(
      [
        step({ employeeSlug: "xiaolei" }),
        step({ employeeSlug: "xiaolei" }),
        step({ employeeSlug: "xiaowen" }),
      ],
      employees,
      LEADER,
    );
    expect([...teamMemberIds].sort()).toEqual(["e-lei", "e-wen"]);
  });

  it("priority 递减(靠前步骤更高);title 截断但 description 保留全文", () => {
    const long = "一".repeat(60);
    const { tasks } = buildAdHocTasks(
      [step({ taskDescription: long }), step({})],
      employees,
      LEADER,
    );
    expect(tasks[0].priority).toBeGreaterThan(tasks[1].priority);
    expect(tasks[0].title.length).toBeLessThanOrEqual(40);
    expect(tasks[0].description).toBe(long);
  });

  it("空 steps → 空结果", () => {
    const { tasks, teamMemberIds } = buildAdHocTasks([], employees, LEADER);
    expect(tasks).toEqual([]);
    expect(teamMemberIds).toEqual([]);
  });
});
