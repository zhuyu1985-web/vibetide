import { describe, expect, it } from "vitest";

import {
  detectWorkflowTestRunToolFailure,
  detectWorkflowTestRunToolWarning,
  isCurrentWorkflowTestRunEvent,
  markPriorRunningStepsCompleted,
} from "../workflow-test-run-status";

describe("detectWorkflowTestRunToolFailure", () => {
  it("treats successful transport with success=false result as step failure", () => {
    const failure = detectWorkflowTestRunToolFailure({
      success: false,
      totalRequested: 5,
      totalPublished: 0,
      totalFailed: 5,
      error: {
        code: "partial_or_total_failure",
        message: "5/5 条发布失败,详见 failed 数组",
      },
    });

    expect(failure).toEqual({
      code: "partial_or_total_failure",
      message: "5/5 条发布失败,详见 failed 数组",
    });
  });

  it("does not mark successful tool output as failure", () => {
    expect(
      detectWorkflowTestRunToolFailure({
        success: true,
        totalRequested: 5,
        totalPublished: 5,
      }),
    ).toBeNull();
  });
});

describe("isCurrentWorkflowTestRunEvent", () => {
  it("rejects stale SSE events from older test runs", () => {
    expect(isCurrentWorkflowTestRunEvent("old-run", "new-run")).toBe(false);
  });

  it("accepts events for the active test run", () => {
    expect(isCurrentWorkflowTestRunEvent("run-1", "run-1")).toBe(true);
  });
});

describe("detectWorkflowTestRunToolWarning", () => {
  it("warns when archive created valid rows but skipped invalid rows", () => {
    expect(
      detectWorkflowTestRunToolWarning({
        success: true,
        totalCreated: 4,
        totalFailed: 1,
        warning: {
          code: "partial_invalid_archive_input",
          message: "1/5 条稿件未通过入库校验,已跳过坏稿并入库其余有效稿件",
        },
      }),
    ).toEqual({
      code: "partial_invalid_archive_input",
      message: "1/5 条稿件未通过入库校验,已跳过坏稿并入库其余有效稿件",
    });
  });
});

describe("markPriorRunningStepsCompleted", () => {
  it("marks prior running steps completed when a later step starts", () => {
    expect(
      markPriorRunningStepsCompleted(
        {
          "step-4": { status: "running", message: "执行中" },
          "step-5": { status: "running", message: "执行中" },
        },
        ["step-1", "step-2", "step-3", "step-4", "step-5"],
        4,
      ),
    ).toMatchObject({
      "step-4": { status: "completed", message: "已完成" },
      "step-5": { status: "running", message: "执行中" },
    });
  });
});
