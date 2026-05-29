import { useState, useCallback, useRef } from "react";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";
import type { StepStatus } from "./workflow-canvas";
import {
  isCurrentWorkflowTestRunEvent,
  markPriorRunningStepsCompleted,
} from "@/lib/workflow-test-run-status";

export interface TestRunExtras {
  userInputs?: Record<string, unknown>;
  promptTemplate?: string;
  inputFields?: InputFieldDef[];
}

// ---------------------------------------------------------------------------
// Hook: SSE-based test-run execution for workflow editor
// ---------------------------------------------------------------------------

export function useTestRun() {
  const [testRunning, setTestRunning] = useState(false);
  const activeRunIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [triggerStatus, setTriggerStatus] = useState<
    "idle" | "running" | "completed"
  >("idle");
  const [stepStatuses, setStepStatuses] = useState<
    Record<string, StepStatus>
  >({});

  const startTestRun = useCallback(
    async (
      steps: WorkflowStepDef[],
      triggerType: "manual" | "scheduled",
      triggerConfig: { cron?: string; timezone?: string } | null,
      extras?: TestRunExtras
    ) => {
      if (activeRunIdRef.current) return;
      const runId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `test-run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const orderedStepIds = [...steps]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((step) => step.id);
      activeRunIdRef.current = runId;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setTestRunning(true);
      setTriggerStatus("idle");
      setStepStatuses({});

      try {
        const res = await fetch("/api/workflows/test-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            steps,
            triggerType,
            triggerConfig,
            userInputs: extras?.userInputs,
            promptTemplate: extras?.promptTemplate,
            inputFields: extras?.inputFields,
            clientRunId: runId,
          }),
          signal: controller.signal,
        });

        if (!isCurrentWorkflowTestRunEvent(runId, activeRunIdRef.current)) {
          return;
        }

        if (!res.ok || !res.body) {
          console.error("[test-run] Request failed:", res.status);
          setTestRunning(false);
          activeRunIdRef.current = null;
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                if (
                  !isCurrentWorkflowTestRunEvent(
                    data.runId,
                    activeRunIdRef.current,
                  )
                ) {
                  eventType = "";
                  continue;
                }

                switch (eventType) {
                  case "trigger-start":
                    setTriggerStatus("running");
                    break;
                  case "trigger-complete":
                    setTriggerStatus("completed");
                    break;
                  case "step-start":
                    setStepStatuses((prev) => ({
                      ...markPriorRunningStepsCompleted(
                        prev,
                        orderedStepIds,
                        typeof data.stepIndex === "number"
                          ? data.stepIndex
                          : orderedStepIds.indexOf(data.stepId as string),
                      ),
                      [data.stepId as string]: {
                        status: "running",
                        message: "执行中…",
                      },
                    }));
                    break;
                  case "step-progress":
                    setStepStatuses((prev) => ({
                      ...prev,
                      [data.stepId as string]: {
                        ...(prev[data.stepId as string] ?? {
                          status: "running",
                        }),
                        status: "running",
                        message: data.message as string,
                      },
                    }));
                    break;
                  case "step-complete":
                    setStepStatuses((prev) => ({
                      ...prev,
                      [data.stepId as string]: {
                        // server 端识别"调用成功但产出 0 条"会带 warning=true,
                        // UI 此时显示黄色警告状态而非纯绿色,让用户能立刻看到
                        // "数据链路在这里断了"(常见于 topic_classifier 全归 other
                        // → cross_language_rewrite filter 后 0 条 → archive_to_drafts
                        // 入库 0 篇)。
                        status: data.warning ? "warning" : "completed",
                        message:
                          (data.summary as string | undefined) ??
                          (data.result as string),
                        fullResult: data.result as string,
                        durationMs: data.durationMs as number | undefined,
                        employeeName: data.employeeName as
                          | string
                          | undefined,
                      },
                    }));
                    break;
                  case "step-failed":
                    setStepStatuses((prev) => ({
                      ...prev,
                      [data.stepId as string]: {
                        status: "failed",
                        message:
                          (data.summary as string | undefined) ??
                          (data.error as string),
                        fullResult: data.error as string,
                        durationMs: data.durationMs as number | undefined,
                      },
                    }));
                    break;
                  case "done":
                    setTestRunning(false);
                    activeRunIdRef.current = null;
                    abortRef.current = null;
                    break;
                  case "error":
                    console.error("[test-run] Server error:", data.message);
                    setTestRunning(false);
                    activeRunIdRef.current = null;
                    abortRef.current = null;
                    break;
                }
              } catch {
                // Ignore parse errors for incomplete data
              }
              eventType = "";
            }
          }
        }

        // Stream ended — ensure testRunning is reset
        if (isCurrentWorkflowTestRunEvent(runId, activeRunIdRef.current)) {
          setTestRunning(false);
          activeRunIdRef.current = null;
          abortRef.current = null;
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        console.error("[test-run] Fetch error:", err);
        if (isCurrentWorkflowTestRunEvent(runId, activeRunIdRef.current)) {
          setTestRunning(false);
          activeRunIdRef.current = null;
          abortRef.current = null;
        }
      }
    },
    []
  );

  const resetTestRun = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    activeRunIdRef.current = null;
    setTestRunning(false);
    setTriggerStatus("idle");
    setStepStatuses({});
  }, []);

  return {
    testRunning,
    triggerStatus,
    stepStatuses,
    startTestRun,
    resetTestRun,
  };
}
