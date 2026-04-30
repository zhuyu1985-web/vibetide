import { NextRequest } from "next/server";
import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { workflowTemplates, type WorkflowStepDef } from "@/db/schema/workflows";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * SSE endpoint for real-time mission progress.
 *
 * Lifecycle:
 *   1. On connect: emit a one-shot `mission-init` event carrying the
 *      template id/name and step metadata (phase / name / skillName /
 *      assignedEmployeeIdHint). Used by the chat-stream UI to render the
 *      planning overview bubble + per-step skill badges before any task
 *      has actually run. Best-effort: any failure is swallowed and the
 *      front-end falls back to plain task-driven rendering.
 *   2. Then poll `missions` + `mission_tasks` every 2s and emit diffs.
 *   3. Self-close on terminal mission status (completed/failed/cancelled).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // ── 一次性发 mission-init ─────────────────────────────────────────
      // 失败不致命：自由对话路径产生的 mission 可能没有 workflowTemplateId，
      // 老 mission 可能 template 已被删；任何分支问题都让前端按 task-driven 兜底。
      try {
        const m = await db.query.missions.findFirst({
          where: eq(missions.id, missionId),
          columns: { id: true, workflowTemplateId: true, title: true },
        });
        if (m?.workflowTemplateId) {
          const tpl = await db.query.workflowTemplates.findFirst({
            where: eq(workflowTemplates.id, m.workflowTemplateId),
            columns: { id: true, name: true, steps: true },
          });
          if (tpl) {
            const steps = (tpl.steps ?? []) as WorkflowStepDef[];
            const initSteps = steps
              .map((s, idx) => ({
                phase: typeof s.order === "number" ? s.order : idx + 1,
                name: s.name ?? s.label ?? "",
                skillName: s.config?.skillName,
                assignedEmployeeIdHint: s.config?.employeeSlug ?? s.employeeSlug,
              }))
              .sort((a, b) => a.phase - b.phase);
            send("mission-init", {
              templateId: tpl.id,
              templateName: tpl.name,
              steps: initSteps,
            });
          }
        }
      } catch {
        // init 拉失败不致命，前端会 fallback
      }

      // Track previous state for diffing
      let prevTaskMap = new Map<string, string>();
      let prevProgress = -1;
      let prevStatus = "";

      const poll = async () => {
        if (closed) return;

        try {
          // Lightweight queries — only status/progress columns
          const [mission, tasks] = await Promise.all([
            db.select({ status: missions.status, progress: missions.progress })
              .from(missions).where(eq(missions.id, missionId)).limit(1),
            db.select({
              id: missionTasks.id,
              title: missionTasks.title,
              status: missionTasks.status,
              progress: missionTasks.progress,
              assignedEmployeeId: missionTasks.assignedEmployeeId,
              outputSummary: missionTasks.outputSummary,
              errorMessage: missionTasks.errorMessage,
              errorRecoverable: missionTasks.errorRecoverable,
              retryCount: missionTasks.retryCount,
              phase: missionTasks.phase,
            }).from(missionTasks).where(eq(missionTasks.missionId, missionId)),
          ]);

          if (!mission[0]) {
            send("error", { message: "Mission not found" });
            closed = true;
            controller.close();
            return;
          }

          const m = mission[0];

          // Emit task status changes
          for (const t of tasks) {
            const prev = prevTaskMap.get(t.id);
            if (prev !== t.status) {
              send("task-update", {
                taskId: t.id,
                title: t.title,
                status: t.status,
                progress: t.progress,
                assignedEmployeeId: t.assignedEmployeeId,
                outputSummary: t.outputSummary,
                errorMessage: t.errorMessage,
                errorRecoverable: t.errorRecoverable === 1,
                retryCount: t.retryCount,
                phase: t.phase,
              });
            }
          }

          // Emit mission progress change
          if (m.progress !== prevProgress || m.status !== prevStatus) {
            send("mission-progress", {
              status: m.status,
              progress: m.progress,
              completedTasks: tasks.filter((t) => t.status === "completed").length,
              totalTasks: tasks.length,
            });
          }

          // Update tracking state
          prevTaskMap = new Map(tasks.map((t) => [t.id, t.status]));
          prevProgress = m.progress;
          prevStatus = m.status;

          // Close on terminal status
          if (["completed", "failed", "cancelled"].includes(m.status)) {
            send("mission-completed", { status: m.status, progress: m.progress });
            closed = true;
            controller.close();
            return;
          }
        } catch {
          // DB error — skip this tick, retry next
        }

        // Schedule next poll
        if (!closed) {
          setTimeout(poll, 2000);
        }
      };

      // Start polling
      poll();

      // Handle client disconnect
      req.signal.addEventListener("abort", () => {
        closed = true;
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
