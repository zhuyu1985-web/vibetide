import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { skills, userProfiles } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { generateText } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";

// ---------------------------------------------------------------------------
// System prompt for workflow generation
// ---------------------------------------------------------------------------

function buildSystemPrompt(skillCatalog: string): string {
  return `你是一个工作流规划专家。用户会描述他们想要自动化的任务，你需要将其分解为一系列技能步骤。

可用技能列表：
${skillCatalog}

规则：
1. 每个步骤必须使用一个可用的技能 slug
2. 步骤按执行顺序排列
3. 返回纯 JSON 格式（不要包含 markdown 代码块标记）
4. 步骤数量合理（通常 2-6 步），不要贪多
5. 如果用户提到定时/每天/定期，设置 triggerType 为 "scheduled" 并生成合理的 cron 表达式
6. 如果用户没提到定时，triggerType 为 "manual"

输出格式：
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
      "description": "这个步骤要做什么"
    }
  ]
}

注意：
- triggerConfig 在 triggerType 为 "scheduled" 时应为 { "cron": "cron表达式", "timezone": "Asia/Shanghai" }
- triggerConfig 在 triggerType 为 "manual" 时应为 null
- category 根据工作流主要用途选择`;
}

// ---------------------------------------------------------------------------
// POST handler
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
    const { description } = body as { description: string };

    if (!description?.trim()) {
      return new Response("缺少描述内容", { status: 400 });
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
          // Phase 1: Auth context
          send("thinking", { message: "分析需求中..." });

          const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, user.id),
          });
          if (!profile?.organizationId) {
            send("error", { message: "未找到组织信息" });
            controller.close();
            return;
          }

          // Phase 2: Load available skills
          send("thinking", { message: "匹配技能中..." });

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

          // Build skill catalog string
          const skillCatalog = allSkills
            .map(
              (s) =>
                `- ${s.slug} - ${s.name}（${s.category}）- ${s.description}`
            )
            .join("\n");

          // Build valid slug set for validation
          const validSlugs = new Set(allSkills.map((s) => s.slug));

          // Phase 3: Call LLM
          send("thinking", { message: "生成工作流..." });

          const systemPrompt = buildSystemPrompt(skillCatalog);

          const result = await generateText({
            model: getLanguageModel({
              provider: "openai",
              model: process.env.OPENAI_MODEL || "deepseek-chat",
              temperature: 0.3,
              maxTokens: 2048,
            }),
            system: systemPrompt,
            messages: [{ role: "user", content: description }],
            temperature: 0.3,
            maxOutputTokens: 2048,
          });

          // Parse LLM output
          let text = result.text.trim();
          if (text.startsWith("```")) {
            text = text
              .replace(/^```(?:json)?\s*/, "")
              .replace(/\s*```$/, "");
          }

          const parsed = JSON.parse(text) as {
            name: string;
            description: string;
            category: string;
            triggerType: string;
            triggerConfig: { cron?: string; timezone?: string } | null;
            steps: Array<{
              name: string;
              skillSlug: string;
              skillName: string;
              skillCategory: string;
              description: string;
            }>;
          };

          // Validate: filter steps with invalid skill slugs
          parsed.steps = parsed.steps.filter((s) =>
            validSlugs.has(s.skillSlug)
          );

          // Validate category
          const validCategories = [
            "news",
            "video",
            "analytics",
            "distribution",
            "custom",
          ];
          if (!validCategories.includes(parsed.category)) {
            parsed.category = "custom";
          }

          // Validate trigger type
          if (!["manual", "scheduled"].includes(parsed.triggerType)) {
            parsed.triggerType = "manual";
            parsed.triggerConfig = null;
          }

          send("result", parsed as unknown as Record<string, unknown>);
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
