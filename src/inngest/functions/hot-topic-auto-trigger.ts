import { inngest } from "../client";
import { db } from "@/db";
import {
  workflowInstances,
  workflowSteps,
  teams,
  teamMembers,
  teamMessages,
  aiEmployees,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { WORKFLOW_STEPS } from "@/lib/constants";

/**
 * F4.A.02: When a hot topic reaches the heat threshold,
 * automatically create and start a workflow for the designated team.
 */
export const hotTopicAutoTrigger = inngest.createFunction(
  { id: "hot-topic-auto-trigger", name: "Hot Topic Auto Trigger" },
  { event: "hotTopic/threshold-reached" },
  async ({ event, step }) => {
    const { organizationId, hotTopicId, topicTitle, heatScore, teamId } =
      event.data;

    // 1. Verify team exists and load members
    const team = await step.run("load-team", async () => {
      const t = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
      });
      if (!t) throw new Error(`Team not found: ${teamId}`);
      return t;
    });

    const members = await step.run("load-members", async () => {
      return db
        .select({
          aiEmployeeId: teamMembers.aiEmployeeId,
          employeeSlug: aiEmployees.slug,
        })
        .from(teamMembers)
        .leftJoin(aiEmployees, eq(teamMembers.aiEmployeeId, aiEmployees.id))
        .where(eq(teamMembers.teamId, teamId));
    });

    // 2. Create workflow instance
    const instance = await step.run("create-workflow", async () => {
      const [inst] = await db
        .insert(workflowInstances)
        .values({
          teamId,
          topicTitle,
          status: "active",
        })
        .returning();
      return inst;
    });

    // 3. Create workflow steps, matching employees by slug from team members
    await step.run("create-steps", async () => {
      for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
        const ws = WORKFLOW_STEPS[i];
        const member = members.find((m) => m.employeeSlug === ws.key);
        await db.insert(workflowSteps).values({
          workflowInstanceId: instance.id,
          key: ws.key,
          label: ws.label,
          employeeId: member?.aiEmployeeId || undefined,
          stepOrder: i + 1,
        });
      }
    });

    // 4. Post notification to team
    await step.run("notify-team", async () => {
      await db.insert(teamMessages).values({
        teamId,
        senderType: "ai",
        type: "alert",
        content: `热点自动触发：「${topicTitle}」热度达到 ${heatScore}，已自动启动工作流。`,
        attachments: [
          {
            type: "topic_card" as const,
            title: topicTitle,
            description: `热度 ${heatScore} | 自动触发`,
          },
        ],
      });
    });

    // 5. Trigger the workflow execution
    await step.run("trigger-execution", async () => {
      await inngest.send({
        name: "workflow/started",
        data: {
          workflowInstanceId: instance.id,
          teamId,
          organizationId,
          topicTitle,
          scenario: team.scenario || "breaking_news",
        },
      });
    });

    return {
      status: "triggered",
      workflowInstanceId: instance.id,
      topicTitle,
      heatScore,
    };
  }
);
