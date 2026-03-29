import { inngest } from "../client";
import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { assembleAgent, executeAgent } from "@/lib/agent";
import {
  loadAvailableEmployees,
  buildLeaderDecomposePrompt,
  parseLeaderOutput,
  validateDAG,
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

    // 3. Assemble the leader agent and ask it to decompose the task
    const planResult = await step.run("leader-decompose", async () => {
      const agent = await assembleAgent(mission.leaderEmployeeId);

      const prompt = buildLeaderDecomposePrompt(mission, availableEmployees);

      const result = await executeAgent(agent, {
        stepKey: "leader-plan",
        stepLabel: "任务分解与分配",
        scenario: mission.scenario,
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
