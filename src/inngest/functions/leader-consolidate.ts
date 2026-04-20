import { inngest } from "../client";
import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
  aiEmployees,
  articles,
  workflowTemplates,
} from "@/db/schema";
import { eq, sql, and, notInArray } from "drizzle-orm";
import { assembleAgent, executeAgent } from "@/lib/agent";
import {
  buildConsolidatePrompt,
  mapTaskOutputsToStepOutputs,
} from "@/lib/mission-core";
import {
  publishArticleToCms,
  isCmsPublishEnabled,
  CmsError,
  type PublishResult,
} from "@/lib/cms";
import { insertWorkflowArtifact } from "@/lib/dal/workflow-artifacts";
import type { AppChannelSlug } from "@/lib/dal/app-channels";

/**
 * Leader Consolidate — triggered when all tasks in a mission are done.
 *
 * The leader agent reviews all task outputs, consolidates them into a
 * coherent final deliverable, and marks the mission as completed.
 */
export const leaderConsolidate = inngest.createFunction(
  { id: "leader-consolidate", retries: 1 },
  { event: "mission/all-tasks-done" },
  async ({ event, step }) => {
    const { missionId, organizationId } = event.data;

    // 1. Update mission status to consolidating
    const mission = await step.run("start-consolidation", async () => {
      const [updated] = await db
        .update(missions)
        .set({ status: "consolidating" })
        .where(eq(missions.id, missionId))
        .returning();
      if (!updated) throw new Error(`Mission not found: ${missionId}`);
      return updated;
    });

    // 2. Load all tasks and check completion rate for degradation strategy
    const allTaskRows = await step.run("load-all-tasks", async () => {
      return db
        .select({
          id: missionTasks.id,
          title: missionTasks.title,
          description: missionTasks.description,
          status: missionTasks.status,
          outputData: missionTasks.outputData,
          assignedEmployeeId: missionTasks.assignedEmployeeId,
        })
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));
    });

    const completedTasks = allTaskRows.filter((t) => t.status === "completed");
    const totalCount = allTaskRows.length;
    const completionRate = totalCount > 0 ? completedTasks.length / totalCount : 0;

    // Degradation: if < 30% completed, mark mission as failed
    if (completionRate < 0.3 && totalCount > 0) {
      await step.run("mark-failed", async () => {
        await db.update(missions).set({
          status: "failed",
          config: sql`jsonb_set(COALESCE(${missions.config}, '{}'::jsonb), '{degradation_level}', '4')`,
        }).where(eq(missions.id, missionId));
      });
      await step.run("cancel-remaining-tasks-on-fail", async () => {
        await db.update(missionTasks).set({ status: "cancelled" }).where(
          and(
            eq(missionTasks.missionId, missionId),
            notInArray(missionTasks.status, ["completed", "failed", "cancelled"])
          )
        );
      });
      return { status: "failed", reason: "completion_rate_below_30", completionRate };
    }

    // 3. Load all mission messages
    const messages = await step.run("load-messages", async () => {
      return db
        .select({
          content: missionMessages.content,
          messageType: missionMessages.messageType,
        })
        .from(missionMessages)
        .where(eq(missionMessages.missionId, missionId));
    });

    // 3.5 Resolve scenario display label: 优先 workflow_template.name，legacy slug 回退。
    const scenarioLabel = mission.workflowTemplateId
      ? await step.run("load-template-name", async () => {
          const tpl = await db.query.workflowTemplates.findFirst({
            where: eq(workflowTemplates.id, mission.workflowTemplateId!),
            columns: { name: true },
          });
          return tpl?.name ?? mission.scenario;
        })
      : mission.scenario;

    // 4. Assemble leader agent and run consolidation
    const consolidationResult = await step.run(
      "consolidate",
      async () => {
        const agent = await assembleAgent(mission.leaderEmployeeId);

        // Build messages summary
        const messagesText = messages
          .map((m) => `[${m.messageType}] ${m.content}`)
          .join("\n");

        const prompt = buildConsolidatePrompt(
          mission,
          completedTasks,
          { messagesText: messagesText || undefined }
        );

        const previousSteps = mapTaskOutputsToStepOutputs(completedTasks);

        const result = await executeAgent(agent, {
          stepKey: "leader-consolidate",
          stepLabel: "成果汇总与交付",
          scenario: scenarioLabel,
          topicTitle: mission.title,
          previousSteps,
          userInstructions: prompt,
        });

        return result;
      }
    );

    // 5. Save final output and mark mission completed
    await step.run("complete-mission", async () => {
      await db
        .update(missions)
        .set({
          status: "completed",
          finalOutput: consolidationResult.output,
          completedAt: new Date(),
          tokensUsed: sql`${missions.tokensUsed} + ${
            consolidationResult.tokensUsed.input +
            consolidationResult.tokensUsed.output
          }`,
        })
        .where(eq(missions.id, missionId));
    });

    // 5.5 Demo Phase 3 (2026-04-19): Auto-publish to CMS if workflow has appChannelSlug
    //
    // Flow: mission.workflowTemplateId → workflow_templates.appChannelSlug
    //   → create article row from consolidation output → publishArticleToCms
    //
    // 容错：CMS 不通/凭证失效 → 仅写 warning artifact，不影响 mission 终态 completed
    await step.run("auto-publish-to-cms", async () => {
      if (!mission.workflowTemplateId) {
        return { skipped: true, reason: "no_workflow_template" };
      }
      if (!isCmsPublishEnabled()) {
        return { skipped: true, reason: "feature_flag_disabled" };
      }

      const [template] = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.id, mission.workflowTemplateId))
        .limit(1);

      if (!template?.appChannelSlug) {
        return { skipped: true, reason: "no_app_channel" };
      }

      const output = (consolidationResult.output ?? {}) as {
        headline?: string;
        title?: string;
        body?: string;
        content?: string;
        summary?: string;
        tags?: string[];
      };

      const articleTitle = output.headline ?? output.title ?? mission.title ?? "AI 生成稿件";
      const articleBody =
        output.body ??
        output.content ??
        `<p>${output.summary ?? "(暂无正文，待补充)"}</p>`;
      const articleSummary = output.summary ?? articleTitle.slice(0, 100);
      const articleTags = Array.isArray(output.tags) ? output.tags : [];

      // Create article row (article.status = "approved" 直接跳过审核，demo 简化)
      const [article] = await db
        .insert(articles)
        .values({
          organizationId,
          title: articleTitle,
          body: articleBody,
          summary: articleSummary,
          tags: articleTags,
          content: { headline: articleTitle, body: articleBody, imageNotes: [] },
          wordCount: articleBody.length,
          mediaType: "article",
          status: "approved",
          missionId,
          priority: "P1",
        })
        .returning();

      // Post message: 稿件已生成
      await db.insert(missionMessages).values({
        missionId,
        fromEmployeeId: mission.leaderEmployeeId,
        messageType: "result",
        content: `📝 已生成稿件「${articleTitle}」，正在推送到华栖云 CMS（${template.appChannelSlug}）...`,
      });

      // Try real publish to Huaxiyun CMS
      let publishResult: PublishResult | null = null;
      let publishError: string | null = null;
      try {
        publishResult = await publishArticleToCms({
          articleId: article.id,
          appChannelSlug: template.appChannelSlug as AppChannelSlug,
          operatorId: mission.leaderEmployeeId,
          triggerSource: "workflow",
          allowUpdate: true,
        });
      } catch (err) {
        publishError =
          err instanceof CmsError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
      }

      // Insert workflow_artifact (always, success or failure)
      await insertWorkflowArtifact({
        missionId,
        artifactType: "cms_publication",
        title: `CMS 入库：${articleTitle}`,
        content: {
          articleId: article.id,
          appChannelSlug: template.appChannelSlug,
          success: !!publishResult?.success,
          cmsArticleId: publishResult?.cmsArticleId ?? null,
          cmsState: publishResult?.cmsState ?? (publishError ? "failed" : "unknown"),
          publishedUrl: publishResult?.publishedUrl ?? null,
          previewUrl: publishResult?.previewUrl ?? null,
          error: publishError,
          publicationId: publishResult?.publicationId ?? null,
        },
        producerEmployeeId: mission.leaderEmployeeId,
      });

      // Post follow-up message showing outcome
      const successIcon = publishResult?.success ? "✅" : "⚠️";
      const statusLine = publishResult?.success
        ? `CMS 入库成功！cmsArticleId=${publishResult.cmsArticleId}${
            publishResult.previewUrl ? `，预览：${publishResult.previewUrl}` : ""
          }`
        : `CMS 入库失败：${publishError ?? "未知错误"}。稿件已保存为 draft，可稍后手动发布。`;

      await db.insert(missionMessages).values({
        missionId,
        fromEmployeeId: mission.leaderEmployeeId,
        messageType: "result",
        content: `${successIcon} ${statusLine}`,
      });

      return {
        skipped: false,
        articleId: article.id,
        publishSuccess: !!publishResult?.success,
        cmsArticleId: publishResult?.cmsArticleId,
        error: publishError,
      };
    });

    // 6. Cancel remaining non-completed tasks
    await step.run("cancel-remaining-tasks", async () => {
      await db.update(missionTasks).set({ status: "cancelled" }).where(
        and(
          eq(missionTasks.missionId, missionId),
          notInArray(missionTasks.status, ["completed", "failed", "cancelled"])
        )
      );
    });

    // 7. Post completion message
    await step.run("post-completion-message", async () => {
      await db.insert(missionMessages).values({
        missionId,
        fromEmployeeId: mission.leaderEmployeeId,
        messageType: "result",
        content: `任务「${mission.title}」已全部完成！共完成 ${completedTasks.length} 个子任务。\n\n${consolidationResult.output.summary || ""}`,
      });
    });

    // 8. Reset all team members to idle
    await step.run("reset-team-status", async () => {
      const teamMemberIds = (mission.teamMembers as string[]) || [];
      const allEmployeeIds = [
        ...new Set([mission.leaderEmployeeId, ...teamMemberIds]),
      ];

      for (const empId of allEmployeeIds) {
        await db
          .update(aiEmployees)
          .set({ status: "idle", currentTask: null })
          .where(eq(aiEmployees.id, empId));
      }
    });

    // 9. Trigger learning for involved employees
    await step.run("trigger-learning", async () => {
      const teamMemberIds = (mission.teamMembers as string[]) || [];
      const allEmployeeIds = [
        ...new Set([mission.leaderEmployeeId, ...teamMemberIds]),
      ];

      for (const empId of allEmployeeIds) {
        await inngest.send({
          name: "employee/learn",
          data: {
            employeeId: empId,
            organizationId,
            trigger: "workflow_completion" as const,
          },
        });
      }
    });

    return {
      status: "completed",
      taskCount: completedTasks.length,
      durationMs: consolidationResult.durationMs,
    };
  }
);
