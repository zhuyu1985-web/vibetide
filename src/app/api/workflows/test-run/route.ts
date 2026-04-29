import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assembleAgent, executeAgent } from "@/lib/agent";
import {
  invokeToolDirectly,
  isToolRegistered,
} from "@/lib/agent/tool-registry";
import { loadSkillContent } from "@/lib/skill-loader";
import {
  loadAvailableEmployees,
  pickEmployeeForStep,
} from "@/lib/mission-core";
import { getOrProvisionLeader } from "@/app/actions/missions";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";
import type { StepOutput } from "@/lib/agent/types";
import type { EmployeeId } from "@/lib/constants";
import { renderScenarioTemplate } from "@/lib/scenario-template";

// ---------------------------------------------------------------------------
// POST /api/workflows/test-run
//
// 测试运行 ≡ 实际执行（设计原则）：同一套代码路径，保证用户在编辑器里点
// "测试运行"看到的每一步结果，与点"运行"（真实启动 mission）后的每一步
// 结果完全等同。这样才能用来调试工作流。
//
// 关键复用：
//   - invokeToolDirectly / isToolRegistered  ← 跟 mission-executor 同源
//   - assembleAgent / executeAgent           ← 跟 mission-executor 同源
//   - loadSkillContent                       ← SKILL.md 作为系统合同注入
//   - pickEmployeeForStep / loadAvailableEmployees
//                                            ← 跟模板 fast-path 同源
//
// 差异：
//   - 不落库（不创建 mission / mission_task / mission_message / artifact）
//   - 通过 SSE 把每步结果 push 给前端，而不是写 DB
//   - previousSteps 本地累积，不从 DB 查 dependency 输出
// ---------------------------------------------------------------------------

// 本地累积的"前置步骤输出"，对齐 executeAgent 需要的 StepOutput 结构 ——
// 让后续步骤的 agent 能看到前面步骤的真实产出，跟实际执行里
// `loadDependencyOutputs` 的语义一致。
interface LocalPreviousStep {
  output: StepOutput;
  /** 用于 UI 展示的完整文本（同时保存以便做 extractSummary 等） */
  displayText: string;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const {
      steps,
      triggerType,
      userInputs,
      promptTemplate,
      inputFields,
    } = body as {
      steps: WorkflowStepDef[];
      triggerType: "manual" | "scheduled";
      triggerConfig?: { cron?: string; timezone?: string } | null;
      userInputs?: Record<string, unknown>;
      promptTemplate?: string;
      inputFields?: InputFieldDef[];
    };

    if (!steps || !Array.isArray(steps)) {
      return new Response("缺少步骤数据", { status: 400 });
    }

    // inputParams：mission 层的语义与 mission-executor 对齐。用于后面
    // Mustache 渲染、推断 query、构造【工作流输入参数】块。
    const inputParams: Record<string, unknown> = { ...(userInputs ?? {}) };

    // stringInputs：字符串化后的版本（供 Mustache 替换、prompt 显示用）。
    const stringInputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputParams)) {
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v)) stringInputs[k] = v.join("、");
      else if (typeof v === "object") stringInputs[k] = JSON.stringify(v);
      else stringInputs[k] = String(v);
    }

    const resolvedPromptTemplate = promptTemplate
      ? renderScenarioTemplate(promptTemplate, stringInputs)
      : "";

    // mission-executor 里的 missionInstructionBlock：把 promptTemplate 渲染
    // 结果当作"本次工作流任务"介绍。测试运行同样呈现给 agent。
    const missionInstructionBlock = resolvedPromptTemplate
      ? `【本次工作流任务】\n${resolvedPromptTemplate}`
      : "";

    const inputParamsBlock =
      Object.keys(inputParams).length > 0
        ? `【工作流输入参数】\n${Object.entries(inputParams)
            .map(
              ([k, v]) =>
                `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
            )
            .join("\n")}`
        : "";

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });
    if (!profile?.organizationId) {
      return new Response("未找到组织信息", { status: 403 });
    }
    const orgId = profile.organizationId;

    // Pre-load all employees + leader（同 mission-executor 的 fast-path）
    const availableEmployees = await loadAvailableEmployees(orgId);
    const leader = await getOrProvisionLeader(orgId);

    const encoder = new TextEncoder();
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
            // controller 已关闭
          }
        };

        let completedSteps = 0;
        let failedSteps = 0;
        const previousSteps: LocalPreviousStep[] = [];

        try {
          send("trigger-start", {});
          send("trigger-complete", {
            message:
              triggerType === "scheduled"
                ? "定时触发器已模拟完成"
                : "手动触发器已完成",
          });

          const sortedSteps = [...steps].sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0),
          );

          for (let i = 0; i < sortedSteps.length; i++) {
            const step = sortedSteps[i];
            const skillSlug = step.config?.skillSlug;
            const skillName = step.config?.skillName || step.name;

            send("step-start", { stepId: step.id, stepIndex: i, skillName });

            const stepStartedAt = Date.now();

            try {
              // ── 1. 选员工（对齐 mission-executor 的 pickEmployeeForStep） ──
              const matched = pickEmployeeForStep(
                step,
                [], // 测试运行没 defaultTeam 概念；pick 内部会跳到"员工技能匹配"逻辑
                availableEmployees,
              );
              const assignedEmployeeId = matched?.id ?? leader.id;
              const employeeName = matched?.name ?? leader.name;

              send("step-progress", {
                stepId: step.id,
                message: `${employeeName} 正在执行「${skillName}」...`,
              });

              // ── 2. 步骤绑定参数渲染（Mustache） ─────────────────────
              const rawStepParams = (step.config?.parameters ?? {}) as Record<
                string,
                unknown
              >;
              const renderedParams: Record<string, unknown> = {};
              for (const [k, rawV] of Object.entries(rawStepParams)) {
                if (typeof rawV === "string") {
                  renderedParams[k] = rawV.replace(
                    /\{\{(\w+)\}\}/g,
                    (_, name) => {
                      const v = inputParams[name];
                      if (v === undefined || v === null) return "";
                      if (typeof v === "object") return JSON.stringify(v);
                      return String(v);
                    },
                  );
                } else {
                  renderedParams[k] = rawV;
                }
              }

              // 只有用户显式绑定参数才进入短路。没绑参数不要猜 ——
              // 不同工具的必填参数不同（web_search 要 query / content_generate 要
              // outline / web_deep_read 要 url），盲猜 "query" 会导致 schema 校验
              // 失败（已发生事故：content_generate 被强塞 query="CCBN" 而报错）。
              // 无绑定就走 agent 路径，让 LLM 看上下文 + SKILL.md 决定参数。
              const effectiveParams = renderedParams;

              // ── 3. 数据获取类短路：有真实工具实现 + 用户显式绑定参数 → 真调 + 直出 ────
              if (
                skillSlug &&
                isToolRegistered(skillSlug) &&
                Object.keys(effectiveParams).length > 0
              ) {
                const invocation = await invokeToolDirectly(
                  skillSlug,
                  effectiveParams,
                  // 注入 org / operator 上下文 —— cms_publish 等多租户写入
                  // 型工具需要这两个字段才能跑（用户无需在 UI 里绑定）。
                  {
                    organizationId: orgId,
                    operatorId: user.id,
                  },
                );
                const paramsLine = Object.entries(effectiveParams)
                  .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                  .join(", ");

                if (invocation.ok) {
                  const serialized = JSON.stringify(invocation.result, null, 2);
                  const truncated =
                    serialized.length > 6000
                      ? serialized.slice(0, 6000) +
                        "\n... (结果过长已截断)"
                      : serialized;
                  const resultObj = invocation.result as {
                    results?: unknown[];
                  } | null;
                  const count =
                    resultObj && Array.isArray(resultObj.results)
                      ? resultObj.results.length
                      : undefined;
                  const countNote =
                    count === 0
                      ? "\n\n⚠️ 真实结果 0 条。请调整参数重试（扩大 timeRange / 更换关键词）。"
                      : count !== undefined
                        ? `\n\n（真实命中 ${count} 条）`
                        : "";
                  const deterministicText = `【执行摘要】工具 \`${skillSlug}\` 在 server 端真实调用完成（参数：${paramsLine}）${countNote}

【执行过程】
1. 使用步骤绑定的参数直接调用 \`${skillSlug}\`：${paramsLine}
2. 接收工具原始返回值（真实数据，未经 LLM 修饰）
3. 本步骤跳过 LLM 模拟以防止按模板编造结果

【产出结果】
\`\`\`json
${truncated}
\`\`\`

【质量评估】
- 可信度：高（真实工具调用，非模拟）
- 建议改进：${count === 0 ? "调整 timeRange / 关键词后重跑" : "无"}`;

                  const summary = extractSummary(deterministicText, skillName);
                  const durationMs = Date.now() - stepStartedAt;
                  send("step-complete", {
                    stepId: step.id,
                    stepIndex: i,
                    result: deterministicText,
                    summary,
                    durationMs,
                    employeeName,
                    success: true,
                  });
                  previousSteps.push({
                    output: {
                      stepKey: step.id,
                      employeeSlug: (matched?.slug ??
                        leader.slug) as EmployeeId,
                      summary,
                      artifacts: [
                        {
                          id: `${step.id}-result`,
                          type: "generic",
                          title: `${skillSlug} 结果`,
                          content:
                            typeof invocation.result === "string"
                              ? invocation.result
                              : JSON.stringify(invocation.result, null, 2),
                        },
                      ],
                      metrics: { qualityScore: count === 0 ? 60 : 85 },
                      status: "success",
                    },
                    displayText: deterministicText,
                  });
                  completedSteps++;
                  continue;
                }
                // 工具调用失败 → 如实报告错误（不 fallback 到 LLM 编造）
                const errText = `【执行摘要】工具 \`${skillSlug}\` 调用失败

【执行过程】
1. 尝试调用 \`${skillSlug}\`（参数：${paramsLine}）
2. 错误：${invocation.error}

【产出结果】
工具调用失败，无法返回真实数据。请检查环境变量（如 TAVILY_API_KEY）/ 网络 / 参数格式。

【质量评估】
- 可信度：不适用
- 建议改进：排查错误后重试`;
                const durationMs = Date.now() - stepStartedAt;
                send("step-complete", {
                  stepId: step.id,
                  stepIndex: i,
                  result: errText,
                  summary: `${skillSlug} 调用失败`,
                  durationMs,
                  employeeName,
                  success: true,
                });
                previousSteps.push({
                  output: {
                    stepKey: step.id,
                    employeeSlug: (matched?.slug ??
                      leader.slug) as EmployeeId,
                    summary: `${skillSlug} 调用失败：${invocation.error}`,
                    artifacts: [],
                    metrics: { qualityScore: 0 },
                    status: "partial",
                  },
                  displayText: errText,
                });
                completedSteps++;
                continue;
              }

              // ── 4. 其他 skill：走 agent 路径（与 mission-executor 完全一致） ──
              //
              // assembleAgent 会装配：员工画像 + 已绑定技能 + 知识库 + 记忆 →
              // 编译出带 SKILL.md 作为系统合同的完整 system prompt。
              // executeAgent 真调 LLM（允许工具调用），返回 { output, tokensUsed }。
              //
              // 这跟 mission-executor.ts executeTaskDirect 走的是同一条路 ——
              // 测试结果 = 实际执行结果。
              const agent = await assembleAgent(assignedEmployeeId);

              // 若 skill 有真实工具实现但 agent 没预绑定 → 强制注入（对齐
              // mission-executor 的 force-inject 逻辑，避免 leader 兜底时
              // 拿不到工具被迫凭想象编造）
              if (
                skillSlug &&
                isToolRegistered(skillSlug) &&
                !agent.tools.some((t) => t.name === skillSlug)
              ) {
                agent.tools = [
                  ...agent.tools,
                  {
                    name: skillSlug,
                    description: `工作流指定的执行技能：${skillName}`,
                    parameters: {},
                  },
                ];
              }

              // 加载 SKILL.md 作为 skillSpec（真实执行路径用同样方式注入）
              const skillBody = skillSlug
                ? loadSkillContent(skillSlug)
                : null;

              // 步骤说明也渲染 Mustache（跟 mission-executor.ts 里的
              // 【本步骤指示】块语义一致）
              const rawDescription =
                step.config?.description || `执行「${skillName}」任务`;
              const stepDescription = renderScenarioTemplate(
                rawDescription,
                stringInputs,
              );

              // 工具调用强制块：与 mission-executor 对齐，告诉 LLM 优先用
              // 【调用参数】里的值（若有绑定）
              const paramsForInstruction =
                Object.keys(effectiveParams).length > 0
                  ? `【调用参数（必须严格使用这些值调用工具，禁止自行修改）】\n${Object.entries(
                      effectiveParams,
                    )
                      .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
                      .join("\n")}`
                  : "";
              const toolEnforcementBlock = skillSlug
                ? `【工具调用要求】\n本步骤对应技能 \`${skillSlug}\`。参数来源优先级：\n1. 优先使用【调用参数】里的值（显式绑定），禁止自行改写；\n2. 否则从【工作流输入参数】里挑合适字段；\n3. 绝不能使用步骤名、技能描述里的关键词、或训练数据里的热门话题替代。\n\n严禁伪造来源、时间、数据。若工具返回空，如实报告。`
                : "";

              const userInstructions = [
                inputParamsBlock,
                missionInstructionBlock,
                paramsForInstruction,
                `【本步骤指示】\n${stepDescription}`,
                toolEnforcementBlock,
              ]
                .filter(Boolean)
                .join("\n\n");

              const execResult = await executeAgent(
                agent,
                {
                  stepKey: step.id,
                  stepLabel: step.name,
                  scenario: "test_run",
                  topicTitle:
                    stringInputs.topic_title ??
                    stringInputs.title ??
                    stringInputs.query ??
                    skillName,
                  previousSteps: previousSteps.map((p) => p.output),
                  userInstructions,
                  skillSpec: skillBody ?? undefined,
                },
                undefined,
                undefined, // 测试运行无 missionTools（无 mission 上下文可post message）
              );

              const resultText =
                execResult.output.summary ||
                `「${skillName}」执行完成`;
              const structuredText = formatAgentResultForDisplay(execResult);
              const summary = extractSummary(structuredText, skillName);
              const durationMs = Date.now() - stepStartedAt;

              send("step-complete", {
                stepId: step.id,
                stepIndex: i,
                result: structuredText,
                summary,
                durationMs,
                employeeName,
                success: true,
              });
              previousSteps.push({
                output: execResult.output,
                displayText: structuredText,
              });
              completedSteps++;
            } catch (stepErr) {
              console.error(`[test-run] Step "${skillName}" failed:`, stepErr);
              const durationMs = Date.now() - stepStartedAt;
              const errorMessage =
                stepErr instanceof Error ? stepErr.message : "步骤执行失败";
              send("step-failed", {
                stepId: step.id,
                stepIndex: i,
                error: errorMessage,
                summary: errorMessage.slice(0, 60),
                durationMs,
              });
              failedSteps++;
            }
          }

          send("done", {
            totalSteps: sortedSteps.length,
            completedSteps,
            failedSteps,
          });
        } catch (err) {
          console.error("[test-run] Unhandled stream error:", err);
          send("error", {
            message: err instanceof Error ? err.message : "测试运行失败",
          });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
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
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 把 executeAgent 返回的结构化 StepOutput 格式化为用户可读的三段式文本。
 * AgentExecutionResult.output 已经是 { summary, artifacts, metrics, status }，
 * 我们把 summary 放到【执行摘要】，artifacts 正文拼进【产出结果】。
 */
function formatAgentResultForDisplay(result: {
  output: {
    summary: string;
    artifacts: { type?: string; title?: string; content: unknown }[];
    metrics?: { qualityScore?: number; wordCount?: number };
    status: string;
  };
}): string {
  const out = result.output;
  const parts: string[] = [];
  parts.push(`【执行摘要】${out.summary || "（无摘要）"}`);

  if (out.artifacts.length > 0) {
    parts.push("【产出结果】");
    for (const a of out.artifacts) {
      const heading = a.title ? `#### ${a.title}` : "";
      const content =
        typeof a.content === "string"
          ? a.content
          : JSON.stringify(a.content, null, 2);
      parts.push([heading, content].filter(Boolean).join("\n"));
    }
  }

  if (out.metrics?.qualityScore !== undefined) {
    parts.push(`【质量自评：${out.metrics.qualityScore}/100】`);
  }

  return parts.join("\n\n");
}

/**
 * 从"【执行摘要】..."段抽一行简要文案，作为 UI inline 展示用。
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
