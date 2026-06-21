/**
 * Mission Executor — direct execution engine for mission planning and task execution.
 *
 * Provides the same logic as the Inngest functions but can be called directly
 * from server actions without requiring a running Inngest dev server.
 *
 * Flow:
 * 1. leaderPlanDirect() — decomposes mission into tasks (same as leader-plan.ts)
 * 2. executeReadyTasksDirect() — executes all ready tasks sequentially
 * 3. leaderConsolidateDirect() — consolidates all outputs into final result
 */

import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
  missionArtifacts,
  aiEmployees,
  employeeSkills,
} from "@/db/schema";
import { workflowTemplates, type WorkflowStepDef } from "@/db/schema/workflows";
import { eq, and, sql, inArray, lt } from "drizzle-orm";
import { verify } from "@/lib/cognitive/verify-learner";
import { updateSkillStats } from "@/lib/cognitive/skill-manager";
import { assembleAgent, executeAgent } from "@/lib/agent";
import {
  createMissionTools,
  invokeToolDirectly,
  isToolRegistered,
} from "@/lib/agent/tool-registry";
import {
  isLLMSkillRegistered,
  invokeLLMSkillDirectly,
} from "@/lib/agent/llm-skill-dispatch";
import { getLanguageModel } from "@/lib/agent/model-router";
import { generateText } from "ai";
import { loadSkillContent } from "@/lib/skill-loader";
import {
  loadAvailableEmployees,
  buildLeaderDecomposePrompt,
  parseLeaderOutput,
  validateDAG,
  loadDependencyOutputs,
  loadEmployeeMessages,
  buildConsolidatePrompt,
  mapTaskOutputsToStepOutputs,
  checkTokenBudget,
  pickEmployeeForStep,
  resolveStepDomainId,
} from "@/lib/mission-core";
import { loadScenarioLabel } from "@/lib/mission-scenario-label";

const MISSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 分钟

/**
 * Produce a leader "analysis + dispatch" coordination message for the template
 * fast path. Short LLM call (~5-15s, 600 tokens). On failure/timeout we fall
 * back to a structured canned message so users still see per-step dispatch
 * instead of nothing.
 */
async function generateLeaderCoordinationMessage(ctx: {
  missionTitle: string;
  userInstruction: string;
  templateName: string;
  stepDispatch: Array<{ stepName: string; skillName?: string; assigneeName: string }>;
  fallbackCount: number;
  fallbackTeamSize: number;
}): Promise<string> {
  const stepLines = ctx.stepDispatch
    .map((s, i) => {
      const skillHint = s.skillName ? `（调用技能：${s.skillName}）` : "";
      return `  ${i + 1}. ${s.stepName}${skillHint} → ${s.assigneeName}`;
    })
    .join("\n");

  const prompt = `你是"任务总监"（项目管理与协调角色）。刚接到一个使用预设工作流模板的任务，你的职责是对团队用一段话说明：你如何理解这个任务、为什么这样分解、每一步谁来做、整体协作节奏是什么。

# 任务信息
- 标题：${ctx.missionTitle}
- 用户诉求：${ctx.userInstruction}
- 所用工作流模板：${ctx.templateName}

# 本次分解与分派（已按模板 + 成员技能匹配好）
${stepLines}

# 要求
- 用第一人称"我"说话，语气专业、简洁、像真实 PM 在站会上发言
- 200-350 字，一段到两段
- 先说对用户诉求的理解，再说分解思路，最后点名每个关键步骤的承接人（不用 1/2/3 重新列表，自然嵌入句子）
- 不要出现"根据模板"、"按工作流模板预设"这种机械话术
- 不要用 Markdown 标题，不要用列表符号`;

  try {
    const modelName = process.env.OPENAI_MODEL;
    if (!modelName) {
      throw new Error("OPENAI_MODEL 未配置。请在 .env.local 中设置 OPENAI_MODEL=qwen3-max");
    }
    const model = getLanguageModel({
      provider: "openai",
      model: modelName,
      temperature: 0.7,
      maxTokens: 800,
    });
    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 800,
      abortSignal: AbortSignal.timeout(30_000),
    });
    const text = result.text?.trim();
    if (text) return text;
  } catch (err) {
    console.error("[leader-coordination] LLM call failed:", err);
  }

  // Structured fallback — still better than "启动任务（团队 N 人）" since it
  // shows per-step dispatch explicitly.
  return [
    `我接到「${ctx.missionTitle}」，核心诉求：${ctx.userInstruction}`,
    `依据「${ctx.templateName}」模板，本次分解为 ${ctx.fallbackCount} 步，由 ${ctx.fallbackTeamSize} 位同事协作：`,
    stepLines,
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// 1. Leader Planning — decompose mission into tasks
// ---------------------------------------------------------------------------

export async function leaderPlanDirect(
  missionId: string,
  organizationId: string
) {
  // Load the mission
  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
  });
  if (!mission) throw new Error(`Mission not found: ${missionId}`);

  // ─── Pre-populated tasks fast path ──────────────────────────────────────
  // 调用方（如热点深度追踪 startTopicMissionMulti）已经手动构造了 task DAG —
  // 跳过 LLM 分解 / 模板 materialize，直接把 ready task 标出来开始执行。
  // 检测：mission_tasks 已存在 → 信任调用方的 DAG。
  const preExistingTasks = await db
    .select()
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));
  if (preExistingTasks.length > 0) {
    const employeeIds = new Set(
      preExistingTasks
        .map((t) => t.assignedEmployeeId)
        .filter((id): id is string => Boolean(id)),
    );
    // 把 0 依赖的 pending task 标记 ready，让 executor 拾取
    for (const task of preExistingTasks) {
      const deps = (task.dependencies as string[]) || [];
      if (deps.length === 0 && task.status === "pending") {
        await db
          .update(missionTasks)
          .set({ status: "ready" })
          .where(eq(missionTasks.id, task.id));
      }
    }
    await db
      .update(missions)
      .set({ teamMembers: [...employeeIds], status: "executing" })
      .where(eq(missions.id, missionId));
    return {
      taskCount: preExistingTasks.length,
      teamSize: employeeIds.size,
    };
  }

  // Load available employees
  const employeesWithSkills = await loadAvailableEmployees(organizationId);

  // ─── Template fast path ────────────────────────────────────────────────
  // 与 src/inngest/functions/leader-plan.ts 里的同名逻辑保持同步：
  // 当 mission 来自 workflow_templates 且模板有预设 steps[] 时，直接 materialize
  // 步骤到 mission_tasks（跳过 LLM 分解）。
  if (mission.workflowTemplateId) {
    const tpl = await db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.id, mission.workflowTemplateId),
    });
    if (tpl && Array.isArray(tpl.steps) && tpl.steps.length > 0) {
      const sorted = [...(tpl.steps as WorkflowStepDef[])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      const defaultTeamSlugs = (tpl.defaultTeam as string[] | null) ?? [];
      // 领域一等维度（P2）：场景默认领域，节点未覆盖时继承（resolveStepDomainId）。
      const templateDefaultDomainId = (tpl.defaultDomainId as string | null) ?? null;
      const stepIdToTaskId = new Map<string, string>();
      const selectedEmployeeIds = new Set<string>();
      const allTaskAssignments = new Map<string, string>(); // taskId → employeeId

      // 把 mission.inputParams 抽出来准备做 Mustache 渲染（用于下方每个 step
      // 的 config.parameters 绑定展开）。此前的事故：步骤参数是空的，LLM
      // 只能"猜"query，用户输入 CCBN 却被替换成"AI 行业热点"。
      const missionInputsForRender =
        mission.inputParams && typeof mission.inputParams === "object"
          ? (mission.inputParams as Record<string, unknown>)
          : {};

      for (const s of sorted) {
        const effectiveStep = {
          ...s,
          config: {
            ...(s.config ?? {}),
            domainId: resolveStepDomainId(s, templateDefaultDomainId),
          },
        };
        const picked = pickEmployeeForStep(
          effectiveStep,
          defaultTeamSlugs,
          employeesWithSkills,
        );
        const assignedEmployeeId = picked.employee?.id ?? mission.leaderEmployeeId;
        selectedEmployeeIds.add(assignedEmployeeId);

        const skillHint = s.config?.skillName || s.config?.skillSlug;
        const baseDescription =
          s.config?.description ||
          (skillHint ? `${s.name}（使用技能：${skillHint}）` : s.name);

        // 渲染步骤绑定的工具参数 —— 把 {{fieldName}} 占位符换成 mission.inputParams
        // 里的真实值，然后作为"调用参数"块附在 task.description 里供下游 agent 使用。
        const stepParams = (s.config?.parameters ?? {}) as Record<string, unknown>;
        const renderedParams: Record<string, unknown> = {};
        for (const [k, rawV] of Object.entries(stepParams)) {
          if (typeof rawV === "string") {
            // Mustache: {{fieldName}} → inputParams[fieldName]（未知键替换空字符串，
            // 非原始类型 JSON-stringify，保持与 workflow-launch.ts 同规则）
            renderedParams[k] = rawV.replace(/\{\{(\w+)\}\}/g, (_, name) => {
              const v = missionInputsForRender[name];
              if (v === undefined || v === null) return "";
              if (typeof v === "object") return JSON.stringify(v);
              return String(v);
            });
          } else {
            renderedParams[k] = rawV;
          }
        }
        const paramsBlock =
          Object.keys(renderedParams).length > 0
            ? `\n\n【调用参数（必须严格使用这些值调用工具，禁止自行修改）】\n${Object.entries(
                renderedParams,
              )
                .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
                .join("\n")}`
            : "";

        const description = baseDescription + paramsBlock;

        const depTaskIds = (s.dependsOn ?? [])
          .map((stepId) => stepIdToTaskId.get(stepId))
          .filter((v): v is string => !!v);

        const [created] = await db
          .insert(missionTasks)
          .values({
            missionId,
            title: s.name,
            description,
            expectedOutput: null,
            assignedEmployeeId,
            // Persist the step's skillSlug so `executeTaskDirect` can load the
            // matching SKILL.md and inject it into the agent prompt. Without
            // this, the skill signal was stringified into `description` and
            // then lost — agents did a generic generate instead of following
            // the skill's workflow/output schema.
            assignedRole: s.config?.skillSlug ?? null,
            domainFallback: picked.domainFallback ? 1 : 0,
            dependencies: depTaskIds,
            priority: s.order ?? 0,
            status: "pending",
          })
          .returning({ id: missionTasks.id });

        stepIdToTaskId.set(s.id, created.id);
        allTaskAssignments.set(created.id, assignedEmployeeId);
      }

      await db
        .update(missions)
        .set({
          teamMembers: [...selectedEmployeeIds],
          status: "executing",
        })
        .where(eq(missions.id, missionId));

      // Materialize the leader "任务分解与分配" pseudo-task as in_progress so
      // the task board shows 任务总监 actively working while the coordination
      // LLM runs. Pinned to priority=0 so it's the first row.
      //
      // Real tasks stay `pending` until the leader pseudo-task completes —
      // earlier behavior marked zero-dep real tasks `ready` in parallel,
      // which lit up two rows as "执行中" at the same time and made the
      // timeline rail look like work was flowing before the leader even
      // finished planning. The fix is to serialize: leader plans → first
      // real step starts. The 5-15s leader LLM call now blocks the rest of
      // `leaderPlanDirect`, but the caller (`executeMissionDirect`) is
      // already fire-and-forget from the user's perspective (SSE drives the
      // UI), so end-to-end latency is unchanged.
      const [leaderTask] = await db
        .insert(missionTasks)
        .values({
          missionId,
          title: "任务分解与分配",
          description:
            "任务总监根据用户意图与团队成员技能，给出本次工作流的分解思路与分派理由。",
          expectedOutput: null,
          assignedEmployeeId: mission.leaderEmployeeId,
          assignedRole: null,
          dependencies: [],
          priority: 0,
          status: "in_progress",
          progress: 10,
          startedAt: new Date(),
        })
        .returning({ id: missionTasks.id });

      // Run leader coordination synchronously. `generateLeaderCoordinationMessage`
      // already handles LLM failure internally and always resolves with a
      // structured fallback string.
      const leaderDispatchCtx = {
        missionTitle: mission.title,
        userInstruction: mission.userInstruction,
        templateName: tpl.name,
        stepDispatch: sorted.map((s) => {
          const taskId = stepIdToTaskId.get(s.id);
          const assignedId = taskId
            ? allTaskAssignments.get(taskId)
            : mission.leaderEmployeeId;
          const emp = employeesWithSkills.find((e) => e.id === assignedId);
          return {
            stepName: s.name,
            skillName: s.config?.skillName,
            assigneeName: emp?.name ?? "任务总监",
          };
        }),
        fallbackCount: stepIdToTaskId.size,
        fallbackTeamSize: selectedEmployeeIds.size,
      };
      const leaderContent =
        await generateLeaderCoordinationMessage(leaderDispatchCtx);

      await db.insert(missionMessages).values({
        missionId,
        fromEmployeeId: mission.leaderEmployeeId,
        messageType: "coordination",
        content: leaderContent,
      });
      await db
        .update(missionTasks)
        .set({
          status: "completed",
          progress: 100,
          completedAt: new Date(),
          outputData: {
            summary: "任务分解与分配已完成",
            artifacts: [
              {
                id: `leader-coordination-${Date.now()}`,
                type: "generic",
                title: "任务分解与分配",
                content: leaderContent,
              },
            ],
            metrics: { wordCount: leaderContent.length },
            status: "success",
          },
        })
        .where(eq(missionTasks.id, leaderTask.id));

      // Leader is done — promote zero-dependency real tasks to ready so the
      // main loop can pick them up.
      const allTasks = await db
        .select()
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));
      for (const task of allTasks) {
        if (task.id === leaderTask.id) continue;
        const deps = (task.dependencies as string[]) || [];
        if (deps.length === 0 && task.status === "pending") {
          await db
            .update(missionTasks)
            .set({ status: "ready" })
            .where(eq(missionTasks.id, task.id));
        }
      }

      return { taskCount: stepIdToTaskId.size, teamSize: selectedEmployeeIds.size };
    }
  }

  // ─── LLM decompose path (custom / ad-hoc missions without template) ─────

  // Assemble leader agent and decompose
  const agent = await assembleAgent(mission.leaderEmployeeId);

  const prompt = buildLeaderDecomposePrompt(mission, employeesWithSkills);

  const planResult = await executeAgent(
    agent,
    {
      stepKey: "leader-plan",
      stepLabel: "任务分解与分配",
      scenario: await loadScenarioLabel(mission),
      topicTitle: mission.title,
      previousSteps: [],
      userInstructions: prompt,
    },
    undefined, // onProgress
    undefined, // missionTools
    { organizationId, operatorId: mission.leaderEmployeeId ?? undefined },
  );

  // Parse tasks from output — use full artifact content (not summary which truncates to first line)
  const outputText = planResult.output.artifacts?.[0]?.content || planResult.output.summary || "";
  const parsed = parseLeaderOutput(outputText, {
    title: mission.title,
    instruction: mission.userInstruction,
    defaultSlug: employeesWithSkills[0]?.slug || "xiaolei",
  });

  // Validate DAG before inserting
  const dagResult = validateDAG(parsed.tasks);
  if (!dagResult.valid) {
    throw new Error(`任务 DAG 校验失败: ${dagResult.error}`);
  }

  // Create task records
  const taskIds: string[] = [];
  const selectedEmployeeIds = new Set<string>();

  for (let i = 0; i < parsed.tasks.length; i++) {
    const taskDef = parsed.tasks[i];
    const employee = employeesWithSkills.find(
      (e) => e.slug === taskDef.assignedEmployeeSlug
    );
    const employeeId = employee?.id || employeesWithSkills[0]?.id || null;
    if (employeeId) selectedEmployeeIds.add(employeeId);

    const depTaskIds = (taskDef.dependsOn || [])
      .filter((idx) => idx >= 0 && idx < taskIds.length)
      .map((idx) => taskIds[idx]);

    const [created] = await db
      .insert(missionTasks)
      .values({
        missionId,
        title: taskDef.title,
        description: taskDef.description,
        expectedOutput: taskDef.expectedOutput || null,
        assignedEmployeeId: employeeId,
        dependencies: depTaskIds,
        // priority 全系统统一语义 = 步骤序(升序即执行/展示顺序);LLM 计划里的
        // priority 是"重要性",无任何消费方,落库时覆盖为数组序与模板路径对齐。
        priority: taskIds.length + 1,
        status: "pending",
      })
      .returning({ id: missionTasks.id });

    taskIds.push(created.id);
  }

  // Update mission
  await db
    .update(missions)
    .set({
      teamMembers: [...selectedEmployeeIds],
      status: "executing",
      tokensUsed:
        (mission.tokensUsed || 0) +
        planResult.tokensUsed.input +
        planResult.tokensUsed.output,
    })
    .where(eq(missions.id, missionId));

  // Post coordination message
  await db.insert(missionMessages).values({
    missionId,
    fromEmployeeId: mission.leaderEmployeeId,
    messageType: "coordination",
    content: `任务分解完成，共创建 ${taskIds.length} 个子任务，已分配给 ${selectedEmployeeIds.size} 名团队成员。`,
  });

  // Mark zero-dependency tasks as ready
  const allTasks = await db
    .select()
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  for (const task of allTasks) {
    const deps = (task.dependencies as string[]) || [];
    if (deps.length === 0) {
      await db
        .update(missionTasks)
        .set({ status: "ready" })
        .where(eq(missionTasks.id, task.id));
    }
  }

  return { taskCount: taskIds.length, teamSize: selectedEmployeeIds.size };
}

// ---------------------------------------------------------------------------
// 数据型工具的 server 端直出格式化
//
// 当步骤预执行了 web_search / trending_topics 等数据获取工具，我们直接基于
// 工具真实返回值产出"三段式"输出，彻底绕过 LLM。LLM 拿不到这个分支就编不
// 了（训练数据里 CCBN=2024 这类偏见也塞不进来）。
//
// 产出沿用 execution.ts 里约定的【执行摘要】/【执行过程】/【产出结果】三段，
// 保证下游 mission-console UI 不破。
// ---------------------------------------------------------------------------
/**
 * 解 dotted path 取嵌套字段。支持 array index（纯数字段）+ 嵌套对象 key。
 *
 * 例子：
 *   getNestedField({a: {b: [{c: 1}]}}, "a.b.0.c") → 1
 *   getNestedField({created: [{articleId: "x"}]}, "created.0.articleId") → "x"
 *   getNestedField({a: 1}, "a.b") → undefined（解到叶子节点继续访问 → undefined）
 *   getNestedField({a: 1}, "missing") → undefined
 *
 * 返回 undefined 表示路径不可达；调用方负责 fallback。
 */
export function getNestedField(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      // 纯数字字符串 → array index
      if (/^\d+$/.test(part)) {
        current = current[parseInt(part, 10)];
        continue;
      }
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 渲染 step.config.parameters 里的 `{{key}}` 模板。
 *
 * 支持：
 * - `{{key}}` = mission.inputParams[key] (primitive / array / object)
 * - `{{stepN.field}}` = previousSteps[N-1].outputData[field] (1-indexed)
 * - `{{stepN.a.b.0.c}}` = dot-path 嵌套寻址 + 数组下标
 * - 未找到的 key → 替换为空字符串
 *
 * 结果尝试 JSON.parse 字符串值（让 array/object 还原），仅在结果是 object/array 时接受 parse 结果，
 * 否则保留原 string（防止 "30" → 30 number 等不期望的类型变化）。
 *
 * Export 为 module-level 函数主要为单测覆盖。
 */
export function renderStepParameters(
  template: Record<string, unknown>,
  mission: { inputParams: Record<string, unknown> | null | undefined },
  previousSteps: Array<{ outputData?: unknown }>,
): Record<string, unknown> {
  const src = mission.inputParams ?? {};
  const rendered: Record<string, unknown> = {};
  // 同一次渲染内对相同未解析路径只打一次 warning，避免循环内 N 个引用刷屏
  const warnedPaths = new Set<string>();
  for (const [k, rawV] of Object.entries(template)) {
    if (typeof rawV !== "string") {
      rendered[k] = rawV;
      continue;
    }
    const replaced = rawV.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
      const trimmedExpr = expr.trim();
      const stepMatch = trimmedExpr.match(/^step(\d+)\.(.+)$/);
      if (stepMatch) {
        const stepIdx = parseInt(stepMatch[1], 10) - 1;
        const field = stepMatch[2];
        const stepOutput = previousSteps[stepIdx]?.outputData;
        const v = getNestedField(stepOutput, field);
        if (v === undefined || v === null) {
          // 路径解不通：fallback 空串，同时打 warning 让运营 debug 时能看到
          const pathKey = `step${stepMatch[1]}.${field}`;
          if (!warnedPaths.has(pathKey)) {
            warnedPaths.add(pathKey);
            console.warn(
              `[mission-executor] 模板路径未解析：{{${pathKey}}} → 空串。stepOutput keys: ${
                stepOutput && typeof stepOutput === "object"
                  ? Object.keys(stepOutput as Record<string, unknown>).join(", ")
                  : "(non-object or null)"
              }`,
            );
          }
          return "";
        }
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      }
      const v = src[trimmedExpr];
      if (v === undefined || v === null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    });
    try {
      const parsed = JSON.parse(replaced);
      if (typeof parsed === "object" && parsed !== null) {
        rendered[k] = parsed;
        continue;
      }
    } catch {
      // primitive or non-JSON → keep replaced string
    }
    rendered[k] = replaced;
  }
  return rendered;
}

export function parseCallParamsFromTaskDescription(
  description: string | null | undefined,
): Record<string, unknown> {
  if (!description) return {};
  const markerIndex = description.indexOf("【调用参数");
  if (markerIndex < 0) return {};
  const lines = description.slice(markerIndex).split(/\r?\n/).slice(1);
  const params: Record<string, unknown> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("【")) break;
    const match = trimmed.match(/^-\s*([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    try {
      params[key] = JSON.parse(rawValue);
    } catch {
      params[key] = rawValue;
    }
  }
  return params;
}

const AGENT_FALLBACK_COMPATIBLE_REGISTERED_TOOLS = new Set([
  "content_generate",
]);

export function shouldBlockRegisteredSkillFallback(input: {
  assignedRole: string | null | undefined;
  preExecAttempted: boolean;
  preExecUsedTool: boolean;
}): boolean {
  const role = input.assignedRole;
  if (!role || input.preExecUsedTool) return false;
  if (!isToolRegistered(role) && !isLLMSkillRegistered(role)) return false;
  if (input.preExecAttempted) return true;
  return !AGENT_FALLBACK_COMPATIBLE_REGISTERED_TOOLS.has(role);
}

export function formatRegisteredSkillFallbackFailure(
  assignedRole: string | null | undefined,
  preExecError?: string | null,
): string {
  const role = assignedRole ?? "unknown";
  const detail = preExecError?.trim()
    ? `真实错误：${preExecError.trim()}`
    : "可能原因:1) 工具参数被 zod 拒绝(检查上游 step 是否产出空数据 / 字段名不匹配);2) 工具实现内部 throw(检查环境变量 / 网络 / 配额);3) workflowTemplateId 缺失或 step 参数未绑定。详见 server 日志。";
  return `工具/skill \`${role}\` 短路执行失败,拒绝降级到 LLM 编故事路径。${detail}`;
}

export function shouldForceInjectWorkflowTool(
  assignedRole: string | null | undefined,
): boolean {
  if (!assignedRole) return false;
  if (AGENT_FALLBACK_COMPATIBLE_REGISTERED_TOOLS.has(assignedRole)) {
    return false;
  }
  return isToolRegistered(assignedRole);
}

export function shouldUseStrictToolEnforcement(
  assignedRole: string | null | undefined,
  preExecUsedTool: boolean,
): boolean {
  if (!assignedRole || preExecUsedTool) return false;
  if (AGENT_FALLBACK_COMPATIBLE_REGISTERED_TOOLS.has(assignedRole)) {
    return false;
  }
  return isToolRegistered(assignedRole) || isLLMSkillRegistered(assignedRole);
}

export function buildImplicitTrendingTopicsParams(
  missionTitle: string,
  missionInputParams: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const city =
    typeof missionInputParams?.city === "string"
      ? missionInputParams.city.trim()
      : "";
  const explicitQuery =
    city ||
    (typeof missionInputParams?.topic === "string"
      ? missionInputParams.topic.trim()
      : "") ||
    (typeof missionInputParams?.query === "string"
      ? missionInputParams.query.trim()
      : "");
  const titleCity = missionTitle.match(/[（(]([\u3400-\u9fff]{2,12})[）)]/)?.[1] ?? "";
  const query = explicitQuery || titleCity;

  if (query) {
    return { mode: "search", query, limit: 20 };
  }
  return { mode: "hot", limit: 20 };
}

/**
 * 2026-05-29 — 第三道防线:LLM agent 跑完后,扫描其输出文本是否含明显失败信号。
 *
 * 前置:短路分支 (mission-executor.ts:1018) 和 registered-tool guard
 * (mission-executor.ts:1144) 理论上应该把所有"工具失败"场景挡在 LLM 之前。
 * 但运行中观察到:某些 mission(尤其 leader 直接接管的写入步骤)绕过这两道防线
 * 跑到 executeAgent —— 然后:
 *   案例 A:LLM 编故事说成功(假 ID / 假 org)—— UI 显示绿色✓但实际没入库
 *   案例 B:LLM 诚实承认失败 —— 但 task.status 仍被无脑设为 completed
 *
 * 本函数兜底处理两类:扫 outputData 的 text/summary 字段,匹配中英常见失败指纹。
 * 命中即让 caller 把 task.status 设为 failed,不再被 LLM 报喜不报忧误导用户。
 *
 * 注:这是宁可错杀的兜底 —— 误判风险存在(LLM 在成功输出里恰好提到"missing_context"
 * 当作教学例子)。预期场景下 SKILL.md 不应包含这种关键词,所以误判极少。
 */
/**
 * 2026-05-30 — 第四道防线:工具返回 success:true 但 IO 中含上游兜底/失败痕迹时,
 * 也要把 step 标记为 failed。
 *
 * 经典案例:
 *   - cross_language_rewrite 对部分 article LLM 失败,fallback 用
 *     `[NEEDS REVIEW] xxx` 标题 + "LLM did not return a rewrite" 正文
 *   - 下游 archive_to_drafts 收到这些条目,INSERT 成功(success:true),
 *     但插入的稿件全是 NEEDS REVIEW 垃圾内容
 *   - 旧逻辑:step 标 completed → 用户看到绿色✓,以为没事
 *   - 新逻辑:扫 params + result 找上游兜底痕迹 → 标 failed
 *
 * 扫描对象:
 *   - preExecParams(传给工具的入参):捕获"垃圾输入"
 *   - preExecResult(工具返回值):捕获"垃圾输入透传到输出"
 *
 * 用 JSON.stringify 简单序列化扫描 —— 性能足够(单 step 调用一次,
 * 截到 16 KB 内),pattern 必须精确(避免合法描述误中)。
 */
/**
 * 写入型工具白名单 —— 这类工具的成功语义 = "至少写了 1 条业务行"。
 * 如果 totalCreated === 0(无论 totalRequested 是 0 还是 N),通常视为本步骤
 * 实际没干活,标 failed。archive_to_drafts 的纯 sourceUrl 去重命中例外:
 * 这表示稿件库里已有可复用稿件,应继续把 existingArticleId 交给下游发布。
 *
 * 例如 archive_to_drafts 在 items=[] 时返回 {success:true, totalCreated:0,
 * note:"上游 cross_language_rewrite 产出 0 条..."} —— 旧逻辑认为成功,
 * 但用户的预期是"这步要入库 N 条稿件",0 条 = 任务没完成。
 */
const WRITE_TYPE_TOOLS = new Set([
  "archive_to_drafts",
  "cms_publish",
  "cms_batch_publish",
]);

export function isArchiveDedupOnlyResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as {
    success?: unknown;
    totalRequested?: unknown;
    totalCreated?: unknown;
    totalSkipped?: unknown;
    skipped?: unknown;
    created?: unknown;
    articles?: unknown;
  };
  if (r.success === false) return false;
  if (
    typeof r.totalRequested !== "number" ||
    typeof r.totalCreated !== "number" ||
    typeof r.totalSkipped !== "number"
  ) {
    return false;
  }
  if (r.totalRequested <= 0 || r.totalCreated !== 0) return false;
  if (r.totalSkipped !== r.totalRequested) return false;
  if (!Array.isArray(r.skipped) || r.skipped.length !== r.totalRequested) {
    return false;
  }
  const allDuplicateWithExistingId = r.skipped.every((item) => {
    if (!item || typeof item !== "object") return false;
    const skipped = item as { reason?: unknown; existingArticleId?: unknown };
    return (
      skipped.reason === "duplicate_source_url" &&
      typeof skipped.existingArticleId === "string" &&
      skipped.existingArticleId.length > 0
    );
  });
  if (!allDuplicateWithExistingId) return false;

  const available = Array.isArray(r.created)
    ? r.created
    : Array.isArray(r.articles)
      ? r.articles
      : [];
  return available.length > 0;
}

function detectIOContamination(
  params: Record<string, unknown> | null | undefined,
  result: unknown,
  toolName?: string | null,
): { contaminated: boolean; pattern?: string; sample?: string } {
  const slices: string[] = [];
  try {
    if (params) slices.push(JSON.stringify(params).slice(0, 16000));
  } catch {
    /* ignore stringify failure(circular ref 等),跳过该 slice */
  }
  try {
    if (result) slices.push(JSON.stringify(result).slice(0, 16000));
  } catch {
    /* ignore */
  }
  const haystack = slices.join("\n");
  if (!haystack) return { contaminated: false };

  // 精确指纹 —— 必须是已知的 fallback 标记或工具内部错误透传,不允许误中
  // 普通业务文本(如 SKILL.md 描述、新闻标题等)
  const patterns: Array<{ name: string; re: RegExp }> = [
    { name: "needs_review_fallback", re: /\[\s*NEEDS\s*REVIEW\s*\]/i },
    { name: "llm_no_rewrite", re: /LLM\s+did\s+not\s+return\s+a\s+rewrite/i },
    { name: "fetch_status_failed", re: /"fetchStatus"\s*:\s*"(fail|failed|error|timeout)"/i },
    { name: "fallback_marker", re: /"fallback"\s*:\s*true/ },
    { name: "explicit_error_field", re: /"error"\s*:\s*\{[^}]*"code"/ },
    { name: "translation_failure_zh", re: /该条\s*LLM\s*调用失败/ },
    { name: "skipped_with_reason", re: /"skipped"\s*:\s*\[[^\]]*"reason"\s*:\s*"(error|failed|timeout)/i },
  ];
  for (const p of patterns) {
    const m = haystack.match(p.re);
    if (m) {
      const idx = haystack.indexOf(m[0]);
      const sample = haystack
        .slice(Math.max(0, idx - 30), Math.min(haystack.length, idx + 90))
        .replace(/\s+/g, " ")
        .trim();
      return { contaminated: true, pattern: p.name, sample };
    }
  }

  // ─── 写入型工具的"实际没写"检测 ───
  // archive_to_drafts / cms_publish 等:若 result.totalCreated === 0,
  // 通常表示"本步骤实际没产生任何业务行" → 失败。纯去重命中且已有
  // articleId 可用时例外,否则重跑同一批热榜会被误杀。
  if (toolName && WRITE_TYPE_TOOLS.has(toolName) && result && typeof result === "object") {
    if (toolName === "archive_to_drafts" && isArchiveDedupOnlyResult(result)) {
      return { contaminated: false };
    }
    // 兼容两种写入工具的计数字段命名:
    // - archive_to_drafts / cms_publish:返回 totalCreated
    // - cms_batch_publish:返回 totalPublished
    const r = result as {
      totalCreated?: unknown;
      totalPublished?: unknown;
      totalRequested?: unknown;
      note?: unknown;
    };
    const writeCount =
      typeof r.totalCreated === "number"
        ? r.totalCreated
        : typeof r.totalPublished === "number"
          ? r.totalPublished
          : null;
    if (writeCount === 0) {
      const totalReq =
        typeof r.totalRequested === "number" ? r.totalRequested : undefined;
      const note = typeof r.note === "string" ? r.note : "";
      const reason =
        totalReq === 0
          ? "上游产出 0 条入参,实际没写任何数据"
          : `请求 ${totalReq ?? "未知"} 条但实际写入 0 条(全被跳过或失败)`;
      return {
        contaminated: true,
        pattern: `write_tool_zero_created:${toolName}`,
        sample: note ? `${reason}。工具 note:${note.slice(0, 150)}` : reason,
      };
    }
  }

  return { contaminated: false };
}

function detectAgentOutputFailure(output: unknown): {
  failed: boolean;
  pattern?: string;
  excerpt?: string;
} {
  if (!output || typeof output !== "object") return { failed: false };

  // ─── Phase 2 fix:优先尊重 executeAgent 显式设置的 status=failed ───────────
  // executeAgent 在 onStepFinish 里扫到工具 success=false 时,会把 output.status
  // 覆盖为 "failed" 并填 errorMessage / errorCode。如果不在这里识别,后续的
  // text/summary regex 兜底有可能漏掉(LLM 没在叙述里复述失败),导致 task 仍
  // 被标 completed。优先看 executeAgent 给出的明确信号,regex 退化为 fallback。
  const statusObj = output as {
    status?: unknown;
    errorMessage?: unknown;
    errorCode?: unknown;
  };
  if (statusObj.status === "failed") {
    const msg =
      typeof statusObj.errorMessage === "string" && statusObj.errorMessage.trim()
        ? statusObj.errorMessage
        : typeof statusObj.errorCode === "string" && statusObj.errorCode.trim()
          ? `errorCode=${statusObj.errorCode}`
          : "executeAgent 标记 status=failed";
    return {
      failed: true,
      pattern: "agent_status_failed",
      excerpt: msg.slice(0, 200),
    };
  }

  // 2026-05-30:扩到扫 artifacts[*].content。
  // 背景:parseStepOutput 把 LLM 全文塞 artifacts[0].content,summary 只取第一行
  // (通常是【执行摘要】标题,没具体失败词)。之前只扫 text/summary 经常漏 ——
  // 例如 cms_publish 的 "❌ CMS入库失败 / 错误代码 cms_network / fetch failed"
  // 全在 artifacts[0].content 里,task 被错标 completed。
  const o = output as {
    text?: unknown;
    summary?: unknown;
    artifacts?: unknown;
  };
  const parts: string[] = [];
  if (typeof o.text === "string") parts.push(o.text);
  if (typeof o.summary === "string") parts.push(o.summary);
  if (Array.isArray(o.artifacts)) {
    for (const a of o.artifacts) {
      if (a && typeof a === "object") {
        const c = (a as { content?: unknown }).content;
        if (typeof c === "string") parts.push(c);
      }
    }
  }
  const haystack = parts
    .filter(Boolean)
    .join("\n")
    .slice(0, 16000); // 加倍上限,artifacts 可能很长
  if (!haystack) return { failed: false };

  // 工具/系统级失败指纹 —— 必须是"被工具或系统报错"才视为失败,
  // 不能把 SKILL.md 里描述失败场景的教学语误判。
  const patterns: Array<{ name: string; re: RegExp }> = [
    { name: "missing_context", re: /missing[_ ]context/i },
    { name: "tool_error_code", re: /错误代码["'：:]?\s*['"`]?(missing_context|tool_error|forbidden|unauthorized|cms_network|cms_business|cms_schema|cms_auth)/i },
    { name: "explicit_failed_status", re: /状态["'：:]?\s*['"`]?(失败|failed)["'`]?/i },
    { name: "structured_success_false", re: /"success"\s*:\s*false/ },
    { name: "operation_failed_zh", re: /(任务|操作|入库|调用|工具|步骤|CMS)\s*(未能完成|失败|无法完成|被拒绝|网络错误)/ },
    // 2026-05-30 — 用户截图实测漏掉的 pattern:
    // cms_publish 失败时输出 "❌ CMS入库失败！" + "错误阶段 network" + "fetch failed"
    { name: "error_stage_field", re: /错误阶段\s*(network|business|schema|auth|fetch|timeout)/i },
    { name: "fetch_failed", re: /fetch\s+failed/i },
    { name: "explicit_failure_emoji", re: /❌\s*[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z\s]{0,30}(失败|错误|出错|fail|error)/i },
  ];
  for (const p of patterns) {
    const m = haystack.match(p.re);
    if (m) {
      const idx = haystack.indexOf(m[0]);
      const excerpt = haystack
        .slice(Math.max(0, idx - 40), Math.min(haystack.length, idx + 120))
        .replace(/\s+/g, " ")
        .trim();
      return { failed: true, pattern: p.name, excerpt };
    }
  }
  return { failed: false };
}

function formatPreExecOutputDeterministic(opts: {
  toolName: string;
  params: Record<string, unknown>;
  isEmpty: boolean;
  rawResultBlock: string;
}): string {
  const { toolName, params, isEmpty, rawResultBlock } = opts;
  const paramsLine = Object.entries(params)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");

  if (isEmpty) {
    return `【执行摘要】工具 \`${toolName}\` 已在 server 端真实调用（参数：${paramsLine}），返回 **0 条** 结果。

【执行过程】
1. 使用步骤绑定参数直接调用 \`${toolName}\`：${paramsLine}
2. 工具真实返回 results=[]（未命中）
3. 本步骤未进入 LLM 生成 —— server 已拦截，避免训练数据里的旧内容被当作真实结果输出

【产出结果】
无命中结果。建议：
- 若 timeRange 绑定为 "24h"，改为 "7d" 或 "30d"
- 若关键词过窄，尝试更通用表达或加上中文全称
- 确认启动表单字段名与步骤参数绑定的占位符一致

【质量自评：60/100】
真实数据为空，输出为系统确定性响应。`;
  }

  // 非空 —— rawResultBlock 里已经带了工具返回的 JSON。直接把它展示给用户，
  // 不做任何排序/筛选/摘要（那些本来是 LLM 的职责，但 LLM 现在被拉黑了）。
  return `【执行摘要】工具 \`${toolName}\` 已在 server 端真实调用（参数：${paramsLine}），返回值如下所示。本步骤完全跳过 LLM 以防止幻觉。

【执行过程】
1. 使用步骤绑定参数直接调用 \`${toolName}\`：${paramsLine}
2. 接收工具原始返回值（真实数据，未经任何 LLM 润色/扩展/编造）
3. 由 server 直接将返回值序列化为下方【产出结果】—— 不做关键词扩展、不做摘要重写

${rawResultBlock}

【质量自评：85/100】
真实数据直出，保证来源、日期、标题、URL 100% 原样，下游任务（如排序、摘要、改写）请在后续 LLM 步骤中基于这些真实数据进行。`;
}

// ---------------------------------------------------------------------------
// 2. Execute a single ready task
// ---------------------------------------------------------------------------

async function executeTaskDirect(
  taskId: string,
  missionId: string,
  /** Pre-loaded mission to avoid redundant queries in parallel execution */
  cachedMission?: {
    id: string;
    organizationId: string;
    scenario: string;
    title: string;
    tokenBudget: number;
    tokensUsed: number;
    leaderEmployeeId: string;
    workflowTemplateId: string | null;
    /**
     * The rendered prompt template (from workflow_templates.promptTemplate)
     * or the fallback scenario-name + param dump. Must reach every step's
     * agent so LLMs know the actual user ask instead of hallucinating from
     * a bare skill slug. See comments on `userInstructions` below.
     */
    userInstruction: string;
    /**
     * Workflow input fields the user filled on launch (e.g. topic=CCBN,
     * count=2). Injected verbatim as a structured block in every step's
     * userInstructions — fixes the "web_search searches '2' instead of
     * 'CCBN'" class of bugs where the step LLM has no access to these.
     */
    inputParams: Record<string, unknown> | null;
  },
) {
  // Batch pre-execution reads: task + mission (if not cached) + deps + messages
  const task = await db.query.missionTasks.findFirst({ where: eq(missionTasks.id, taskId) });
  if (!task || task.status !== "ready") return null;

  const mission = cachedMission ?? await db.query.missions.findFirst({ where: eq(missions.id, missionId) });
  if (!mission) throw new Error(`Mission not found: ${missionId}`);

  // Token budget check
  const budget = checkTokenBudget(mission as Parameters<typeof checkTokenBudget>[0]);
  if (!budget.allowed) {
    await db.update(missionTasks).set({ status: "failed", errorMessage: "Token 预算已耗尽" }).where(eq(missionTasks.id, taskId));
    return { status: "failed" as const, taskId, error: "Token budget exceeded" };
  }

  // Batch: mark in_progress + update employee + load deps + load messages in parallel
  const deps = (task.dependencies as string[]) || [];
  const [, , previousSteps, employeeMessages] = await Promise.all([
    db.update(missionTasks).set({ status: "in_progress", startedAt: new Date() }).where(eq(missionTasks.id, taskId)),
    task.assignedEmployeeId
      ? db.update(aiEmployees).set({ status: "working", currentTask: `正在执行「${task.title}」` }).where(eq(aiEmployees.id, task.assignedEmployeeId))
      : Promise.resolve(),
    loadDependencyOutputs(deps),
    task.assignedEmployeeId ? loadEmployeeMessages(missionId, task.assignedEmployeeId) : Promise.resolve(""),
  ]);

  try {
    if (!task.assignedEmployeeId) {
      throw new Error(`Task ${taskId} has no assigned employee`);
    }

    const agent = await assembleAgent(task.assignedEmployeeId);

    // Create mission collaboration tools for this agent
    const missionTools = createMissionTools({
      missionId,
      employeeId: task.assignedEmployeeId,
      employeeSlug: agent.slug,
      isLeader: agent.slug === "leader",
    });

    // If this task was materialized from a workflow template step,
    // `assignedRole` holds the skillSlug. Load the SKILL.md body and pass it
    // as `skillSpec` so executeAgent pins it into the system prompt — that's
    // the only position strong enough to force the LLM to follow the skill's
    // workflow + output schema. Putting it in userInstructions did not work:
    // outputs were still one-liners like "周度热点聚合结果" because the body
    // landed under the "用户附加指示" section, far from the system contract.
    const skillBody = task.assignedRole ? loadSkillContent(task.assignedRole) : null;

    // 工作流步骤强制绑定的技能工具：`task.assignedRole` = 步骤必须执行的 skillSlug。
    // 若被分派的员工（常见于兜底到 leader 任务总监）没有预先绑定该技能，
    // `agent.tools` 里就不会包含对应工具，LLM 拿不到工具调用权限，只能按
    // 输出格式"幻觉"出一段看似真实的结果（已出现过 web_search 没被调用、
    // LLM 编造 OpenAI/苹果假新闻的事故）。
    // 这里仅将真实工具主动注入 agent.tools，确保工具型步骤始终可用 ——
    // 生成型 skill（如 content_generate）依赖 SKILL.md 合同，不注入同名 helper tool。
    const workflowToolSlug = task.assignedRole;
    if (
      workflowToolSlug &&
      shouldForceInjectWorkflowTool(workflowToolSlug) &&
      !agent.tools.some((t) => t.name === workflowToolSlug)
    ) {
      agent.tools = [
        ...agent.tools,
        {
          name: workflowToolSlug,
          description: `工作流指定的执行技能：${task.title}`,
          parameters: {},
        },
      ];
    }

    // 把工作流层的上下文（用户表单参数 + 渲染后的 promptTemplate）加到每步
    // 指令里 —— 否则第一步的 LLM 看不到 "topic=CCBN, count=2" 这样的用户输入，
    // 会从步骤描述里的数字/关键词瞎猜，导致 web_search("2") 这类翻车。
    const missionInputParams =
      mission.inputParams && typeof mission.inputParams === "object"
        ? (mission.inputParams as Record<string, unknown>)
        : null;
    const inputParamsBlock =
      missionInputParams && Object.keys(missionInputParams).length > 0
        ? `【工作流输入参数】\n${Object.entries(missionInputParams)
            .map(
              ([k, v]) =>
                `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
            )
            .join("\n")}`
        : "";
    const missionInstructionBlock = mission.userInstruction
      ? `【本次工作流任务】\n${mission.userInstruction}`
      : "";

    // ── 工具预执行（server-side pre-fetch）─────────────────────────────────
    // 事故背景：LLM 即使拿到 SKILL.md + 工具 + 强指令，仍会"假装调用工具"，
    // 按输出模板凭空编造结果（观察到：输入 "CCBN" 产出假的 GPT-4o / WWDC / 暴雨
    // 预警新闻，带假来源、假时间、假热度）。根因是 DeepSeek 这类开源模型在
    // instruction-following 上的薄弱——再多的 prompt 也压不住它的"输出模板幻觉"。
    //
    // 解法：当步骤在编辑器里绑定了参数（step.config.parameters），我们**在 server
    // 端直接调用工具**，把真实结果塞给 LLM 做后续排序/摘要。LLM 看到真实数据后
    // 无法再伪造（因为它无法在原始数据之外凭空变出条目）。
    //
    // 运行条件：mission.workflowTemplateId 存在 + 匹配得到 step + step 绑定了参数 +
    // task.assignedRole 对应 ALL_TOOLS 里已注册的工具。
    let preExecResultBlock = "";
    let preExecUsedTool = false;
    let preExecAttempted = false;
    let preExecEmpty = false; // 预执行跑完且结果为 0 条 —— 触发 LLM 跳过路径
    let preExecParams: Record<string, unknown> = {};
    let preExecError: string | null = null;
    // 保留 invocation.result 到外层 scope —— deterministicOutput 在 short-circuit
    // 分支需要把它 spread 进 outputData，让 {{stepN.field}} 模板能引用工具/skill
    // 真实返回的结构化字段（topics / results / articles 等）。
    let preExecResult: unknown = null;
    if (task.assignedRole) {
      try {
        const tpl = mission.workflowTemplateId
          ? await db.query.workflowTemplates.findFirst({
              where: eq(workflowTemplates.id, mission.workflowTemplateId),
            })
          : null;
        const tplSteps = (tpl?.steps ?? []) as WorkflowStepDef[];
        // 用 priority (===step.order) + skillSlug 双重匹配，避免重名步骤误匹配
        const matchedStep = tplSteps.find(
          (s) =>
            (s.order ?? 0) === (task.priority ?? 0) &&
            s.config?.skillSlug === task.assignedRole,
        );
        let rawParams = (matchedStep?.config?.parameters ?? {}) as Record<
          string,
          unknown
        >;
        if (Object.keys(rawParams).length === 0) {
          rawParams = parseCallParamsFromTaskDescription(task.description);
        }

        // ── Auto-bind fallback for retrieval-intent steps ──────────────
        // 观察到的事故：seed 里所有 step.config.parameters={}，导致下方
        // `if (Object.keys(rawParams).length > 0)` 永远不过，预执行永远
        // 不触发。LLM 看到 news_aggregation / trend_monitor 等"假工具"
        // （tool-registry ALL_TOOLS 未注册，resolveTools 兜底给个占位
        // execute）返回 `[xxx] 已完成处理`，就按 SKILL.md 模板 + 训练
        // 数据编时间和来源（见 mission 98be5b76，出现 04-23 10:30 这
        // 种未来时间幻觉）。
        //
        // 解法：当 step 有 skillSlug 但 parameters 为空，且 skill 属于
        // "需要真实外部数据"的检索意图类，server 端自动构造 web_search
        // 参数（query=mission.title + inputParams 值，timeRange 按语义
        // 推断），真调 Tavily。其它类型 skill 保持原逻辑不动。
        const RETRIEVAL_INTENT_SLUGS_MISSION = new Set([
          "news_aggregation",
          "trend_monitor",
          "social_listening",
          "heat_scoring",
          "competitor_analysis",
          "sentiment_analysis",
          "knowledge_retrieval",
          "case_reference",
          "media_search",
          "fact_check",
        ]);
        let autoBound = false;
        if (
          Object.keys(rawParams).length === 0 &&
          task.assignedRole &&
          RETRIEVAL_INTENT_SLUGS_MISSION.has(task.assignedRole)
        ) {
          const inputValues = missionInputParams
            ? Object.values(missionInputParams)
                .filter((v) => v !== null && v !== undefined && v !== "")
                .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
            : [];
          const queryParts = [mission.title, ...inputValues].filter(Boolean);
          const query = queryParts.join(" ").trim();
          if (query) {
            // 时间窗推断（和 chat 路径对齐）
            const msg = `${mission.title} ${inputValues.join(" ")}`;
            let timeRange: "24h" | "7d" | "30d" | undefined;
            if (/今日|每日|今天|daily|实时|breaking/i.test(msg)) timeRange = "24h";
            else if (/本周|最近一周|weekly/i.test(msg)) timeRange = "7d";
            else if (/本月|近一月|monthly/i.test(msg)) timeRange = "30d";
            // 统一降级到 web_search 真调 —— Tavily 是最通用的实时检索通道
            rawParams = {
              query,
              maxResults: 8,
              topic: "news",
              ...(timeRange ? { timeRange } : {}),
            };
            autoBound = true;
            console.log(
              `[mission-executor] auto-bound web_search for ${task.assignedRole}`,
              { query, timeRange, missionId, taskId },
            );
          }
        }

        if (Object.keys(rawParams).length === 0 && task.assignedRole === "trending_topics") {
          rawParams = buildImplicitTrendingTopicsParams(
            mission.title,
            missionInputParams,
          );
          autoBound = true;
          console.log(
            "[mission-executor] auto-bound trending_topics",
            { params: rawParams, missionId, taskId },
          );
        }

        // 预执行触发：显式绑定了参数，或 auto-bind 生效
        if (Object.keys(rawParams).length > 0) {
          preExecAttempted = true;
          // 渲染 step.config.parameters 模板（支持 {{key}} 和 {{stepN.field}}）
          //
          // 关键约定：`{{stepN.X}}` 的 N 是 **step.order**（即 task.priority），
          // 不是 dependencies 数组的 index。线性 pipeline step 1→2→3→4 里 step 3
          // 只 dep step 2 (deps array length=1)，但 paramConfig 写 {{step2.X}}
          // 时，N=2 应该指 step.order=2 不是 deps[1]（undefined）。
          //
          // 修复（事故 2026-05-27 重现 + 修）：之前 `previousSteps.map((s,i)=>({outputData:s}))`
          // 让 N 跟着 deps 顺序，step 3 `{{step2.results}}` → previousSteps[1] = undefined →
          // renderStepParameters fallback 空字符串 → dispatch.execute 收到 articles="" →
          // rawArticles.filter throw "not a function" → invocation.ok=false → LLM 兜底 +
          // 越权 web_search 编 fake digest。
          //
          // 改：额外 query 所有 priority < task.priority 且 completed 的 upstream task，
          // 按 priority 索引 pad previousStepsForRender（如 step 3 时 previousStepsForRender[0]
          // = step 1 output, [1] = step 2 output），让 {{stepN.X}} 总能按 step order 引用。
          const allUpstream = task.priority != null
            ? await db
                .select({ id: missionTasks.id, priority: missionTasks.priority })
                .from(missionTasks)
                .where(
                  and(
                    eq(missionTasks.missionId, missionId),
                    lt(missionTasks.priority, task.priority),
                    eq(missionTasks.status, "completed"),
                  ),
                )
            : [];
          const upstreamIds = allUpstream.map((t) => t.id).filter((id): id is string => !!id);
          const upstreamOutputs = upstreamIds.length > 0
            ? await loadDependencyOutputs(upstreamIds)
            : [];

          const previousStepsForRender: Array<{ outputData?: unknown }> = [];
          allUpstream.forEach((upTask) => {
            if (upTask.priority == null) return;
            const out = upstreamOutputs.find((s) => s.stepKey === upTask.id);
            if (out) {
              previousStepsForRender[upTask.priority - 1] = { outputData: out };
            }
          });
          // 兜底：若该 query 没拿到（例如本步骤是 step 1 / 无 upstream），保留旧的
          // deps-based wrapping 跟原始 previousSteps 兼容
          if (previousStepsForRender.length === 0) {
            previousSteps.forEach((s, i) => {
              previousStepsForRender[i] = { outputData: s };
            });
          }
          const rendered = renderStepParameters(
            rawParams,
            { inputParams: missionInputParams ?? null },
            previousStepsForRender,
          );
          // 直接调用工具或 LLM-skill
          // 工具走 invokeToolDirectly（注入 org/operator 上下文）；
          // LLM-skill（topic_classifier / cross_language_rewrite）走 invokeLLMSkillDirectly。
          let invocation: Awaited<ReturnType<typeof invokeToolDirectly>>;
          if (isLLMSkillRegistered(task.assignedRole)) {
            invocation = await invokeLLMSkillDirectly(task.assignedRole, rendered);
          } else {
            invocation = await invokeToolDirectly(
              task.assignedRole,
              rendered,
              {
                organizationId: mission.organizationId ?? undefined,
                operatorId: task.assignedEmployeeId ?? undefined,
                missionId,
                taskId,
              },
            );
          }
          void autoBound; // 记录用 —— tool 实现里会利用同一 query 参数
          preExecParams = rendered;
          if (invocation.ok) {
            preExecUsedTool = true;
            preExecResult = invocation.result;
            const serialized = JSON.stringify(invocation.result, null, 2);
            // 过长会吃掉上下文预算；截断到 8000 字符（上游 skillSpec + SKILL.md
            // 已占位，这里保守一点）。
            const truncated =
              serialized.length > 8000
                ? serialized.slice(0, 8000) +
                  "\n... (tool 结果过长已截断，如需完整数据请下调 maxResults 再跑)"
                : serialized;
            // 对 web_search / news_aggregation 这类返回列表的工具，额外探测
            // 结果条数 —— 为空时给出强提示，防止 LLM 从训练数据里补填旧内容
            // （观察过的事故：用户搜 "CCBN"@24h，Tavily 实际返回 0 条，LLM
            // 却给出 2024-03 的假文章）。
            let resultCountHint = "";
            // 检测空结果：工具/skill 可能用 results / articles / topics 等不同字段名，
            // 任一为空数组都视为"无数据"触发 preExecEmpty。
            // 历史教训：之前只看 results，导致 cross_language_rewrite 返回 {articles:[]}
            // 时 preExecEmpty 没设、short-circuit 也没跳过 LLM、LLM 越权调 web_search 补料。
            const resultObj = invocation.result as
              | { results?: unknown[]; articles?: unknown[]; topics?: unknown[] }
              | null;
            const listFields: Array<["results" | "articles" | "topics"]> = [
              ["results"],
              ["articles"],
              ["topics"],
            ];
            let listLen: number | null = null;
            let listFieldName: string | null = null;
            if (resultObj && typeof resultObj === "object") {
              for (const [field] of listFields) {
                const v = resultObj[field];
                if (Array.isArray(v)) {
                  listLen = v.length;
                  listFieldName = field;
                  break;
                }
              }
            }
            if (listLen !== null) {
              if (listLen === 0) {
                // 标记为空 —— 后面会跳过 LLM，直接写确定性输出。
                // 这是经验教训：反复试过加强 LLM 指令都没用，DeepSeek 拿到"空
                // 结果"还是会按 SKILL.md 模板凭空编内容。唯一可靠方法是根本
                // 不让它碰这种情况。
                preExecEmpty = true;
                resultCountHint = `\n\n⚠️ 真实结果 ${listFieldName} 字段为空（0 条）。你必须如实报告"无命中结果"，并建议用户调整 timeRange / 关键词 / 上游 step 参数。**严禁从训练数据里补填任何文章、日期、数据、引用** —— 这是伪造。`;
              } else if (listLen <= 2) {
                resultCountHint = `\n\n⚠️ 真实结果 ${listFieldName} 字段仅 ${listLen} 条。只在这 ${listLen} 条内做处理；不得从训练数据里补充任何其他条目（包括你"记得"的该话题相关新闻）。日期、标题、来源、数据点必须 1:1 引用结果里的字段，不得改写。`;
              }
            }
            preExecResultBlock = `【前置工具调用结果（已在 server 端执行，这是真实数据）】\n调用：\`${invocation.toolName}(${JSON.stringify(
              invocation.params,
            )})\`\n\n结果：\n\`\`\`json\n${truncated}\n\`\`\`${resultCountHint}`;
            console.log(
              `[mission-executor] pre-executed ${task.assignedRole}`,
              {
                params: invocation.params,
                missionId,
                taskId,
                resultCount: Array.isArray(resultObj?.results)
                  ? resultObj.results.length
                  : undefined,
              },
            );
          } else {
            preExecError = invocation.error;
            preExecResultBlock = `【前置工具调用失败（已在 server 端尝试）】\n调用：\`${invocation.toolName}(${JSON.stringify(
              invocation.params,
            )})\`\n\n错误：${invocation.error}\n\n请基于空结果按 SKILL.md 建议：要么如实报告无数据，要么用更宽的 timeRange/关键词重试。不要凭空编造结果。`;
            console.warn(
              `[mission-executor] pre-exec failed for ${task.assignedRole}:`,
              invocation.error,
            );
          }
        }
      } catch (err) {
        preExecError = err instanceof Error ? err.message : String(err);
        console.error("[mission-executor] pre-exec threw:", err);
      }
    }

    // 工具强制块：有预执行结果时，改成"请基于真实结果做排序/摘要，不要重复调用"。
    const useStrictToolEnforcement = shouldUseStrictToolEnforcement(
      task.assignedRole,
      preExecUsedTool,
    );
    const toolEnforcementBlock = task.assignedRole
      ? preExecUsedTool
        ? `【工具调用说明】\nserver 端已用绑定参数调用了 \`${task.assignedRole}\`，真实结果在上面的【前置工具调用结果】块里。你的任务是**基于这些真实数据**按 SKILL.md 的要求做排序、筛选、摘要、分组等后续处理，直接产出最终输出。\n\n禁止：\n- 不要再调用 ${task.assignedRole}（参数相同，浪费 token）\n- 不要忽略或替换真实结果中的条目\n- 不要凭空增加未出现在结果中的条目（伪造来源、时间、数据点）\n- 若真实结果为空，如实报告"无命中"并给出下一步建议，不得用训练数据里的话题填充`
        : useStrictToolEnforcement
          ? `【工具调用强制要求】\n本步骤必须首先调用 \`${task.assignedRole}\` 工具。参数取值按以下优先级：\n1. 优先使用【调用参数】块里的值（若已提供）—— 这些是步骤作者显式绑定的真实参数，必须逐字使用，禁止自行改写；\n2. 若未提供【调用参数】，再从【工作流输入参数】里挑选合适字段（通常 query / topic / keyword 对应 topic_title 之类的文本字段）；\n3. 绝不能使用步骤名、技能描述里的关键词、或训练数据里的热门话题替代用户的真实输入。\n\n严禁跳过工具直接编写结果；严禁伪造来源、时间、数据。若工具返回空结果，如实报告空结果，不得替换为其他话题。`
          : `【技能执行要求】\n本步骤对应技能 \`${task.assignedRole}\`。请按 SKILL.md、本次工作流任务、工作流输入参数与上游步骤输出完成本步骤；不要为了套格式伪造来源、时间、数据或不存在的上游事实。`
      : "";

    const userInstructions = [
      inputParamsBlock,
      missionInstructionBlock,
      task.description ? `【本步骤指示】\n${task.description}` : "",
      preExecResultBlock,
      toolEnforcementBlock,
      task.expectedOutput ? `期望输出：${task.expectedOutput}` : "",
      employeeMessages ? `来自团队的消息：\n${employeeMessages}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // ── 数据型工具预执行短路：跳过 LLM，直接从真实工具返回值产出 ─────────
    // 经验教训：LLM 再多强指令都压不住"按模板虚构"的惯性。即使给 DeepSeek
    // 发"真实结果 0 条，严禁补填"、"真实结果 N 条，1:1 引用不改写"，它仍会：
    //  1. 把 query="CCBN" 自作主张扩展成 "CCBN 2024"（训练数据最熟悉的年份）
    //  2. 编造"BM25 算法"、"人工复核"、"217 个新闻源" 这类根本不存在的过程
    //  3. 把 Tavily 实际返回的几条混着训练数据里的旧文章一起输出
    //
    // 唯一可靠方法 = **对数据获取类工具（web_search / news_aggregation / trending_topics
    // / media_search 等），预执行成功就完全跳过 LLM**，由 server 把真实结果
    // 格式化成 SKILL.md 要求的三段式输出。LLM 碰不到这个分支，就编不了。
    //
    // 诊断日志：若 pre-exec 没触发，多半是这几个原因里的一个。
    if (
      shouldBlockRegisteredSkillFallback({
        assignedRole: task.assignedRole,
        preExecAttempted,
        preExecUsedTool,
      })
    ) {
      console.warn(
        `[mission-executor] WARN: task ${taskId} (${task.assignedRole}) has real tool but fell through to LLM path. Possible causes:`,
        {
          hasTemplateId: !!mission.workflowTemplateId,
          hasInputParams: !!missionInputParams && Object.keys(missionInputParams).length > 0,
          taskPriority: task.priority,
          taskAssignedRole: task.assignedRole,
        },
      );
    }
    if (
      preExecUsedTool &&
      task.assignedRole &&
      (isToolRegistered(task.assignedRole) || isLLMSkillRegistered(task.assignedRole))
    ) {
      const deterministicText = formatPreExecOutputDeterministic({
        toolName: task.assignedRole,
        params: preExecParams,
        isEmpty: preExecEmpty,
        rawResultBlock: preExecResultBlock,
      });

      // 把 invocation.result 的结构化字段 spread 进 outputData（让 {{stepN.field}}
      // 模板能引用真实输出字段，如 topics / results / articles）。
      // 注意：spread 必须在固定字段之前，避免 result 误覆盖 stepKey/summary 等保留字段。
      const resultFields =
        preExecResult && typeof preExecResult === "object"
          ? (preExecResult as Record<string, unknown>)
          : {};

      // ─── 检测工具内部"软失败"(invocation.ok=true 但 result.success=false) ───
      // 历史事故:archive_to_drafts 缺 organizationId 时返回
      // {success:false, error:{code:"missing_context", message:"..."}},但本短路
      // 路径之前无脑把 status 写成 "completed"/"success",mission 总状态显示绿色✓,
      // 用户却根本没入库 —— 这是误导。修复:result.success === false 时
      // 必须把 task 标为 failed 并把 error.message 写到 errorMessage 列。
      const explicitToolFailure = (() => {
        if (!resultFields || typeof resultFields !== "object") return null;
        const r = resultFields as { success?: unknown; error?: unknown };
        if (r.success === false) {
          const e = r.error;
          if (e && typeof e === "object") {
            const err = e as { code?: unknown; message?: unknown };
            const code = typeof err.code === "string" ? err.code : "tool_error";
            const message =
              typeof err.message === "string" ? err.message : "工具返回失败";
            return { code, message };
          }
          return { code: "tool_error", message: "工具返回 success=false" };
        }
        return null;
      })();

      // ─── 2026-05-30 — 第四道防线:扫 IO 找上游兜底/失败痕迹 ───
      // 经典案例:cross_language_rewrite 翻译失败,fallback "[NEEDS REVIEW]" → 下游
      // archive_to_drafts 收到垃圾入参,INSERT 成功但稿件全是垃圾 → 旧逻辑标 ✓
      // 误导用户。新逻辑:发现 [NEEDS REVIEW] / LLM did not return 等指纹 → 标 failed
      const contamination = explicitToolFailure
        ? null
        : detectIOContamination(preExecParams, preExecResult, task.assignedRole);

      // 统一封装两类失败 —— 后续 DB write 不再区分,只看 toolFailure 是否 truthy
      const toolFailure: { code: string; message: string } | null =
        explicitToolFailure ??
        (contamination?.contaminated
          ? {
              code: `io_contamination:${contamination.pattern}`,
              message: `上游兜底/失败痕迹流入本步骤(样本:${contamination.sample ?? ""})`,
            }
          : null);

      if (toolFailure && contamination?.contaminated) {
        console.warn(
          `[mission-executor] IO contamination detected on task ${taskId}`,
          {
            pattern: contamination.pattern,
            sample: contamination.sample,
            assignedRole: task.assignedRole,
          },
        );
      }

      const deterministicOutput = {
        ...resultFields,
        stepKey: task.id,
        employeeSlug: agent.slug,
        summary: toolFailure
          ? `${task.assignedRole} 工具失败:${toolFailure.code} — ${toolFailure.message}`
          : preExecEmpty
            ? `${task.assignedRole} 真实返回 0 条 —— 请调整参数`
            : isLLMSkillRegistered(task.assignedRole)
              ? `${task.assignedRole} LLM-skill 真实调用完成，结果已直出（未经二次 LLM 包装）`
              : `${task.assignedRole} 真实调用完成，结果已直出（未经 LLM）`,
        artifacts: [],
        metrics: {
          qualityScore: toolFailure ? 30 : preExecEmpty ? 60 : 85,
        },
        status: toolFailure ? ("failed" as const) : ("success" as const),
        text: deterministicText,
      };

      await Promise.all([
        db
          .update(missionTasks)
          .set({
            status: toolFailure ? "failed" : "completed",
            errorMessage: toolFailure
              ? `[${toolFailure.code}] ${toolFailure.message}`
              : null,
            outputData: deterministicOutput,
            progress: toolFailure ? 0 : 100,
            completedAt: new Date(),
          })
          .where(eq(missionTasks.id, taskId)),
        task.assignedEmployeeId
          ? db
              .update(aiEmployees)
              .set({
                status: "idle",
                currentTask: null,
                // 失败不计入 tasksCompleted(否则员工绩效虚高)
                tasksCompleted: toolFailure
                  ? aiEmployees.tasksCompleted
                  : sql`${aiEmployees.tasksCompleted} + 1`,
                avgResponseTime: "0s",
                updatedAt: new Date(),
              })
              .where(eq(aiEmployees.id, task.assignedEmployeeId))
          : Promise.resolve(),
        task.assignedEmployeeId
          ? db.insert(missionMessages).values({
              missionId,
              fromEmployeeId: task.assignedEmployeeId,
              messageType: toolFailure ? "task_failed" : "result",
              content: toolFailure
                ? `「${task.title}」失败:${toolFailure.code} — ${toolFailure.message}。请检查工作流上下文(如 organizationId / operatorId 是否已注入),或修复参数后重跑。`
                : `「${task.title}」已完成（工具真实输出直出，未走 LLM）。`,
              relatedTaskId: taskId,
            })
          : Promise.resolve(),
      ]);

      console.log(
        `[mission-executor] short-circuited data-fetching task ${taskId} (pre-exec direct)`,
        {
          isEmpty: preExecEmpty,
          tool: task.assignedRole,
          toolFailure,
        },
      );
      return {
        status: toolFailure ? ("failed" as const) : ("completed" as const),
        taskId,
      };
    }

    // ── 保护:registered tool / LLM-skill 短路失败时,不让 LLM 编故事 ─────────
    // 事故复盘:step 2 topic_classifier 返回 0 条 → step 3 batch_deep_read
    // 收到 items=[] → 旧 zod min(1) 拒绝 → preExecUsedTool=false →
    // fallthrough 到下方 executeAgent → qwen3-max 凭空编"详情正文摘要报告"
    // 塞进 outputData,UI 显示绿色✓但内容全是假的(用户看到编造的"宁波高血压
    // 患者""陈克明手擀面"等)。
    //
    // 唯一可靠方法 = **必须短路的 registered tool/LLM-skill 短路失败就直接 fail**。
    // 少数生成型 skill（如 content_generate）虽然有同名 helper tool，但无显式
    // 参数时本来就应走 agent + SKILL.md 写稿路径，不能被这个 guard 误杀。
    if (
      shouldBlockRegisteredSkillFallback({
        assignedRole: task.assignedRole,
        preExecAttempted,
        preExecUsedTool,
      })
    ) {
      const failureMsg = formatRegisteredSkillFallbackFailure(
        task.assignedRole,
        preExecError,
      );
      console.error(
        `[mission-executor] BLOCKED LLM fallthrough for registered tool ${task.assignedRole}`,
        { taskId, missionId, role: task.assignedRole },
      );
      await Promise.all([
        db
          .update(missionTasks)
          .set({
            status: "failed",
            errorMessage: failureMsg,
            outputData: {
              status: "failed",
              summary: failureMsg,
              artifacts: [],
              metrics: { qualityScore: 0 },
              stepKey: task.id,
              employeeSlug: agent.slug,
              note: "registered tool 短路失败,已阻止 LLM fallthrough 防止编故事",
            },
            progress: 100,
            completedAt: new Date(),
          })
          .where(eq(missionTasks.id, taskId)),
        task.assignedEmployeeId
          ? db
              .update(aiEmployees)
              .set({
                status: "idle",
                currentTask: null,
                updatedAt: new Date(),
              })
              .where(eq(aiEmployees.id, task.assignedEmployeeId))
          : Promise.resolve(),
        task.assignedEmployeeId
          ? db.insert(missionMessages).values({
              missionId,
              fromEmployeeId: task.assignedEmployeeId,
              messageType: "result",
              content: `「${task.title}」失败:${failureMsg}`,
              relatedTaskId: taskId,
            })
          : Promise.resolve(),
      ]);
      return { status: "failed" as const, taskId, error: failureMsg };
    }

    const result = await executeAgent(
      agent,
      {
        stepKey: task.id,
        stepLabel: task.title,
        scenario: await loadScenarioLabel(mission),
        topicTitle: mission.title,
        previousSteps,
        userInstructions,
        skillSpec: skillBody ?? undefined,
        skillSlug: task.assignedRole ?? undefined,
      },
      undefined,
      missionTools,
      {
        organizationId: mission.organizationId,
        operatorId: task.assignedEmployeeId ?? mission.leaderEmployeeId ?? undefined,
        missionId,
        taskId,
      },
    );

    // ── 第三道防线:扫描 LLM 输出文本是否含失败指纹 ──────────────────────
    // 前两道防线(短路 toolFailure + registered-tool guard)理论上挡所有工具失败,
    // 但实测有 mission 绕过(leader 接管 / assignedRole 缺失等),跑到这里。
    // 此处兜底:若 LLM 自己的产出显式提到 missing_context / "失败"等,强制把
    // task 标 failed,避免 LLM 报喜不报忧或编故事 → UI 显示完成的事故。
    const agentFailure = detectAgentOutputFailure(result.output);
    if (agentFailure.failed) {
      console.warn(
        `[mission-executor] post-LLM failure detector triggered for task ${taskId}`,
        {
          pattern: agentFailure.pattern,
          excerpt: agentFailure.excerpt,
          assignedRole: task.assignedRole,
        },
      );
    }

    // Batch all post-execution DB writes (queued by max:1 pool, but no await gaps)
    const totalTokens = result.tokensUsed.input + result.tokensUsed.output;
    const finalStatus: "completed" | "failed" = agentFailure.failed
      ? "failed"
      : "completed";
    const failureErrorMessage = agentFailure.failed
      ? `[agent_output_failure:${agentFailure.pattern}] ${agentFailure.excerpt ?? "LLM 产出含失败指纹"}`
      : null;

    await Promise.all([
      // Save output
      db.update(missionTasks)
        .set({
          status: finalStatus,
          errorMessage: failureErrorMessage,
          outputData: result.output,
          progress: agentFailure.failed ? 0 : 100,
          completedAt: new Date(),
        })
        .where(eq(missionTasks.id, taskId)),
      // Reset employee + post message
      task.assignedEmployeeId
        ? db.update(aiEmployees)
            .set({
              status: "idle", currentTask: null,
              // 失败不计入 tasksCompleted(避免员工绩效虚高)
              tasksCompleted: agentFailure.failed
                ? aiEmployees.tasksCompleted
                : sql`${aiEmployees.tasksCompleted} + 1`,
              avgResponseTime: `${Math.round(result.durationMs / 1000)}s`,
              updatedAt: new Date(),
            })
            .where(eq(aiEmployees.id, task.assignedEmployeeId))
        : Promise.resolve(),
      task.assignedEmployeeId
        ? db.insert(missionMessages).values({
            missionId,
            fromEmployeeId: task.assignedEmployeeId,
            messageType: agentFailure.failed ? "task_failed" : "result",
            content: agentFailure.failed
              ? `「${task.title}」检测到失败:${agentFailure.pattern}。LLM 产出显式提到失败指纹(${agentFailure.excerpt ?? ""}),已强制标记为失败。请检查工具调用上下文。`
              : `「${task.title}」已完成。\n\n${result.output.summary || ""}`,
            relatedTaskId: taskId,
          })
        : Promise.resolve(),
      // Update token usage
      db.update(missions).set({ tokensUsed: sql`${missions.tokensUsed} + ${totalTokens}` }).where(eq(missions.id, missionId)),
    ]);

    // Persist artifacts (sequential — variable count)
    if (result.output.artifacts?.length) {
      for (const artifact of result.output.artifacts) {
        await db.insert(missionArtifacts).values({
          missionId, taskId, producedBy: task.assignedEmployeeId!,
          type: artifact.type ?? "text",
          title: artifact.title ?? task.title,
          content: typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content),
        });
      }
    }

    // --- Cognitive Engine: verify + learn (fire-and-forget, don't block) ---
    const verifyAndLearn = async () => {
      try {
        const outputText = result.output.summary || result.output.artifacts?.[0]?.content || "";
        if (!outputText || !task.assignedEmployeeId) return;

        const missionRow = await db
          .select({ orgId: missions.organizationId })
          .from(missions).where(eq(missions.id, missionId)).limit(1);
        const orgId = missionRow[0]?.orgId;
        if (!orgId) return;

        const verification = await verify({
          output: outputText,
          taskTitle: task.title,
          taskDescription: task.description,
          expectedOutput: task.expectedOutput ?? undefined,
          employeeId: task.assignedEmployeeId,
          employeeSlug: "",
          missionId,
          taskId,
          organizationId: orgId,
          intentType: mission.scenario,
        });

        const empSkillRows = await db
          .select({ skillId: employeeSkills.skillId })
          .from(employeeSkills)
          .where(eq(employeeSkills.employeeId, task.assignedEmployeeId));

        if (empSkillRows.length > 0) {
          await updateSkillStats({
            employeeId: task.assignedEmployeeId,
            skillIds: empSkillRows.map((r) => r.skillId),
            qualityScore: verification.qualityScore,
            passed: verification.passed,
            taskId,
            organizationId: orgId,
          });
        }
      } catch (err) {
        console.error("[mission-executor] Verify+learn failed (non-blocking):", err);
      }
    };
    verifyAndLearn(); // fire-and-forget

    return { status: "completed" as const, taskId, durationMs: result.durationMs };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(missionTasks)
      .set({ status: "failed", errorMessage })
      .where(eq(missionTasks.id, taskId));

    if (task.assignedEmployeeId) {
      await db
        .update(aiEmployees)
        .set({ status: "idle", currentTask: null })
        .where(eq(aiEmployees.id, task.assignedEmployeeId));
    }

    return { status: "failed" as const, taskId, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// 3. Execute all ready tasks, then check dependencies, repeat until done
// ---------------------------------------------------------------------------

export async function executeAllTasksDirect(missionId: string, missionStartTime: number = Date.now()) {
  // Pre-load mission ONCE (shared across all task executions)
  const mission = await db.query.missions.findFirst({ where: eq(missions.id, missionId) });
  if (!mission) throw new Error(`Mission not found: ${missionId}`);
  const cachedMission = {
    id: mission.id,
    organizationId: mission.organizationId,
    scenario: mission.scenario,
    title: mission.title,
    tokenBudget: mission.tokenBudget,
    tokensUsed: mission.tokensUsed,
    leaderEmployeeId: mission.leaderEmployeeId,
    workflowTemplateId: mission.workflowTemplateId,
    // 把 userInstruction + inputParams 一起 cache，下游每一步都能看到用户输入
    userInstruction: mission.userInstruction,
    inputParams: mission.inputParams as Record<string, unknown> | null,
  };

  let rounds = 0;
  const maxRounds = 20;

  while (rounds < maxRounds) {
    rounds++;

    // Cancellation + budget checkpoint (re-read actual values from DB each round)
    const check = await db
      .select({ status: missions.status, tokensUsed: missions.tokensUsed, tokenBudget: missions.tokenBudget })
      .from(missions).where(eq(missions.id, missionId)).limit(1);
    if (check[0]?.status === "cancelled") {
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "任务已取消" })
        .where(and(
          eq(missionTasks.missionId, missionId),
          inArray(missionTasks.status, ["pending", "ready"]),
        ));
      break;
    }
    if (check[0] && check[0].tokensUsed >= check[0].tokenBudget) {
      console.warn(`[mission-executor] Token budget exceeded (${check[0].tokensUsed}/${check[0].tokenBudget}), stopping execution`);
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: `Token 预算已耗尽（${check[0].tokensUsed}/${check[0].tokenBudget}）` })
        .where(and(
          eq(missionTasks.missionId, missionId),
          inArray(missionTasks.status, ["pending", "ready"]),
        ));
      break;
    }

    // Mission-level timeout check
    if (Date.now() - missionStartTime > MISSION_TIMEOUT_MS) {
      console.warn(`[mission-executor] Mission timeout after ${Math.round((Date.now() - missionStartTime) / 1000)}s`);
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "任务整体执行超时（超过 15 分钟）" })
        .where(and(
          eq(missionTasks.missionId, missionId),
          inArray(missionTasks.status, ["pending", "ready"]),
        ));
      break;
    }

    // Find ready tasks
    const readyTasks = await db.select().from(missionTasks)
      .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "ready")));

    if (readyTasks.length === 0) {
      // Mark any remaining pending tasks as failed — they're stuck due to broken dependency chains
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "依赖链中断，无法继续执行" })
        .where(and(
          eq(missionTasks.missionId, missionId),
          eq(missionTasks.status, "pending"),
        ));
      break;
    }

    // Group by employee for conflict-free parallelism
    const employeeGroups = new Map<string, typeof readyTasks>();
    for (const task of readyTasks) {
      const key = task.assignedEmployeeId ?? task.id;
      const group = employeeGroups.get(key) ?? [];
      group.push(task);
      employeeGroups.set(key, group);
    }

    // Execute groups in parallel — pass cached mission to avoid redundant queries
    await Promise.allSettled(
      [...employeeGroups.values()].map(async (group) => {
        for (const task of group) {
          await executeTaskDirect(task.id, missionId, cachedMission);
        }
      })
    );

    // Lightweight round-end: only load status + deps (NOT outputData which is huge)
    const taskStatuses = await db.select({
      id: missionTasks.id,
      status: missionTasks.status,
      dependencies: missionTasks.dependencies,
    }).from(missionTasks).where(eq(missionTasks.missionId, missionId));

    // Update progress
    const completedCount = taskStatuses.filter((t) => t.status === "completed").length;
    const progressPct = taskStatuses.length > 0 ? Math.round(completedCount / taskStatuses.length * 100) : 0;
    await db.update(missions).set({ progress: progressPct }).where(eq(missions.id, missionId));

    // Build lookup sets
    const completedIds = new Set(taskStatuses.filter((t) => t.status === "completed").map((t) => t.id));
    const terminalStatuses = new Set(["failed", "blocked", "cancelled"]);
    const terminalIds = new Set(taskStatuses.filter((t) => terminalStatuses.has(t.status)).map((t) => t.id));

    // Cascade-fail: pending tasks with any terminal dependency
    const blockedByFailure = taskStatuses.filter((t) => {
      if (t.status !== "pending") return false;
      const deps = (t.dependencies as string[]) || [];
      return deps.some((d) => terminalIds.has(d));
    });

    for (const t of blockedByFailure) {
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "上游依赖任务失败，该任务已自动取消" })
        .where(eq(missionTasks.id, t.id));
    }

    // Promote: pending tasks whose deps are all completed
    const pendingWithDeps = taskStatuses.filter((t) => {
      if (t.status !== "pending") return false;
      // Skip tasks we just cascade-failed
      if (blockedByFailure.some((b) => b.id === t.id)) return false;
      const deps = (t.dependencies as string[]) || [];
      return deps.length > 0 && deps.every((d) => completedIds.has(d));
    });

    if (pendingWithDeps.length > 0) {
      const neededDepIds = new Set<string>();
      for (const t of pendingWithDeps) {
        for (const d of (t.dependencies as string[]) || []) neededDepIds.add(d);
      }
      const depOutputRows = neededDepIds.size > 0
        ? await db.select({ id: missionTasks.id, title: missionTasks.title, outputData: missionTasks.outputData })
            .from(missionTasks).where(inArray(missionTasks.id, [...neededDepIds]))
        : [];
      const depOutputMap = new Map(depOutputRows.map((d) => [d.id, d]));

      for (const t of pendingWithDeps) {
        const deps = (t.dependencies as string[]) || [];
        const depOutputs = deps
          .map((id) => depOutputMap.get(id))
          .filter((d): d is NonNullable<typeof d> => !!d && d.outputData !== null)
          .map((d) => ({ taskId: d.id, taskTitle: d.title, output: d.outputData }));

        await db.update(missionTasks)
          .set({ status: "ready", inputContext: depOutputs.length > 0 ? depOutputs : null })
          .where(eq(missionTasks.id, t.id));
      }
    }
  }

  // Post-loop: fail any remaining stuck tasks (safety net for max rounds exceeded)
  if (rounds >= maxRounds) {
    const remainingTasks = await db.select({ id: missionTasks.id, status: missionTasks.status })
      .from(missionTasks).where(eq(missionTasks.missionId, missionId));

    const stuckTasks = remainingTasks.filter(
      (t) => t.status === "pending" || t.status === "ready" || t.status === "in_progress"
    );

    for (const t of stuckTasks) {
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "执行轮次已达上限，任务被强制终止" })
        .where(eq(missionTasks.id, t.id));
    }

    if (stuckTasks.length > 0) {
      console.warn(`[mission-executor] Force-failed ${stuckTasks.length} stuck tasks after ${maxRounds} rounds`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Leader consolidation
// ---------------------------------------------------------------------------

export async function leaderConsolidateDirect(
  missionId: string,
  organizationId: string
) {
  // Update status
  const [mission] = await db
    .update(missions)
    .set({ status: "consolidating" })
    .where(eq(missions.id, missionId))
    .returning();
  if (!mission) throw new Error(`Mission not found: ${missionId}`);

  // Load completed tasks
  const completedTasks = await db
    .select({
      id: missionTasks.id,
      title: missionTasks.title,
      description: missionTasks.description,
      outputData: missionTasks.outputData,
    })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  // Assemble leader agent
  const agent = await assembleAgent(mission.leaderEmployeeId);

  // 合并阶段要产出完整正文（潜在 2500+ 汉字），默认 4096 token 会被截。
  agent.modelConfig = {
    ...agent.modelConfig,
    maxTokens: Math.max(agent.modelConfig.maxTokens ?? 4096, 8192),
  };

  const prompt = buildConsolidatePrompt(
    {
      title: mission.title,
      scenario: mission.scenario,
      userInstruction: mission.userInstruction,
      inputParams: mission.inputParams as Record<string, unknown> | null,
    },
    completedTasks,
  );

  const previousSteps = mapTaskOutputsToStepOutputs(completedTasks);

  const result = await executeAgent(
    agent,
    {
      stepKey: "leader-consolidate",
      stepLabel: "成果汇总与交付",
      scenario: await loadScenarioLabel(mission),
      topicTitle: mission.title,
      previousSteps,
      userInstructions: prompt,
    },
    undefined, // onProgress
    undefined, // missionTools
    { organizationId, operatorId: mission.leaderEmployeeId ?? undefined },
  );

  // Save final output
  await db
    .update(missions)
    .set({
      status: "completed",
      finalOutput: result.output,
      completedAt: new Date(),
      tokensUsed: sql`${missions.tokensUsed} + ${result.tokensUsed.input + result.tokensUsed.output}`,
    })
    .where(eq(missions.id, missionId));

  // Post completion message
  await db.insert(missionMessages).values({
    missionId,
    fromEmployeeId: mission.leaderEmployeeId,
    messageType: "result",
    content: `任务「${mission.title}」已全部完成！共完成 ${completedTasks.length} 个子任务。\n\n${result.output.summary || ""}`,
  });

  // Reset team status
  const teamMemberIds = (mission.teamMembers as string[]) || [];
  const allEmployeeIds = [...new Set([mission.leaderEmployeeId, ...teamMemberIds])];
  for (const empId of allEmployeeIds) {
    await db
      .update(aiEmployees)
      .set({ status: "idle", currentTask: null })
      .where(eq(aiEmployees.id, empId));
  }

  return { status: "completed", taskCount: completedTasks.length };
}

// ---------------------------------------------------------------------------
// 5. Full pipeline — plan + execute + consolidate
// ---------------------------------------------------------------------------

export async function executeMissionDirect(
  missionId: string,
  organizationId: string
) {
  const missionStartTime = Date.now();

  function isMissionTimedOut() {
    return Date.now() - missionStartTime > MISSION_TIMEOUT_MS;
  }

  // Transition from queued → planning (signals execution has started)
  await db
    .update(missions)
    .set({ status: "planning", startedAt: new Date() })
    .where(eq(missions.id, missionId));

  // Phase 1: Leader planning
  const plan = await leaderPlanDirect(missionId, organizationId);

  // Phase 2: Execute all tasks (pass start time for timeout check)
  if (!isMissionTimedOut()) {
    await executeAllTasksDirect(missionId, missionStartTime);
  } else {
    console.warn(`[mission-executor] Mission ${missionId} timed out before task execution`);
    await db.update(missionTasks)
      .set({ status: "failed", errorMessage: "任务整体执行超时（超过 15 分钟）" })
      .where(and(
        eq(missionTasks.missionId, missionId),
        inArray(missionTasks.status, ["pending", "ready"]),
      ));
  }

  // Phase 3: 4-level degradation strategy
  const allTasks = await db
    .select({ id: missionTasks.id, status: missionTasks.status })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  const totalCount = allTasks.length;
  const completedCount = allTasks.filter((t) => t.status === "completed").length;
  const failedCount = allTasks.filter((t) => t.status === "failed").length;
  const completionRate = totalCount > 0 ? completedCount / totalCount : 0;

  if (completionRate === 1) {
    // Level 1: 全部完成，正常汇总
    await leaderConsolidateDirect(missionId, organizationId);
    return { status: "completed", taskCount: plan.taskCount };
  } else if (completionRate >= 0.7) {
    // Level 2: 70%+ 完成，降级汇总
    if (!isMissionTimedOut()) {
      await leaderConsolidateDirect(missionId, organizationId);
    } else {
      // Timeout — use fallback consolidation
      const completedTaskTitles = await db
        .select({ title: missionTasks.title })
        .from(missionTasks)
        .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "completed")));
      await db
        .update(missions)
        .set({
          status: "completed",
          completedAt: new Date(),
          finalOutput: {
            degradation_level: 2,
            message: `${completedCount}/${totalCount} 个子任务完成（汇总因超时跳过）`,
            completedTasks: completedTaskTitles.map((t) => t.title),
          },
        })
        .where(eq(missions.id, missionId));
    }
    await db
      .update(missions)
      .set({
        config: sql`jsonb_set(COALESCE(${missions.config}, '{}'::jsonb), '{degradation_level}', '2')`,
      })
      .where(eq(missions.id, missionId));
    return { status: "completed", taskCount: plan.taskCount, degradationLevel: 2, failedCount };
  } else if (completionRate >= 0.3) {
    // Level 3: 30%+ 完成，降级汇总 + 部分交付
    try {
      if (isMissionTimedOut()) throw new Error("任务整体超时，跳过汇总");
      await leaderConsolidateDirect(missionId, organizationId);
    } catch (err) {
      const completedTaskTitles = await db
        .select({ title: missionTasks.title })
        .from(missionTasks)
        .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "completed")));
      await db
        .update(missions)
        .set({
          status: "completed",
          completedAt: new Date(),
          finalOutput: {
            degradation_level: 3,
            message: `${completedCount}/${totalCount} 个子任务完成，部分交付（${err instanceof Error ? err.message : String(err)}）`,
            completedTasks: completedTaskTitles.map((t) => t.title),
          },
        })
        .where(eq(missions.id, missionId));
    }
    await db
      .update(missions)
      .set({
        config: sql`jsonb_set(COALESCE(${missions.config}, '{}'::jsonb), '{degradation_level}', '3')`,
      })
      .where(eq(missions.id, missionId));
    return { status: "completed", taskCount: plan.taskCount, degradationLevel: 3, failedCount };
  } else {
    // Level 4: <30% 完成，标记失败
    const failedTasks = await db
      .select({ title: missionTasks.title, errorMessage: missionTasks.errorMessage })
      .from(missionTasks)
      .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "failed")));

    const failureReasons = failedTasks
      .filter((t) => t.errorMessage)
      .map((t) => `${t.title}: ${t.errorMessage}`)
      .slice(0, 5);

    await db
      .update(missions)
      .set({
        status: "failed",
        completedAt: new Date(),
        finalOutput: {
          error: true,
          message: `任务完成率过低（${completedCount}/${totalCount}），${failedCount} 个子任务失败`,
          degradation_level: 4,
          failedAt: new Date().toISOString(),
          failureReasons,
        },
      })
      .where(eq(missions.id, missionId));
    return { status: "failed", taskCount: plan.taskCount, failedCount };
  }
}
