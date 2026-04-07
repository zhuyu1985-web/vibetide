import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  aiEmployees,
  userProfiles,
  employeeSkills,
  skills,
  intentLogs,
  workflowTemplates,
} from "@/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import {
  recognizeIntent,
  type IntentResult,
  type IntentMemoryEntry,
  type AvailableWorkflow,
} from "@/lib/agent/intent-recognition";

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
    const { message, employeeSlug } = body as {
      message: string;
      employeeSlug: string;
    };

    if (!message?.trim()) {
      return new Response("缺少消息内容", { status: 400 });
    }

    // SSE stream for real-time progress
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
          send("progress", {
            phase: "auth",
            label: "正在验证身份...",
          });

          const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, user.id),
          });
          if (!profile?.organizationId) {
            send("error", { message: "Organization not found" });
            controller.close();
            return;
          }

          // Phase 2: Load data
          send("progress", {
            phase: "loading",
            label: "正在加载员工能力档案...",
          });

          const [empRows, recentLogs, workflowRows] = await Promise.all([
            db.query.aiEmployees.findMany({
              where: eq(
                aiEmployees.organizationId,
                profile.organizationId
              ),
            }),
            db
              .select({
                userMessage: intentLogs.userMessage,
                intentType: intentLogs.intentType,
                intentResult: intentLogs.intentResult,
                userEdited: intentLogs.userEdited,
              })
              .from(intentLogs)
              .where(
                and(
                  eq(intentLogs.userId, user.id),
                  eq(intentLogs.organizationId, profile.organizationId)
                )
              )
              .orderBy(desc(intentLogs.createdAt))
              .limit(10),
            db
              .select({
                id: workflowTemplates.id,
                name: workflowTemplates.name,
                description: workflowTemplates.description,
                triggerType: workflowTemplates.triggerType,
              })
              .from(workflowTemplates)
              .where(
                eq(
                  workflowTemplates.organizationId,
                  profile.organizationId
                )
              ),
          ]);

          // Deduplicate employees by slug
          const seen = new Set<string>();
          const uniqueEmps = empRows.filter((r) => {
            if (seen.has(r.slug)) return false;
            seen.add(r.slug);
            return true;
          });

          // Batch-load skills
          const empIds = uniqueEmps.map((e) => e.id);
          const allSkillRows =
            empIds.length > 0
              ? await db
                  .select({
                    employeeId: employeeSkills.employeeId,
                    skillName: skills.name,
                  })
                  .from(employeeSkills)
                  .innerJoin(
                    skills,
                    eq(employeeSkills.skillId, skills.id)
                  )
                  .where(inArray(employeeSkills.employeeId, empIds))
              : [];

          const skillsByEmp = new Map<string, string[]>();
          for (const row of allSkillRows) {
            const list = skillsByEmp.get(row.employeeId) || [];
            list.push(row.skillName);
            skillsByEmp.set(row.employeeId, list);
          }

          const availableEmployees = uniqueEmps.map((e) => ({
            slug: e.slug,
            name: e.name,
            nickname: e.nickname,
            title: e.title,
            skills: skillsByEmp.get(e.id) || [],
          }));

          send("progress", {
            phase: "loaded",
            label: `已加载 ${availableEmployees.length} 名员工，共 ${allSkillRows.length} 项技能`,
          });

          // Phase 3: Build memories
          const userMemories: IntentMemoryEntry[] = recentLogs.map(
            (log) => {
              const result = log.intentResult as IntentResult;
              return {
                userMessage: log.userMessage,
                intentType: log.intentType,
                skills:
                  result?.steps?.flatMap((s) => s.skills) ?? [],
                userEdited: log.userEdited,
              };
            }
          );

          if (userMemories.length > 0) {
            send("progress", {
              phase: "memory",
              label: `已加载 ${userMemories.length} 条历史意图记忆`,
            });
          }

          // Phase 4: LLM recognition
          send("progress", {
            phase: "analyzing",
            label: "正在分析意图、匹配技能组合...",
          });

          // Build available workflows list
          const availableWorkflows: AvailableWorkflow[] = workflowRows.map(
            (w) => ({
              id: w.id,
              name: w.name,
              description: w.description,
              triggerType: w.triggerType ?? "manual",
            })
          );

          const intentResult = await recognizeIntent(
            message,
            employeeSlug || uniqueEmps[0]?.slug || "xiaolei",
            availableEmployees,
            userMemories,
            availableWorkflows
          );

          // Phase 5: Result
          send("result", intentResult as unknown as Record<string, unknown>);
        } catch (err) {
          send("error", {
            message:
              err instanceof Error ? err.message : "意图识别失败",
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
    console.error("[chat/intent] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
