import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { aiEmployees, employeeScenarios, userProfiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { resolveTools, toVercelTools } from "@/lib/agent/tool-registry";
import { assembleAgent } from "@/lib/agent/assembly";
import { getBuiltinSkillSlugToName } from "@/lib/skill-loader";

function resolveTemplate(
  template: string,
  inputs: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => inputs[key] ?? "");
}

/** Friendly Chinese labels for tool names */
const TOOL_LABELS: Record<string, string> = {
  web_search: "正在搜索互联网资料",
  deep_read: "正在深度阅读网页",
  trending_topics: "正在获取全网热榜",
  content_generate: "正在生成内容",
  fact_check: "正在进行事实核查",
  media_search: "正在检索媒资库",
  data_report: "正在生成数据报告",
};

/** Map tool slug → skill display name */
const TOOL_TO_SKILL: Record<string, string> = Object.fromEntries(
  getBuiltinSkillSlugToName()
);

/** Extract domain from URL */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Extract source domains from tool call results */
function extractSources(toolResult: unknown): string[] {
  if (!toolResult || typeof toolResult !== "object") return [];
  const obj = toolResult as Record<string, unknown>;

  // web_search returns { results: [{ url, source }] }
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

  // deep_read returns { url, ... }
  if (typeof obj.url === "string") {
    return [extractDomain(obj.url)];
  }

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
    const {
      employeeDbId,
      scenarioId,
      userInputs,
      conversationHistory,
    } = body as {
      employeeDbId: string;
      scenarioId: string;
      userInputs: Record<string, string>;
      conversationHistory?: { role: "user" | "assistant"; content: string }[];
    };

    // Look up org directly from user profile — avoids getCurrentUserOrg()+cache()
    // which can return null in Route Handler context
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });
    if (!profile?.organizationId) {
      return new Response("Organization not found", { status: 403 });
    }

    // Verify employee belongs to this organization
    const employeeRecord = await db.query.aiEmployees.findFirst({
      where: and(
        eq(aiEmployees.id, employeeDbId),
        eq(aiEmployees.organizationId, profile.organizationId)
      ),
    });
    if (!employeeRecord) {
      return new Response("员工不存在或无权操作", { status: 403 });
    }

    const scenario = await db.query.employeeScenarios.findFirst({
      where: and(
        eq(employeeScenarios.id, scenarioId),
        eq(employeeScenarios.organizationId, profile.organizationId)
      ),
    });
    if (!scenario) {
      return new Response("Scenario not found", { status: 404 });
    }

    let agent;
    try {
      agent = await assembleAgent(employeeDbId);
    } catch (err) {
      console.error("[scenario/execute] assembleAgent failed:", err);
      return new Response(
        `Agent assembly failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 500 }
      );
    }

    const resolvedInstruction = resolveTemplate(
      scenario.systemInstruction,
      userInputs
    );

    const messages: { role: "user" | "assistant"; content: string }[] = [];
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-10));
    } else {
      messages.push({ role: "user", content: resolvedInstruction });
    }

    let model;
    try {
      model = getLanguageModel(agent.modelConfig);
    } catch (err) {
      console.error("[scenario/execute] getLanguageModel failed:", err);
      return new Response(
        `Model init failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 500 }
      );
    }

    const toolsHint = (scenario.toolsHint ?? []) as string[];
    const agentTools =
      toolsHint.length > 0 ? resolveTools(toolsHint) : agent.tools;
    const vercelTools = toVercelTools(agentTools, agent.pluginConfigs);

    const result = streamText({
      model,
      system: `${agent.systemPrompt}\n\n# 当前场景任务\n${resolvedInstruction}`,
      messages,
      tools: vercelTools,
      stopWhen: stepCountIs(10),
      maxOutputTokens: 8192,
      temperature: 0.5,
    });

    // Custom SSE stream with structured events
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
            // Controller already closed (client disconnected)
          }
        };

        try {
          for await (const part of result.fullStream) {
            switch (part.type) {
              case "tool-call": {
                const label =
                  TOOL_LABELS[part.toolName] ?? `正在执行${part.toolName}`;
                const skillName =
                  TOOL_TO_SKILL[part.toolName] ?? part.toolName;
                // Track unique skills used
                if (!usedToolSet.has(part.toolName)) {
                  usedToolSet.add(part.toolName);
                  usedSkills.push({ tool: part.toolName, skillName });
                }
                send("thinking", { tool: part.toolName, label, skillName });
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
                send("text-delta", { text: part.text });
                break;
              }
              case "finish": {
                send("done", {
                  sources: allSources,
                  referenceCount,
                  finishReason: part.finishReason,
                  skillsUsed: usedSkills,
                });
                break;
              }
            }
          }
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
    console.error("[scenario/execute] Unhandled route error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
