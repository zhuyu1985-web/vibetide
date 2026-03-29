import { NextRequest } from "next/server";
import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * SSE endpoint for real-time mission progress.
 * Polls lightweight status fields every 2s and emits diffs.
 * Self-closes on terminal mission status.
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
