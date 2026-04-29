import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { skills, userProfiles } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { generateText } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";

// ---------------------------------------------------------------------------
// System prompt — multi-round conversation + workflow generation
// ---------------------------------------------------------------------------

function buildSystemPrompt(skillCatalog: string): string {
  return `你是 Vibe Media 的工作流规划专家，帮助用户设计自动化内容生产工作流。

## 你的工作方式

你需要通过多轮对话与用户充分沟通，理解用户的真实需求后再生成工作流。**绝对不要在第一轮对话就直接生成工作流。**

### 对话阶段（输出纯文本）

在对话阶段，你需要了解以下关键信息（根据用户已提供的信息灵活提问，不要逐条问，自然对话）：

1. **目标场景** — 这个工作流用于什么场景？（日常新闻、突发事件、专题策划、短视频等）
2. **触发方式** — 手动触发还是定时自动执行？如果定时，频率是？
3. **内容类型** — 产出文章、视频、数据报告还是多种？
4. **发布渠道** — 发布到哪些平台？（微信公众号、抖音、微博等）
5. **特殊要求** — 是否需要审核环节？有没有质量要求或风格偏好？
6. **步骤确认** — 告诉用户你打算安排哪些步骤，征求确认或调整

对话中请：
- 一次问 1-2 个关键问题，不要一口气问太多
- 根据用户回答动态调整后续问题
- 当你已经有足够信息时，先给用户总结你理解的需求和初步方案，问用户"是否按此方案生成工作流？"
- 用户确认后再生成

### 生成阶段（输出 JSON）

当用户明确确认可以生成时（如回复"好的"、"可以"、"生成吧"、"确认"等），输出纯 JSON（不要 markdown 代码块）：

{
  "name": "工作流名称",
  "description": "工作流描述",
  "category": "news|video|analytics|distribution|custom",
  "triggerType": "manual|scheduled",
  "triggerConfig": null,
  "steps": [
    {
      "name": "步骤显示名",
      "skillSlug": "skill_slug",
      "skillName": "技能名称",
      "skillCategory": "perception|analysis|generation|production|management|knowledge",
      "description": "这个步骤具体要做什么（1-2 句，必填且不可为空）"
    }
  ]
}

## 关于 description 字段（非常重要）

每个步骤的 description 是该步骤执行时传给 AI 员工的核心指令，**必须具体、可执行**，不能为空、不能只是重复步骤名。

写作要求：
- 说清楚"做什么 + 关键约束/参数"
- 结合用户前面对话中透露的上下文（目标受众、字数、风格、渠道等）
- 1-2 句话，40-80 字为宜

对比示例：
- ❌ "内容创作"、"生成文章"、"写一篇稿件"（过于笼统，AI 不知道具体要求）
- ✅ "基于前序热点分析，撰写面向科技读者的 1500 字深度评论，结构为'现象-数据-观点-展望'，语言严谨克制"
- ✅ "抓取微博/知乎/抖音当日科技话题 TOP20，筛选热度>80 的条目并按领域归类"

## 可用技能列表

${skillCatalog}

## 规则

1. 每个步骤必须使用一个可用的技能 slug
2. 步骤按执行顺序排列，数量合理（通常 2-6 步）
3. triggerConfig 在 scheduled 时为 { "cron": "表达式", "timezone": "Asia/Shanghai" }，manual 时为 null
4. category 根据工作流主要用途选择
5. 当且仅当用户确认后才输出 JSON，其余时候输出自然对话文本`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // Auth
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { messages } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("缺少对话内容", { status: 400 });
    }

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
            // Controller closed
          }
        };

        try {
          send("thinking", { message: "思考中..." });

          const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, user.id),
          });
          if (!profile?.organizationId) {
            send("error", { message: "未找到组织信息" });
            controller.close();
            return;
          }

          // Load available skills
          const allSkills = await db
            .select({
              slug: skills.slug,
              name: skills.name,
              category: skills.category,
              description: skills.description,
            })
            .from(skills)
            .where(isNotNull(skills.slug));

          if (allSkills.length === 0) {
            send("error", { message: "未找到可用技能" });
            controller.close();
            return;
          }

          const skillCatalog = allSkills
            .map(
              (s) =>
                `- ${s.slug} - ${s.name}（${s.category}）- ${s.description}`
            )
            .join("\n");

          const validSlugs = new Set(allSkills.map((s) => s.slug));
          const systemPrompt = buildSystemPrompt(skillCatalog);

          // Call LLM with full conversation history
          const result = await generateText({
            model: getLanguageModel({
              provider: "openai",
              model: process.env.OPENAI_MODEL || "deepseek-chat",
              temperature: 0.4,
              maxTokens: 2048,
            }),
            system: systemPrompt,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            maxOutputTokens: 2048,
          });

          let text = result.text.trim();

          // Detect if response is JSON (workflow generation) or conversation
          // Strip markdown code block if present
          let jsonText = text;
          if (jsonText.startsWith("```")) {
            jsonText = jsonText
              .replace(/^```(?:json)?\s*/, "")
              .replace(/\s*```$/, "");
          }

          let isWorkflowJson = false;
          if (jsonText.startsWith("{")) {
            try {
              const parsed = JSON.parse(jsonText) as {
                name?: string;
                steps?: Array<{
                  name: string;
                  skillSlug: string;
                  skillName: string;
                  skillCategory: string;
                  description: string;
                }>;
                description?: string;
                category?: string;
                triggerType?: string;
                triggerConfig?: {
                  cron?: string;
                  timezone?: string;
                } | null;
              };

              // Check if it looks like a valid workflow spec
              if (parsed.name && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
                isWorkflowJson = true;

                // Validate steps
                parsed.steps = parsed.steps.filter((s) =>
                  validSlugs.has(s.skillSlug)
                );

                const validCategories = [
                  "news",
                  "video",
                  "analytics",
                  "distribution",
                  "custom",
                ];
                if (!parsed.category || !validCategories.includes(parsed.category)) {
                  parsed.category = "custom";
                }
                if (!parsed.triggerType || !["manual", "scheduled"].includes(parsed.triggerType)) {
                  parsed.triggerType = "manual";
                  parsed.triggerConfig = null;
                }

                send("result", parsed as unknown as Record<string, unknown>);
              }
            } catch {
              // Not valid JSON — treat as conversation
              isWorkflowJson = false;
            }
          }

          if (!isWorkflowJson) {
            // Conversational reply
            send("reply", { message: text });
          }
        } catch (err) {
          console.error("[workflows/generate] Error:", err);
          send("error", {
            message:
              err instanceof Error ? err.message : "工作流生成失败",
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
    console.error("[workflows/generate] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
