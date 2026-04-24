import { inngest } from "../client";
import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
} from "@/db/schema";
import { workflowTemplates, type WorkflowStepDef } from "@/db/schema/workflows";
import { eq } from "drizzle-orm";
import { assembleAgent, executeAgent } from "@/lib/agent";
import {
  loadAvailableEmployees,
  buildLeaderDecomposePrompt,
  parseLeaderOutput,
  validateDAG,
  pickEmployeeForStep,
} from "@/lib/mission-core";

/**
 * Leader Plan — triggered when a new mission is created.
 *
 * The team leader agent analyzes the user instruction, selects team members,
 * decomposes the work into a DAG of tasks with dependencies, and kicks off
 * ready tasks.
 */
export const leaderPlan = inngest.createFunction(
  {
    id: "leader-plan",
    cancelOn: [
      {
        event: "mission/cancelled",
        match: "data.missionId",
      },
    ],
    retries: 1,
  },
  { event: "mission/created" },
  async ({ event, step }) => {
    const { missionId, organizationId } = event.data;

    // 1. Load the mission
    const mission = await step.run("load-mission", async () => {
      const m = await db.query.missions.findFirst({
        where: eq(missions.id, missionId),
      });
      if (!m) throw new Error(`Mission not found: ${missionId}`);
      return m;
    });

    // 2. Load all non-disabled employees in the organization (exclude leader)
    const availableEmployees = await step.run(
      "load-available-employees",
      async () => {
        return loadAvailableEmployees(organizationId);
      }
    );

    // ─── Template fast path ────────────────────────────────────────────────
    // 当 mission 来自 workflow_templates 且模板有预设 steps[] 时，直接 materialize
    // 步骤到 mission_tasks（跳过 LLM 分解）。LLM 分解只用于 custom / ad-hoc mission。
    // 同时把模板 name 作为场景显示名（优先于 mission.scenario slug）。
    const templateInfo = mission.workflowTemplateId
      ? await step.run("load-template", async () => {
          const tpl = await db.query.workflowTemplates.findFirst({
            where: eq(workflowTemplates.id, mission.workflowTemplateId!),
          });
          if (!tpl) return null;
          const steps =
            Array.isArray(tpl.steps) && tpl.steps.length > 0
              ? (tpl.steps as WorkflowStepDef[])
              : null;
          const defaultTeam = (tpl.defaultTeam as string[] | null) ?? [];
          return { name: tpl.name, steps, defaultTeam };
        })
      : null;
    const templateSteps = templateInfo?.steps ?? null;
    const templateDefaultTeam = templateInfo?.defaultTeam ?? [];
    // 优先展示模板名，fallback 到 legacy slug。
    const scenarioLabel = templateInfo?.name ?? mission.scenario;

    if (templateSteps) {
      const materialized = await step.run("materialize-template-steps", async () => {
        // 按 order 排序（保守）
        const sorted = [...templateSteps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        // stepId → taskId 映射（用于解析 dependsOn）
        const stepIdToTaskId = new Map<string, string>();
        const selectedEmployeeIds = new Set<string>();

        for (const s of sorted) {
          // 员工分配：显式 employeeSlug → defaultTeam 内技能匹配 → 团队轮询 → leader
          const matched = pickEmployeeForStep(s, templateDefaultTeam, availableEmployees);
          const assignedEmployeeId = matched?.id ?? mission.leaderEmployeeId;
          selectedEmployeeIds.add(assignedEmployeeId);

          // 描述：优先 config.description，退化为 step name + skill 提示
          const skillHint = s.config?.skillName || s.config?.skillSlug;
          const description =
            s.config?.description ||
            (skillHint ? `${s.name}（使用技能：${skillHint}）` : s.name);

          // 依赖解析：step.dependsOn 是 step id 数组，映射到已创建的 task id
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
              // See mission-executor.ts fast-path: persist skillSlug so task
              // executor can load the matching SKILL.md at runtime.
              assignedRole: s.config?.skillSlug ?? null,
              dependencies: depTaskIds,
              priority: s.order ?? 0,
              status: "pending",
            })
            .returning({ id: missionTasks.id });

          stepIdToTaskId.set(s.id, created.id);
        }

        return {
          taskIds: [...stepIdToTaskId.values()],
          selectedEmployeeIds: [...selectedEmployeeIds],
        };
      });

      // 更新 mission
      await step.run("update-mission-template-path", async () => {
        await db
          .update(missions)
          .set({
            teamMembers: materialized.selectedEmployeeIds,
            status: "executing",
          })
          .where(eq(missions.id, missionId));
      });

      // 协调消息（模板路径专用文案，说明跳过了 LLM 分解）
      await step.run("post-template-plan-message", async () => {
        await db.insert(missionMessages).values({
          missionId,
          fromEmployeeId: mission.leaderEmployeeId,
          messageType: "coordination",
          content: `按工作流模板预设的 ${materialized.taskIds.length} 个步骤启动任务（团队 ${materialized.selectedEmployeeIds.length} 人）。`,
        });
      });

      // Fire ready tasks
      await step.run("fire-ready-tasks-template-path", async () => {
        const allTasks = await db
          .select()
          .from(missionTasks)
          .where(eq(missionTasks.missionId, missionId));

        const readyTasks = allTasks.filter(
          (t) => !t.dependencies || (t.dependencies as string[]).length === 0
        );

        for (const task of readyTasks) {
          await db
            .update(missionTasks)
            .set({ status: "ready" })
            .where(eq(missionTasks.id, task.id));

          await inngest.send({
            name: "mission/task-ready",
            data: {
              missionId,
              taskId: task.id,
              organizationId,
            },
          });
        }
      });

      return {
        status: "planned",
        source: "template",
        taskCount: materialized.taskIds.length,
        teamSize: materialized.selectedEmployeeIds.length,
      };
    }

    // ─── LLM decompose path (custom / ad-hoc missions) ──────────────────────

    // 3. Assemble the leader agent and ask it to decompose the task
    const planResult = await step.run("leader-decompose", async () => {
      const agent = await assembleAgent(mission.leaderEmployeeId);

      const prompt = buildLeaderDecomposePrompt(mission, availableEmployees);

      const result = await executeAgent(agent, {
        stepKey: "leader-plan",
        stepLabel: "任务分解与分配",
        scenario: scenarioLabel,
        topicTitle: mission.title,
        previousSteps: [],
        userInstructions: prompt,
      });

      return result;
    });

    // 4. Parse the leader's output and create tasks
    const createdTaskIds = await step.run("create-tasks", async () => {
      const outputText = planResult.output.artifacts?.[0]?.content || planResult.output.summary || "";

      const parsed = parseLeaderOutput(outputText, {
        title: mission.title,
        instruction: mission.userInstruction,
        defaultSlug: availableEmployees[0]?.slug || "xiaolei",
      });

      // Validate DAG before inserting
      const dagResult = validateDAG(parsed.tasks);
      if (!dagResult.valid) {
        throw new Error(`任务 DAG 校验失败: ${dagResult.error}`);
      }

      // Create task records and collect IDs in order
      const taskIds: string[] = [];
      const selectedEmployeeIds = new Set<string>();

      for (let i = 0; i < parsed.tasks.length; i++) {
        const taskDef = parsed.tasks[i];

        // Resolve employee ID from slug
        const employee = availableEmployees.find(
          (e) => e.slug === taskDef.assignedEmployeeSlug
        );
        const employeeId =
          employee?.id || availableEmployees[0]?.id || null;

        if (employeeId) {
          selectedEmployeeIds.add(employeeId);
        }

        // Resolve dependency task IDs from indices
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

      return {
        taskIds,
        selectedEmployeeIds: [...selectedEmployeeIds],
      };
    });

    // 5. Update mission with team members and status
    await step.run("update-mission", async () => {
      await db
        .update(missions)
        .set({
          teamMembers: createdTaskIds.selectedEmployeeIds,
          status: "executing",
          tokensUsed:
            (mission.tokensUsed || 0) +
            planResult.tokensUsed.input +
            planResult.tokensUsed.output,
        })
        .where(eq(missions.id, missionId));
    });

    // 6. Post a coordination message about the plan
    await step.run("post-plan-message", async () => {
      await db.insert(missionMessages).values({
        missionId,
        fromEmployeeId: mission.leaderEmployeeId,
        messageType: "coordination",
        content: `任务分解完成，共创建 ${createdTaskIds.taskIds.length} 个子任务，已分配给 ${createdTaskIds.selectedEmployeeIds.length} 名团队成员。\n\n${planResult.output.summary || ""}`,
      });
    });

    // 7. Find tasks with no dependencies and fire task-ready events
    await step.run("fire-ready-tasks", async () => {
      const allTasks = await db
        .select()
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));

      const readyTasks = allTasks.filter(
        (t) => !t.dependencies || (t.dependencies as string[]).length === 0
      );

      for (const task of readyTasks) {
        await db
          .update(missionTasks)
          .set({ status: "ready" })
          .where(eq(missionTasks.id, task.id));

        await inngest.send({
          name: "mission/task-ready",
          data: {
            missionId,
            taskId: task.id,
            organizationId,
          },
        });
      }
    });

    return {
      status: "planned",
      taskCount: createdTaskIds.taskIds.length,
      teamSize: createdTaskIds.selectedEmployeeIds.length,
    };
  }
);
