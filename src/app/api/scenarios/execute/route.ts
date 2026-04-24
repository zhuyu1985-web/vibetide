import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  aiEmployees,
  userProfiles,
  workflowTemplates,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { toVercelTools } from "@/lib/agent/tool-registry";
import { assembleAgent } from "@/lib/agent/assembly";
import { getBuiltinSkillSlugToName } from "@/lib/skill-loader";
import { renderScenarioTemplate } from "@/lib/scenario-template";
import { notifyChatMessage } from "@/lib/channels/chat-notifier";

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
  getBuiltinSkillSlugToName(),
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { employeeDbId, scenarioId, userInputs, conversationHistory } =
      body as {
        employeeDbId: string;
        scenarioId: string;
        userInputs: Record<string, string>;
        conversationHistory?: { role: "user" | "assistant"; content: string }[];
      };

    if (!employeeDbId || !scenarioId) {
      return new Response("缺少必要参数", { status: 400 });
    }

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });
    if (!profile?.organizationId) {
      return new Response("Organization not found", { status: 403 });
    }
    const organizationId: string = profile.organizationId;

    const employeeRecord = await db.query.aiEmployees.findFirst({
      where: and(
        eq(aiEmployees.id, employeeDbId),
        eq(aiEmployees.organizationId, organizationId),
      ),
    });
    if (!employeeRecord) {
      return new Response("员工不存在或无权操作", { status: 403 });
    }

    // Scenario = workflow_templates row (B.1 unified source). May be org-
    // scoped or a global builtin (organizationId is nullable in schema).
    const template = await db.query.workflowTemplates.findFirst({
      where: and(
        eq(workflowTemplates.id, scenarioId),
        eq(workflowTemplates.organizationId, organizationId),
      ),
    });
    if (!template) {
      return new Response("场景不存在或无权访问", { status: 404 });
    }

    const inputs = userInputs ?? {};
    const rawInstruction =
      template.systemInstruction?.trim() ||
      template.promptTemplate?.trim() ||
      template.description?.trim() ||
      template.name;
    const resolvedInstruction = renderScenarioTemplate(rawInstruction, inputs);

    // Build the user-facing message (what the LLM sees as the turn prompt).
    // Prefer promptTemplate for conversational framing, fall back to the
    // resolved instruction so short-form templates still work.
    const userPromptTemplate = (
      template.promptTemplate?.trim() ||
      template.systemInstruction?.trim() ||
      template.description?.trim() ||
      template.name
    ) as string;
    const resolvedUserPrompt = renderScenarioTemplate(
      userPromptTemplate,
      inputs,
    );

    let agent;
    try {
      agent = await assembleAgent(employeeDbId);
    } catch (err) {
      console.error("[scenario/execute] assembleAgent failed:", err);
      return new Response(
        `Agent assembly failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 500 },
      );
    }

    const messages: { role: "user" | "assistant"; content: string }[] = [];
    if (conversationHistory?.length) {
      messages.push(...conversationHistory.slice(-10));
    }
    messages.push({ role: "user", content: resolvedUserPrompt });

    let model;
    try {
      model = getLanguageModel(agent.modelConfig);
    } catch (err) {
      console.error("[scenario/execute] getLanguageModel failed:", err);
      return new Response(
        `Model init failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 500 },
      );
    }

    const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);

    const result = streamText({
      model,
      system: `${agent.systemPrompt}\n\n# 当前场景任务\n${resolvedInstruction}`,
      messages,
      tools: vercelTools,
      stopWhen: stepCountIs(10),
      maxOutputTokens: 8192,
      temperature: 0.5,
    });

    const encoder = new TextEncoder();
    const allSources: string[] = [];
    let referenceCount = 0;
    const usedSkills: { tool: string; skillName: string }[] = [];
    const usedToolSet = new Set<string>();
    let assistantText = "";

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
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
                assistantText += part.text;
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
          console.error("[scenario/execute] stream error:", err);
          send("error", {
            message: err instanceof Error ? err.message : "未知错误",
          });
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed
          }

          if (assistantText.trim()) {
            void notifyChatMessage({
              organizationId,
              userId: user.id,
              employeeSlug: employeeRecord.slug,
              employeeName:
                employeeRecord.nickname ||
                employeeRecord.name ||
                employeeRecord.slug,
              userMessage: resolvedUserPrompt,
              assistantMessage: assistantText,
              scenarioName: template.name,
              skillsUsed: usedSkills.map((s) => s.skillName),
            });
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[scenario/execute] top-level error:", err);
    return new Response(
      `Scenario execute failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 },
    );
  }
}
