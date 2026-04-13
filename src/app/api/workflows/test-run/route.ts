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

            const stepStartedAt = Date.now();

            try {
              // Try to find an employee with this skill
              let resultText: string | null = null;
              let employeeName: string | null = null;

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
                  employeeName = binding[0].employeeName;
                  send("step-progress", {
                    stepId: step.id,
                    message: `${binding[0].employeeName} 正在执行「${skillName}」...`,
                  });
                }
              }

              // Call LLM with richer prompt (30s timeout)
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
                    temperature: 0.6,
                    maxTokens: 1500,
                  }),
                  messages: [
                    {
                      role: "user",
                      content: `你是媒体内容工作流测试助手。请模拟执行下列任务并给出可读的执行过程与结果。
任务：${skillName}
说明：${stepDescription}

请严格按以下格式输出（中文，300 字以内，不要多余客套）：
【执行摘要】一句话总结本步骤做了什么、产出是什么（≤40字）
【执行过程】3-5 条要点，展示推理与关键动作
【产出结果】列出核心数据、示例或关键结论（可包含 JSON/列表/链接示意）`,
                    },
                  ],
                  maxOutputTokens: 600,
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
                resultText = `【执行摘要】「${skillName}」模拟执行完成\n【执行过程】本次为本地模拟运行，未连接真实技能工具。\n【产出结果】无实际数据输出（请在正式运行时查看）。`;
              }

              // Safety cap — 4000 chars should be plenty for a step summary
              if (resultText.length > 4000) {
                resultText = resultText.slice(0, 3997) + "...";
              }

              // Derive a short summary for inline display (first 【执行摘要】line
              // or fallback to first line)
              const summary = extractSummary(resultText, skillName);
              const durationMs = Date.now() - stepStartedAt;

              send("step-complete", {
                stepId: step.id,
                stepIndex: i,
                result: resultText,
                summary,
                durationMs,
                employeeName,
                success: true,
              });
              completedSteps++;
            } catch (stepErr) {
              console.error(
                `[test-run] Step "${skillName}" failed:`,
                stepErr
              );
              const durationMs = Date.now() - stepStartedAt;
              const errorMessage =
                stepErr instanceof Error
                  ? stepErr.message
                  : "步骤执行失败";
              send("step-failed", {
                stepId: step.id,
                stepIndex: i,
                error: errorMessage,
                summary: errorMessage.slice(0, 60),
                durationMs,
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

/**
 * Extract a short one-line summary from the LLM output.
 * Looks for 【执行摘要】 header first, then falls back to first non-empty line.
 */
function extractSummary(fullText: string, skillName: string): string {
  const summaryMatch = fullText.match(/【执行摘要】\s*([^\n【]+)/);
  if (summaryMatch?.[1]) {
    const s = summaryMatch[1].trim();
    return s.length > 60 ? s.slice(0, 57) + "..." : s;
  }
  const firstLine = fullText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine) {
    return firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine;
  }
  return `「${skillName}」执行完成`;
}
