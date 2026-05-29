export interface WorkflowTestRunToolFailure {
  code: string;
  message: string;
}

export interface WorkflowTestRunToolWarning {
  code: string;
  message: string;
}

export function detectWorkflowTestRunToolFailure(
  result: unknown,
): WorkflowTestRunToolFailure | null {
  if (!result || typeof result !== "object") return null;

  const r = result as { success?: unknown; error?: unknown };
  if (r.success !== false) return null;

  if (r.error && typeof r.error === "object") {
    const error = r.error as { code?: unknown; message?: unknown };
    return {
      code: typeof error.code === "string" ? error.code : "tool_error",
      message:
        typeof error.message === "string"
          ? error.message
          : "工具返回 success=false",
    };
  }

  return {
    code: "tool_error",
    message: "工具返回 success=false",
  };
}

export function detectWorkflowTestRunToolWarning(
  result: unknown,
): WorkflowTestRunToolWarning | null {
  if (!result || typeof result !== "object") return null;
  const r = result as {
    success?: unknown;
    warning?: unknown;
    totalFailed?: unknown;
  };
  if (r.success === false) return null;

  if (r.warning && typeof r.warning === "object") {
    const warning = r.warning as { code?: unknown; message?: unknown };
    return {
      code: typeof warning.code === "string" ? warning.code : "tool_warning",
      message:
        typeof warning.message === "string"
          ? warning.message
          : "工具返回部分成功警告",
    };
  }

  if (typeof r.totalFailed === "number" && r.totalFailed > 0) {
    return {
      code: "partial_failure",
      message: `工具返回 ${r.totalFailed} 条失败记录`,
    };
  }

  return null;
}

export function isCurrentWorkflowTestRunEvent(
  eventRunId: unknown,
  activeRunId: string | null,
): boolean {
  return (
    typeof eventRunId === "string" &&
    activeRunId !== null &&
    eventRunId === activeRunId
  );
}

export type WorkflowTestRunStepStatusLike = {
  status: string;
  message?: string;
};

export function markPriorRunningStepsCompleted<
  T extends WorkflowTestRunStepStatusLike,
>(
  statuses: Record<string, T>,
  orderedStepIds: string[],
  currentStepIndex: number,
): Record<string, T> {
  let changed = false;
  const next: Record<string, T> = { ...statuses };
  for (const stepId of orderedStepIds.slice(0, currentStepIndex)) {
    const status = next[stepId];
    if (status?.status === "running") {
      next[stepId] = {
        ...status,
        status: "completed",
        message: "已完成",
      };
      changed = true;
    }
  }
  return changed ? next : statuses;
}
