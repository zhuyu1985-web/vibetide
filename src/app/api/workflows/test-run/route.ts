import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles, employeeSkills, skills, aiEmployees } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateText } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import type { WorkflowStepDef } from "@/db/schema/workflows";

// ---------------------------------------------------------------------------
// POST /api/workflows/test-run — SSE stream for test-running a workflow
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { steps, triggerType } = body as {
      steps: WorkflowStepDef[];
      triggerType: "manual" | "scheduled";
      triggerConfig?: { cron?: string; timezone?: string } | null;
    };

    if (!steps || !Array.isArray(steps)) {
      return new Response("缺少步骤数据", { status: 400 });
    }

    // Look up org
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });
    if (!profile?.organizationId) {
      return new Response("未找到组织信息", { status: 403 });
    }

    const orgId = profile.organizationId;

    // SSE stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
              )
            );
          } catch {
            // Controller already closed (client disconnected)
          }
        };

        let completedSteps = 0;
        let failedSteps = 0;

        try {
          // ── Trigger simulation ──
          send("trigger-start", {});
          await delay(1000);
          send("trigger-complete", {
            message:
              triggerType === "scheduled"
                ? "定时触发器已模拟完成"
                : "手动触发器已完成",
          });

          // ── Execute steps in order ──
          const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

          for (let i = 0; i < sortedSteps.length; i++) {
            const step = sortedSteps[i];
            const skillSlug = step.config.skillSlug;
            const skillName = step.config.skillName || step.name;

            send("step-start", {
              stepId: step.id,
              stepIndex: i,
              skillName,
            });

            try {
              // Try to find an employee with this skill
              let resultText: string | null = null;

              if (skillSlug && skillSlug !== "ai_custom") {
                const binding = await db
                  .select({
                    employeeId: employeeSkills.employeeId,
                    employeeName: aiEmployees.name,
                  })
                  .from(employeeSkills)
                  .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
                  .innerJoin(
                    aiEmployees,
                    eq(employeeSkills.employeeId, aiEmployees.id)
                  )
                  .where(
                    and(
                      eq(skills.slug, skillSlug),
                      eq(aiEmployees.organizationId, orgId)
                    )
                  )
                  .limit(1);

                if (binding.length > 0) {
                  send("step-progress", {
                    stepId: step.id,
                    message: `${binding[0].employeeName} 正在执行「${skillName}」...`,
                  });
                }
              }

              // Call LLM with simplified prompt (30s timeout)
              const stepDescription =
                step.config.description || `执行「${skillName}」任务`;

              try {
                const abortController = new AbortController();
                const timeout = setTimeout(
                  () => abortController.abort(),
                  30_000
                );

                const result = await generateText({
                  model: getLanguageModel({
                    provider: "openai",
                    model: process.env.OPENAI_MODEL || "deepseek-chat",
                    temperature: 0.5,
                    maxTokens: 1000,
                  }),
                  messages: [
                    {
                      role: "user",
                      content: `你是一个媒体内容AI助手。请模拟执行以下任务并返回简短的执行结果摘要（50字以内）：\n任务：${skillName}\n${stepDescription}`,
                    },
                  ],
                  maxOutputTokens: 200,
                  abortSignal: abortController.signal,
                });

                clearTimeout(timeout);
                resultText = result.text?.trim() || null;
              } catch (llmErr) {
                // LLM call failed — use graceful fallback
                console.warn(
                  `[test-run] LLM call failed for step "${skillName}":`,
                  llmErr instanceof Error ? llmErr.message : llmErr
                );
                resultText = null;
              }

              // Fallback if LLM didn't return a result
              if (!resultText) {
                resultText = `「${skillName}」模拟执行完成`;
              }

              // Truncate to 200 chars
              if (resultText.length > 200) {
                resultText = resultText.slice(0, 197) + "...";
              }

              send("step-complete", {
                stepId: step.id,
                stepIndex: i,
                result: resultText,
                success: true,
              });
              completedSteps++;
            } catch (stepErr) {
              console.error(
                `[test-run] Step "${skillName}" failed:`,
                stepErr
              );
              send("step-failed", {
                stepId: step.id,
                stepIndex: i,
                error:
                  stepErr instanceof Error
                    ? stepErr.message
                    : "步骤执行失败",
              });
              failedSteps++;
              // Continue to next step — don't stop the whole run
            }
          }

          // ── Done ──
          send("done", {
            totalSteps: sortedSteps.length,
            completedSteps,
            failedSteps,
          });
        } catch (err) {
          console.error("[test-run] Unhandled stream error:", err);
          send("error", {
            message:
              err instanceof Error ? err.message : "测试运行失败",
          });
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[test-run] Unhandled route error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
