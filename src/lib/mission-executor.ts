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
import { eq, and, sql, inArray } from "drizzle-orm";
import { verify } from "@/lib/cognitive/verify-learner";
import { updateSkillStats } from "@/lib/cognitive/skill-manager";
import { assembleAgent, executeAgent } from "@/lib/agent";
import {
  createMissionTools,
  invokeToolDirectly,
  isToolRegistered,
} from "@/lib/agent/tool-registry";
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
    const model = getLanguageModel({
      provider: "openai",
      model: process.env.OPENAI_MODEL || "deepseek-chat",
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
        const matched = pickEmployeeForStep(s, defaultTeamSlugs, employeesWithSkills);
        const assignedEmployeeId = matched?.id ?? mission.leaderEmployeeId;
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

      // Materialize the leader "任务分解与分配" pseudo-task immediately as
      // in_progress so the task board shows 任务总监 actively working instead
      // of sitting on "等待中" for 5-15s while the coordination LLM runs.
      // Pinned to priority=0 so it's the first row.
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

      // Mark zero-dependency tasks ready NOW so the task executor can start
      // picking them up in parallel with the leader's coordination LLM call.
      const allTasks = await db
        .select()
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));
      for (const task of allTasks) {
        const deps = (task.dependencies as string[]) || [];
        if (deps.length === 0 && task.status === "pending") {
          await db
            .update(missionTasks)
            .set({ status: "ready" })
            .where(eq(missionTasks.id, task.id));
        }
      }

      // Fire-and-forget the coordination LLM call. When it returns we insert
      // the mission message and mark the leader pseudo-task complete. Failure
      // is non-fatal — we fall back to a canned completion.
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
      void generateLeaderCoordinationMessage(leaderDispatchCtx)
        .then(async (leaderContent) => {
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
        })
        .catch((err) => {
          console.error("[leader-coordination] async update failed:", err);
          void db
            .update(missionTasks)
            .set({
              status: "completed",
              progress: 100,
              completedAt: new Date(),
              outputData: {
                summary: "任务分解与分配已完成（降级）",
                status: "success",
              },
            })
            .where(eq(missionTasks.id, leaderTask.id));
        });

      return { taskCount: stepIdToTaskId.size, teamSize: selectedEmployeeIds.size };
    }
  }

  // ─── LLM decompose path (custom / ad-hoc missions without template) ─────

  // Assemble leader agent and decompose
  const agent = await assembleAgent(mission.leaderEmployeeId);

  const prompt = buildLeaderDecomposePrompt(mission, employeesWithSkills);

  const planResult = await executeAgent(agent, {
    stepKey: "leader-plan",
    stepLabel: "任务分解与分配",
    scenario: await loadScenarioLabel(mission),
    topicTitle: mission.title,
    previousSteps: [],
    userInstructions: prompt,
  });

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
        priority: taskDef.priority ?? 0,
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
    // 这里将 task 所需的技能主动注入 agent.tools，确保工具始终可用 ——
    // 工作流合同 > 员工画像。
    if (task.assignedRole && !agent.tools.some((t) => t.name === task.assignedRole)) {
      agent.tools = [
        ...agent.tools,
        {
          name: task.assignedRole,
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
    let preExecEmpty = false; // 预执行跑完且结果为 0 条 —— 触发 LLM 跳过路径
    let preExecParams: Record<string, unknown> = {};
    if (mission.workflowTemplateId && task.assignedRole) {
      try {
        const tpl = await db.query.workflowTemplates.findFirst({
          where: eq(workflowTemplates.id, mission.workflowTemplateId),
        });
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

        // 预执行触发：显式绑定了参数，或 auto-bind 生效
        if (Object.keys(rawParams).length > 0) {
          // 渲染 Mustache 占位符
          const rendered: Record<string, unknown> = {};
          const src = missionInputParams ?? {};
          for (const [k, rawV] of Object.entries(rawParams)) {
            if (typeof rawV === "string") {
              rendered[k] = rawV.replace(/\{\{(\w+)\}\}/g, (_, name) => {
                const v = src[name];
                if (v === undefined || v === null) return "";
                if (typeof v === "object") return JSON.stringify(v);
                return String(v);
              });
            } else {
              rendered[k] = rawV;
            }
          }
          // 直接调用工具
          // 注入 org / operator 上下文 —— cms_publish 等多租户写入型工具
          // 需要这两个字段（用户在"参数配置"里无需填）。
          const invocation = await invokeToolDirectly(
            task.assignedRole,
            rendered,
            {
              organizationId: mission.organizationId ?? undefined,
              operatorId: task.assignedEmployeeId ?? undefined,
            },
          );
          void autoBound; // 记录用 —— tool 实现里会利用同一 query 参数
          preExecParams = rendered;
          if (invocation.ok) {
            preExecUsedTool = true;
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
            const resultObj = invocation.result as { results?: unknown[] } | null;
            if (
              resultObj &&
              typeof resultObj === "object" &&
              Array.isArray(resultObj.results)
            ) {
              const count = resultObj.results.length;
              if (count === 0) {
                // 标记为空 —— 后面会跳过 LLM，直接写确定性输出。
                // 这是经验教训：反复试过加强 LLM 指令都没用，DeepSeek 拿到"空
                // 结果"还是会按 SKILL.md 模板凭空编内容。唯一可靠方法是根本
                // 不让它碰这种情况。
                preExecEmpty = true;
                resultCountHint = `\n\n⚠️ 真实结果为空（0 条）。你必须如实报告"无命中结果"，并建议用户调整 timeRange（如从 24h 扩大到 7d / 30d）或修改关键词。**严禁从训练数据里补填任何文章、日期、数据、引用** —— 这是伪造。`;
              } else if (count <= 2) {
                resultCountHint = `\n\n⚠️ 真实结果仅 ${count} 条。只在这 ${count} 条内做处理；不得从训练数据里补充任何其他条目（包括你"记得"的该话题相关新闻）。日期、标题、来源、数据点必须 1:1 引用结果里的字段，不得改写。`;
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
        console.error("[mission-executor] pre-exec threw:", err);
      }
    }

    // 工具强制块：有预执行结果时，改成"请基于真实结果做排序/摘要，不要重复调用"。
    const toolEnforcementBlock = task.assignedRole
      ? preExecUsedTool
        ? `【工具调用说明】\nserver 端已用绑定参数调用了 \`${task.assignedRole}\`，真实结果在上面的【前置工具调用结果】块里。你的任务是**基于这些真实数据**按 SKILL.md 的要求做排序、筛选、摘要、分组等后续处理，直接产出最终输出。\n\n禁止：\n- 不要再调用 ${task.assignedRole}（参数相同，浪费 token）\n- 不要忽略或替换真实结果中的条目\n- 不要凭空增加未出现在结果中的条目（伪造来源、时间、数据点）\n- 若真实结果为空，如实报告"无命中"并给出下一步建议，不得用训练数据里的话题填充`
        : `【工具调用强制要求】\n本步骤必须首先调用 \`${task.assignedRole}\` 工具。参数取值按以下优先级：\n1. 优先使用【调用参数】块里的值（若已提供）—— 这些是步骤作者显式绑定的真实参数，必须逐字使用，禁止自行改写；\n2. 若未提供【调用参数】，再从【工作流输入参数】里挑选合适字段（通常 query / topic / keyword 对应 topic_title 之类的文本字段）；\n3. 绝不能使用步骤名、技能描述里的关键词、或训练数据里的热门话题替代用户的真实输入。\n\n严禁跳过工具直接编写结果；严禁伪造来源、时间、数据。若工具返回空结果，如实报告空结果，不得替换为其他话题。`
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
      task.assignedRole &&
      isToolRegistered(task.assignedRole) &&
      !preExecUsedTool
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
      isToolRegistered(task.assignedRole)
    ) {
      const deterministicText = formatPreExecOutputDeterministic({
        toolName: task.assignedRole,
        params: preExecParams,
        isEmpty: preExecEmpty,
        rawResultBlock: preExecResultBlock,
      });

      const deterministicOutput = {
        stepKey: task.id,
        employeeSlug: agent.slug,
        summary: preExecEmpty
          ? `${task.assignedRole} 真实返回 0 条 —— 请调整参数`
          : `${task.assignedRole} 真实调用完成，结果已直出（未经 LLM）`,
        artifacts: [],
        metrics: { qualityScore: preExecEmpty ? 60 : 85 },
        status: "success" as const,
        text: deterministicText,
      };

      await Promise.all([
        db
          .update(missionTasks)
          .set({
            status: "completed",
            outputData: deterministicOutput,
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
                tasksCompleted: sql`${aiEmployees.tasksCompleted} + 1`,
                avgResponseTime: "0s",
                updatedAt: new Date(),
              })
              .where(eq(aiEmployees.id, task.assignedEmployeeId))
          : Promise.resolve(),
        task.assignedEmployeeId
          ? db.insert(missionMessages).values({
              missionId,
              fromEmployeeId: task.assignedEmployeeId,
              messageType: "result",
              content: `「${task.title}」已完成（工具真实输出直出，未走 LLM）。`,
              relatedTaskId: taskId,
            })
          : Promise.resolve(),
      ]);

      console.log(
        `[mission-executor] short-circuited data-fetching task ${taskId} (pre-exec direct)`,
        { isEmpty: preExecEmpty, tool: task.assignedRole },
      );
      return { status: "completed" as const, taskId };
    }

    const result = await executeAgent(agent, {
      stepKey: task.id,
      stepLabel: task.title,
      scenario: await loadScenarioLabel(mission),
      topicTitle: mission.title,
      previousSteps,
      userInstructions,
      skillSpec: skillBody ?? undefined,
    }, undefined, missionTools);

    // Batch all post-execution DB writes (queued by max:1 pool, but no await gaps)
    const totalTokens = result.tokensUsed.input + result.tokensUsed.output;
    await Promise.all([
      // Save output
      db.update(missionTasks)
        .set({ status: "completed", outputData: result.output, progress: 100, completedAt: new Date() })
        .where(eq(missionTasks.id, taskId)),
      // Reset employee + post message
      task.assignedEmployeeId
        ? db.update(aiEmployees)
            .set({
              status: "idle", currentTask: null,
              tasksCompleted: sql`${aiEmployees.tasksCompleted} + 1`,
              avgResponseTime: `${Math.round(result.durationMs / 1000)}s`,
              updatedAt: new Date(),
            })
            .where(eq(aiEmployees.id, task.assignedEmployeeId))
        : Promise.resolve(),
      task.assignedEmployeeId
        ? db.insert(missionMessages).values({
            missionId,
            fromEmployeeId: task.assignedEmployeeId,
            messageType: "result",
            content: `「${task.title}」已完成。\n\n${result.output.summary || ""}`,
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

  const result = await executeAgent(agent, {
    stepKey: "leader-consolidate",
    stepLabel: "成果汇总与交付",
    scenario: await loadScenarioLabel(mission),
    topicTitle: mission.title,
    previousSteps,
    userInstructions: prompt,
  });

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
