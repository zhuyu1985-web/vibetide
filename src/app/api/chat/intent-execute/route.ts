import { verify } from "@/lib/cognitive/verify-learner";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { aiEmployees, userProfiles, intentLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { toVercelTools } from "@/lib/agent/tool-registry";
import { assembleAgent } from "@/lib/agent/assembly";
import { BUILTIN_SKILLS } from "@/lib/constants";
import type { IntentResult } from "@/lib/agent/intent-recognition";

/** Friendly Chinese labels for tool names */
const TOOL_LABELS: Record<string, string> = {
  web_search: "正在搜索互联网资料",
  web_deep_read: "正在深度阅读网页",
  trending_topics: "正在获取全网热榜",
  content_generate: "正在生成内容",
  fact_check: "正在进行事实核查",
  media_search: "正在检索媒资库",
  data_report: "正在生成数据报告",
  trend_monitor: "正在监控趋势",
  social_listening: "正在监测社交舆情",
  sentiment_analysis: "正在分析情感倾向",
  heat_scoring: "正在评估热度",
};

const TOOL_TO_SKILL: Record<string, string> = Object.fromEntries(
  BUILTIN_SKILLS.map((s) => [s.slug, s.name])
);

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function extractSources(toolResult: unknown): string[] {
  if (!toolResult || typeof toolResult !== "object") return [];
  const obj = toolResult as Record<string, unknown>;
  if (Array.isArray(obj.results)) {
    const domains = new Set<string>();
    for (const r of obj.results) {
      if (r && typeof r === "object") {
        const item = r as Record<string, unknown>;
        if (typeof item.url === "string") domains.add(extractDomain(item.url));
        else if (typeof item.source === "string") domains.add(item.source);
      }
    }
    return Array.from(domains);
  }
  if (typeof obj.url === "string") return [extractDomain(obj.url)];
  return [];
}

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
    const { message, intent, conversationHistory, userEdited } = body as {
      message: string;
      intent: IntentResult;
      conversationHistory?: { role: "user" | "assistant"; content: string }[];
      userEdited?: boolean;
    };

    if (!message || !intent?.steps?.length) {
      return new Response("缺少必要参数", { status: 400 });
    }

    // Look up org
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });
    const orgId = profile?.organizationId;
    if (!orgId) {
      return new Response("Organization not found", { status: 403 });
    }

    // Resolve employee DB IDs for all steps
    const slugs = [...new Set(intent.steps.map((s) => s.employeeSlug))];
    const employeeRows = await Promise.all(
      slugs.map((slug) =>
        db.query.aiEmployees.findFirst({
          where: and(
            eq(aiEmployees.slug, slug),
            eq(aiEmployees.organizationId, orgId)
          ),
        })
      )
    );
    const employeeMap = new Map(
      employeeRows
        .filter(Boolean)
        .map((e) => [e!.slug, e!])
    );

    // Validate all employees exist
    for (const step of intent.steps) {
      if (!employeeMap.has(step.employeeSlug)) {
        return new Response(
          `员工 ${step.employeeSlug} 不存在`,
          { status: 404 }
        );
      }
    }

    // Log intent (fire and forget)
    db.insert(intentLogs)
      .values({
        organizationId: orgId,
        userId: user.id,
        employeeSlug: intent.steps[0].employeeSlug,
        userMessage: message,
        intentType: intent.intentType,
        intentResult: intent,
        userEdited: userEdited ?? false,
        editedIntent: userEdited ? intent : null,
      })
      .catch((err) =>
        console.error("[intent-execute] Failed to log intent:", err)
      );

    // Build SSE stream
    const encoder = new TextEncoder();
    const allSources: string[] = [];
    let referenceCount = 0;
    const usedSkills: { tool: string; skillName: string }[] = [];
    const usedToolSet = new Set<string>();

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
            // Controller already closed
          }
        };

        let priorStepOutput = "";

        try {
          for (let i = 0; i < intent.steps.length; i++) {
            const step = intent.steps[i];
            const emp = employeeMap.get(step.employeeSlug)!;

            // Notify client of step switch
            send("step-start", {
              stepIndex: i,
              totalSteps: intent.steps.length,
              employeeSlug: step.employeeSlug,
              employeeName: step.employeeName,
              taskDescription: step.taskDescription,
            });

            // Assemble agent with skill overrides
            const agent = await assembleAgent(emp.id, undefined, {
              skillOverrides: step.skills,
            });

            const model = getLanguageModel(agent.modelConfig);
            const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);

            // Build messages: include prior step output as context
            const messages: { role: "user" | "assistant"; content: string }[] =
              [];
            if (conversationHistory?.length) {
              messages.push(...conversationHistory.slice(-5));
            }
            if (priorStepOutput) {
              messages.push({
                role: "assistant",
                content: `[上一步执行结果]\n${priorStepOutput}`,
              });
            }
            messages.push({
              role: "user",
              content: step.taskDescription,
            });

            // Stream this step
            const result = streamText({
              model,
              system: agent.systemPrompt,
              messages,
              tools: vercelTools,
              stopWhen: stepCountIs(10),
              maxOutputTokens: 8192,
              temperature: 0.5,
            });

            let stepText = "";

            for await (const part of result.fullStream) {
              switch (part.type) {
                case "tool-call": {
                  const label =
                    TOOL_LABELS[part.toolName] ??
                    `正在执行${part.toolName}`;
                  const skillName =
                    TOOL_TO_SKILL[part.toolName] ?? part.toolName;
                  if (!usedToolSet.has(part.toolName)) {
                    usedToolSet.add(part.toolName);
                    usedSkills.push({ tool: part.toolName, skillName });
                  }
                  send("thinking", {
                    tool: part.toolName,
                    label,
                    skillName,
                  });
                  break;
                }
                case "tool-result": {
                  const sources = extractSources(part.output);
                  if (sources.length > 0) {
                    for (const s of sources) {
                      if (!allSources.includes(s)) allSources.push(s);
                    }
                    referenceCount += sources.length;
                    send("source", {
                      tool: part.toolName,
                      sources,
                      totalSources: allSources.length,
                      totalReferences: referenceCount,
                    });
                  }
                  break;
                }
                case "text-delta": {
                  stepText += part.text;
                  send("text-delta", { text: part.text });
                  break;
                }
                case "finish": {
                  // Don't send "done" yet for intermediate steps
                  break;
                }
              }
            }

            // Save step output as context for next step
            priorStepOutput = stepText;

            // --- Cognitive Engine: verify step output (non-blocking) ---
            if (stepText.length > 50) {
              verify({
                output: stepText,
                taskTitle: step.taskDescription,
                taskDescription: step.taskDescription,
                employeeId: emp.id,
                employeeSlug: step.employeeSlug,
                organizationId: orgId,
                intentType: intent.intentType,
              })
                .then((vr) => {
                  send("verification", {
                    stepIndex: i,
                    qualityScore: vr.qualityScore,
                    passed: vr.passed,
                    feedback: vr.feedback,
                    issueCount: vr.issues.length,
                    memoriesGenerated: vr.memoriesGenerated.length,
                  });
                })
                .catch((err) =>
                  console.error("[intent-execute] Verification failed:", err)
                );
            }

            // Notify step complete
            send("step-complete", {
              stepIndex: i,
              employeeSlug: step.employeeSlug,
              employeeName: step.employeeName,
              summary: stepText.slice(0, 200),
            });
          }

          // All steps done
          send("done", {
            sources: allSources,
            referenceCount,
            skillsUsed: usedSkills,
            finishReason: "stop",
          });
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "未知错误",
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
    console.error("[intent-execute] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
