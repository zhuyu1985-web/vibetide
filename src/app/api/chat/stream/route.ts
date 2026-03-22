import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { aiEmployees, userProfiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { resolveTools, toVercelTools } from "@/lib/agent/tool-registry";
import { assembleAgent } from "@/lib/agent/assembly";
import { BUILTIN_SKILLS } from "@/lib/constants";

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

/** Map tool slug -> skill display name */
const TOOL_TO_SKILL: Record<string, string> = Object.fromEntries(
  BUILTIN_SKILLS.map((s) => [s.slug, s.name])
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
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { employeeSlug, conversationHistory } = body as {
    employeeSlug: string;
    conversationHistory: { role: "user" | "assistant"; content: string }[];
  };

  if (!employeeSlug || !conversationHistory?.length) {
    return new Response("缺少必要参数", { status: 400 });
  }

  // Look up org from user profile
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return new Response("Organization not found", { status: 403 });
  }

  // Find employee by slug + org
  const employeeRecord = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.slug, employeeSlug),
      eq(aiEmployees.organizationId, profile.organizationId)
    ),
  });
  if (!employeeRecord) {
    return new Response("员工不存在或无权操作", { status: 403 });
  }

  // Assemble agent
  let agent;
  try {
    agent = await assembleAgent(employeeRecord.id);
  } catch (err) {
    console.error("[chat/stream] assembleAgent failed:", err);
    return new Response(
      `Agent assembly failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }

  // Use the last 10 messages as context
  const messages = conversationHistory.slice(-10);

  let model;
  try {
    model = getLanguageModel(agent.modelConfig);
  } catch (err) {
    console.error("[chat/stream] getLanguageModel failed:", err);
    return new Response(
      `Model init failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }

  // Free chat: use agent's own tools (no scenario-specific toolsHint)
  const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);

  const result = streamText({
    model,
    system: agent.systemPrompt,
    messages,
    tools: vercelTools,
    stopWhen: stepCountIs(10),
    maxOutputTokens: 8192,
    temperature: 0.5,
  });

  // Custom SSE stream with structured events (same protocol as /api/scenarios/execute)
  const encoder = new TextEncoder();
  const allSources: string[] = [];
  let referenceCount = 0;
  const usedSkills: { tool: string; skillName: string }[] = [];
  const usedToolSet = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        for await (const part of result.fullStream) {
          switch (part.type) {
            case "tool-call": {
              const label =
                TOOL_LABELS[part.toolName] ?? `正在执行${part.toolName}`;
              const skillName = TOOL_TO_SKILL[part.toolName] ?? part.toolName;
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
        controller.close();
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
}
