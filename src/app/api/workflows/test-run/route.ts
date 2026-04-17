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
                    temperature: 0.7,
                    maxTokens: 4000,
                  }),
                  messages: [
                    {
                      role: "system",
                      content: `你是一位资深媒体内容工作流模拟引擎。你的任务是为工作流的每个步骤生成高度逼真、具体且有信息量的模拟输出，让用户能直观判断该工作流是否满足需求。

规则：
- 生成的内容必须贴合任务场景，包含具体的示例数据（标题、数字、来源等），而非抽象描述
- 模拟过程应展示专业的分析推理链，让用户看到 AI 员工"如何思考"
- 产出结果要结构清晰、可直接使用，优先使用列表/表格等结构化格式`,
                    },
                    {
                      role: "user",
                      content: `请模拟执行以下工作流步骤，并生成详实的执行报告。

🔧 任务名称：${skillName}
📝 任务说明：${stepDescription}
${employeeName ? `👤 执行员工：${employeeName}` : ""}

请严格按以下格式输出（中文，600 字左右）：

【执行摘要】一句话总结本步骤的核心产出（≤50字）

【执行过程】
- 列出 4-6 条关键执行动作，每条说明做了什么、为什么这么做
- 体现专业分析思路和决策依据

【产出结果】
- 给出具体、可用的示例输出（如：标题列表、数据表格、分析结论、内容片段等）
- 使用列表让结果一目了然
- 包含 2-3 个具体示例数据点

【质量评估】
- 可信度：高/中/低
- 建议改进：一句话建议（如无则写"无"）`,
                    },
                  ],
                  maxOutputTokens: 1500,
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

              // Safety cap — 6000 chars for richer step output
              if (resultText.length > 6000) {
                resultText = resultText.slice(0, 5997) + "...";
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
