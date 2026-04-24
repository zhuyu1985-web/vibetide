import { useState, useCallback } from "react";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";
import type { StepStatus } from "./workflow-canvas";

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
      if (testRunning) return;
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
          }),
        });

        if (!res.ok || !res.body) {
          console.error("[test-run] Request failed:", res.status);
          setTestRunning(false);
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

                switch (eventType) {
                  case "trigger-start":
                    setTriggerStatus("running");
                    break;
                  case "trigger-complete":
                    setTriggerStatus("completed");
                    break;
                  case "step-start":
                    setStepStatuses((prev) => ({
                      ...prev,
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
                        status: "completed",
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
                    break;
                  case "error":
                    console.error("[test-run] Server error:", data.message);
                    setTestRunning(false);
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
        setTestRunning(false);
      } catch (err) {
        console.error("[test-run] Fetch error:", err);
        setTestRunning(false);
      }
    },
    [testRunning]
  );

  const resetTestRun = useCallback(() => {
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
