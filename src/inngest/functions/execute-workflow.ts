import { inngest } from "../client";
import { db } from "@/db";
import {
  workflowInstances,
  workflowSteps,
  workflowArtifacts,
  teamMessages,
  teams,
  aiEmployees,
  employeeSkills,
  employeeMemories,
  executionLogs,
  skillUsageRecords,
  skills,
} from "@/db/schema";
import { eq, asc, and, sql } from "drizzle-orm";
import { assembleAgent, executeAgent } from "@/lib/agent";
import type { StepOutput } from "@/lib/agent";

export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    cancelOn: [
      {
        event: "workflow/cancelled",
        match: "data.workflowInstanceId",
      },
    ],
    retries: 1,
  },
  { event: "workflow/started" },
  async ({ event, step }) => {
    const { workflowInstanceId, teamId, topicTitle, scenario } =
      event.data;

    // Step 1: Load workflow instance and steps
    const workflow = await step.run("load-workflow", async () => {
      const instance = await db.query.workflowInstances.findFirst({
        where: eq(workflowInstances.id, workflowInstanceId),
      });
      if (!instance) throw new Error(`Workflow not found: ${workflowInstanceId}`);

      const steps = await db
        .select()
        .from(workflowSteps)
        .where(eq(workflowSteps.workflowInstanceId, workflowInstanceId))
        .orderBy(asc(workflowSteps.stepOrder));

      return { instance, steps };
    });

    // Step 2: Load team config for approval rules
    const teamConfig = await step.run("load-team-config", async () => {
      const team = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
      });
      return team;
    });

    const approvalRequired = teamConfig?.rules?.approvalRequired ?? false;
    const approvalSteps = teamConfig?.rules?.approvalSteps || [];
    const sensitiveTopics = teamConfig?.rules?.sensitiveTopics || [];
    const escalationPolicy = teamConfig?.escalationPolicy;

    // Step 3: Execute each step sequentially
    const completedOutputs: StepOutput[] = [];

    for (const wfStep of workflow.steps) {
      if (!wfStep.employeeId) {
        // Skip steps without an assigned employee
        await step.run(`skip-${wfStep.key}`, async () => {
          await db
            .update(workflowSteps)
            .set({ status: "skipped" })
            .where(eq(workflowSteps.id, wfStep.id));
        });
        continue;
      }

      // Mark step as active
      await step.run(`activate-${wfStep.key}`, async () => {
        await db
          .update(workflowSteps)
          .set({
            status: "active",
            startedAt: new Date(),
          })
          .where(eq(workflowSteps.id, wfStep.id));

        await db
          .update(workflowInstances)
          .set({ currentStepKey: wfStep.key })
          .where(eq(workflowInstances.id, workflowInstanceId));

        // Post status message
        await db.insert(teamMessages).values({
          teamId,
          senderType: "ai",
          aiEmployeeId: wfStep.employeeId,
          workflowInstanceId,
          workflowStepKey: wfStep.key,
          type: "status_update",
          content: `正在执行「${wfStep.label}」步骤...`,
        });

        // Auto-switch employee status to working
        await db
          .update(aiEmployees)
          .set({ status: "working", currentTask: `正在执行「${wfStep.label}」` })
          .where(eq(aiEmployees.id, wfStep.employeeId!));
      });

      // 2.9: Check for human intervention messages
      const userInstructions = await step.run(
        `check-intervention-${wfStep.key}`,
        async () => {
          const interventions = await db
            .select({ content: teamMessages.content })
            .from(teamMessages)
            .where(
              and(
                eq(teamMessages.teamId, teamId),
                eq(teamMessages.senderType, "human"),
                eq(teamMessages.type, "alert")
              )
            )
            .orderBy(asc(teamMessages.createdAt))
            .limit(5);
          return interventions.length > 0
            ? interventions.map((m) => m.content).join("\n")
            : undefined;
        }
      );

      // Execute the agent
      const executionResult = await step.run(
        `execute-${wfStep.key}`,
        async () => {
          const agent = await assembleAgent(wfStep.employeeId!, undefined, {
            sensitiveTopics: sensitiveTopics.length > 0 ? sensitiveTopics : undefined,
          });
          const result = await executeAgent(agent, {
            stepKey: wfStep.key,
            stepLabel: wfStep.label,
            scenario,
            topicTitle,
            previousSteps: completedOutputs,
            userInstructions: userInstructions || undefined,
          });
          return result;
        }
      );

      // F4.3.01: Log execution
      await step.run(`log-${wfStep.key}`, async () => {
        await db.insert(executionLogs).values({
          organizationId: event.data.organizationId,
          employeeId: wfStep.employeeId!,
          workflowInstanceId,
          workflowStepKey: wfStep.key,
          stepLabel: wfStep.label,
          topicTitle,
          scenario,
          outputSummary: executionResult.output.summary,
          outputFull: executionResult.output,
          tokensInput: executionResult.tokensUsed.input,
          tokensOutput: executionResult.tokensUsed.output,
          durationMs: executionResult.durationMs,
          toolCallCount: executionResult.toolCallCount,
          status: executionResult.output.status,
        });
      });

      // 2.11: Token budget enforcement
      await step.run(`token-budget-${wfStep.key}`, async () => {
        const totalTokens =
          executionResult.tokensUsed.input + executionResult.tokensUsed.output;
        await db
          .update(workflowInstances)
          .set({
            tokensUsed: sql`${workflowInstances.tokensUsed} + ${totalTokens}`,
          })
          .where(eq(workflowInstances.id, workflowInstanceId));

        // Check budget
        const updated = await db.query.workflowInstances.findFirst({
          where: eq(workflowInstances.id, workflowInstanceId),
        });
        if (updated && updated.tokensUsed > updated.tokenBudget) {
          throw new Error(
            `Token 预算超限：已使用 ${updated.tokensUsed}，预算 ${updated.tokenBudget}`
          );
        }
      });

      // 2.5: Persist artifacts to DB
      await step.run(`persist-artifacts-${wfStep.key}`, async () => {
        for (const artifact of executionResult.output.artifacts) {
          await db.insert(workflowArtifacts).values({
            workflowInstanceId,
            artifactType: (
              {
                hot_topic_list: "topic_brief",
                topic_angles: "angle_list",
                material_brief: "material_pack",
                article_draft: "article_draft",
                video_script: "video_plan",
                review_report: "review_report",
                publish_plan: "publish_plan",
                analytics_report: "analytics_report",
                generic: "generic",
              } as Record<string, string>
            )[artifact.type] as
              | "topic_brief"
              | "angle_list"
              | "material_pack"
              | "article_draft"
              | "video_plan"
              | "review_report"
              | "publish_plan"
              | "analytics_report"
              | "generic",
            title: artifact.title,
            content: { raw: artifact.content },
            textContent: artifact.content,
            producerEmployeeId: wfStep.employeeId,
            producerStepKey: wfStep.key,
          });
        }
      });

      // 2.16: Update skill levels based on quality score
      await step.run(`update-skills-${wfStep.key}`, async () => {
        const qualityScore = executionResult.output.metrics?.qualityScore;
        if (qualityScore === undefined) return;

        let delta = 0;
        if (qualityScore >= 90) delta = 2;
        else if (qualityScore >= 80) delta = 1;
        else if (qualityScore < 60) delta = -1;

        if (delta !== 0) {
          // Get employee's skills
          const empSkillRows = await db
            .select({ id: employeeSkills.id, level: employeeSkills.level })
            .from(employeeSkills)
            .where(eq(employeeSkills.employeeId, wfStep.employeeId!));

          for (const sk of empSkillRows) {
            const newLevel = Math.max(0, Math.min(100, sk.level + delta));
            await db
              .update(employeeSkills)
              .set({ level: newLevel })
              .where(eq(employeeSkills.id, sk.id));
          }
        }
      });

      // S8.03: Record skill usage for all skills used by this employee in this step
      await step.run(`record-skill-usage-${wfStep.key}`, async () => {
        if (!wfStep.employeeId) return;
        const qualityScore = executionResult.output.metrics?.qualityScore;
        const empSkills = await db
          .select({ skillId: employeeSkills.skillId })
          .from(employeeSkills)
          .where(eq(employeeSkills.employeeId, wfStep.employeeId));

        for (const { skillId } of empSkills) {
          await db.insert(skillUsageRecords).values({
            skillId,
            employeeId: wfStep.employeeId,
            workflowInstanceId,
            workflowStepId: wfStep.id,
            success: executionResult.output.status === "success" ? 1 : 0,
            qualityScore: qualityScore ?? null,
            inputSummary: executionResult.output.summary?.slice(0, 200) ?? null,
            outputSummary: executionResult.output.summary?.slice(0, 200) ?? null,
          });
        }
      });

      // Save output to DB
      await step.run(`save-${wfStep.key}`, async () => {
        // 2.8: Three-tier quality gate
        const qualityScore = executionResult.output.metrics?.qualityScore;
        const forceApproval = qualityScore !== undefined && qualityScore < 60;

        // F4.1.60: Flexible approval points
        let needsApproval =
          forceApproval ||
          (approvalRequired &&
            (approvalSteps.length > 0
              ? approvalSteps.includes(wfStep.key)
              : wfStep.key === "review"));

        // F4.A.05: Auto-escalation — if quality score is below threshold, force approval
        if (
          !needsApproval &&
          escalationPolicy?.qualityThreshold &&
          qualityScore !== undefined &&
          qualityScore < escalationPolicy.qualityThreshold
        ) {
          needsApproval = true;
        }

        await db
          .update(workflowSteps)
          .set({
            status: needsApproval ? "waiting_approval" : "completed",
            progress: 100,
            output: executionResult.output.summary,
            structuredOutput: executionResult.output,
            completedAt: needsApproval ? null : new Date(),
          })
          .where(eq(workflowSteps.id, wfStep.id));

        // Post completion message
        const qualityNote =
          forceApproval
            ? `\n⚠️ 质量自评分数 ${qualityScore}/100，低于阈值，强制人工审批。`
            : "";

        await db.insert(teamMessages).values({
          teamId,
          senderType: "ai",
          aiEmployeeId: wfStep.employeeId,
          workflowInstanceId,
          workflowStepKey: wfStep.key,
          type: needsApproval ? "decision_request" : "work_output",
          content: needsApproval
            ? `「${wfStep.label}」已完成，等待人工审批。\n\n${executionResult.output.summary}${qualityNote}`
            : `「${wfStep.label}」已完成。\n\n${executionResult.output.summary}`,
          actions: needsApproval
            ? [
                { label: "批准", variant: "primary" as const, stepId: wfStep.id },
                { label: "驳回", variant: "destructive" as const, stepId: wfStep.id },
              ]
            : undefined,
        });

        // Auto-switch employee back to idle and update performance metrics
        await db
          .update(aiEmployees)
          .set({
            status: "idle",
            currentTask: null,
            tasksCompleted: sql`${aiEmployees.tasksCompleted} + 1`,
            avgResponseTime: `${Math.round(executionResult.durationMs / 1000)}s`,
            updatedAt: new Date(),
          })
          .where(eq(aiEmployees.id, wfStep.employeeId!));
      });

      // Handle approval gate
      let stepNeedsApproval =
        approvalRequired &&
        (approvalSteps.length > 0
          ? approvalSteps.includes(wfStep.key)
          : wfStep.key === "review");

      // F4.A.05: Auto-escalation check
      const qualityScoreForGate = executionResult.output.metrics?.qualityScore;
      if (
        !stepNeedsApproval &&
        escalationPolicy?.qualityThreshold &&
        qualityScoreForGate !== undefined &&
        qualityScoreForGate < escalationPolicy.qualityThreshold
      ) {
        stepNeedsApproval = true;
      }

      if (stepNeedsApproval) {
        const approval = await step.waitForEvent("wait-for-approval", {
          event: "workflow/step-approved",
          match: "data.workflowInstanceId",
          timeout: "24h",
        });

        // F4.S.07: Handle timeout according to escalation policy
        if (!approval) {
          const timeoutAction = escalationPolicy?.timeoutAction || "auto_reject";
          if (timeoutAction === "auto_approve") {
            // Auto-approve on timeout
            await step.run(`timeout-approve-${wfStep.key}`, async () => {
              await db
                .update(workflowSteps)
                .set({ status: "completed", completedAt: new Date() })
                .where(eq(workflowSteps.id, wfStep.id));
              await db.insert(teamMessages).values({
                teamId,
                senderType: "ai",
                workflowInstanceId,
                workflowStepKey: wfStep.key,
                type: "status_update",
                content: `「${wfStep.label}」审批超时，已根据策略自动通过。`,
              });
            });
            completedOutputs.push(executionResult.output);
            continue;
          }
          // "auto_reject" and "escalate" both fall through to rejection logic below
        }

        if (!approval || !approval.data.approved) {
          const feedback = approval?.data.feedback ?? "审批超时";

          // Check if this is already a redo attempt (limit to 1 redo)
          const isRedoAttempt = (wfStep.retryCount ?? 0) > 0;

          if (!approval || !feedback || feedback === "审批超时" || isRedoAttempt) {
            // Timed out or already retried — fail the step and cancel workflow
            await step.run(`reject-${wfStep.key}`, async () => {
              await db
                .update(workflowSteps)
                .set({
                  status: "failed",
                  errorMessage: isRedoAttempt
                    ? `二次审批未通过：${feedback}`
                    : feedback,
                })
                .where(eq(workflowSteps.id, wfStep.id));

              await db.insert(teamMessages).values({
                teamId,
                senderType: "human",
                workflowInstanceId,
                workflowStepKey: wfStep.key,
                type: "status_update",
                content: isRedoAttempt
                  ? `「${wfStep.label}」二次审批未通过：${feedback}`
                  : `「${wfStep.label}」审批未通过：${feedback}`,
              });
            });

            // End workflow early
            await step.run("cancel-workflow-on-reject", async () => {
              await db
                .update(workflowInstances)
                .set({
                  status: "cancelled",
                  completedAt: new Date(),
                })
                .where(eq(workflowInstances.id, workflowInstanceId));
            });
            return { status: "rejected", stepKey: wfStep.key };
          }

          // 2.17: Write rejection feedback to employee memories + learnedPatterns
          await step.run(`learn-from-rejection-${wfStep.key}`, async () => {
            if (feedback && wfStep.employeeId) {
              // Write to employee_memories
              await db.insert(employeeMemories).values({
                employeeId: wfStep.employeeId,
                organizationId: event.data.organizationId,
                memoryType: "feedback",
                content: `步骤「${wfStep.label}」被驳回。反馈：${feedback}`,
                source: `workflow:${workflowInstanceId}:${wfStep.key}`,
                importance: 0.8,
              });

              // Update learnedPatterns counter
              const emp = await db.query.aiEmployees.findFirst({
                where: eq(aiEmployees.id, wfStep.employeeId),
              });
              type LearnedPattern = {
                source: "human_feedback" | "quality_review" | "self_reflection";
                count: number;
                lastSeen: string;
              };
              const patterns = (emp?.learnedPatterns as Record<string, LearnedPattern>) || {};
              const patternKey = `rejection:${wfStep.key}`;
              patterns[patternKey] = {
                source: "human_feedback" as const,
                count: (patterns[patternKey]?.count || 0) + 1,
                lastSeen: new Date().toISOString(),
              };
              await db
                .update(aiEmployees)
                .set({ learnedPatterns: patterns, updatedAt: new Date() })
                .where(eq(aiEmployees.id, wfStep.employeeId));
            }
          });

          // Has feedback and first attempt — redo the step with feedback injected
          await step.run(`redo-setup-${wfStep.key}`, async () => {
            await db
              .update(workflowSteps)
              .set({
                status: "active",
                progress: 0,
                retryCount: sql`${workflowSteps.retryCount} + 1`,
                startedAt: new Date(),
                completedAt: null,
                output: null,
                structuredOutput: null,
              })
              .where(eq(workflowSteps.id, wfStep.id));

            // Set employee back to working
            await db
              .update(aiEmployees)
              .set({
                status: "working",
                currentTask: `正在重做「${wfStep.label}」（根据反馈修改）`,
              })
              .where(eq(aiEmployees.id, wfStep.employeeId!));

            // Post redo message
            await db.insert(teamMessages).values({
              teamId,
              senderType: "human",
              workflowInstanceId,
              workflowStepKey: wfStep.key,
              type: "status_update",
              content: `「${wfStep.label}」已驳回，正在根据反馈重新执行...\n反馈：${feedback}`,
            });
          });

          // Re-execute the agent with feedback
          const redoResult = await step.run(
            `redo-execute-${wfStep.key}`,
            async () => {
              const agent = await assembleAgent(wfStep.employeeId!, undefined, {
                sensitiveTopics:
                  sensitiveTopics.length > 0 ? sensitiveTopics : undefined,
              });
              const result = await executeAgent(agent, {
                stepKey: wfStep.key,
                stepLabel: wfStep.label,
                scenario,
                topicTitle,
                previousSteps: completedOutputs,
                userInstructions: `上一次提交被驳回。驳回反馈如下：\n\n${feedback}\n\n请根据以上反馈修改你的输出。`,
              });
              return result;
            }
          );

          // Save redo output and send for re-approval
          await step.run(`redo-save-${wfStep.key}`, async () => {
            await db
              .update(workflowSteps)
              .set({
                status: "waiting_approval",
                progress: 100,
                output: redoResult.output.summary,
                structuredOutput: redoResult.output,
              })
              .where(eq(workflowSteps.id, wfStep.id));

            await db.insert(teamMessages).values({
              teamId,
              senderType: "ai",
              aiEmployeeId: wfStep.employeeId,
              workflowInstanceId,
              workflowStepKey: wfStep.key,
              type: "decision_request",
              content: `「${wfStep.label}」已根据反馈重新完成，再次等待审批。\n\n${redoResult.output.summary}`,
              actions: [
                {
                  label: "批准",
                  variant: "primary" as const,
                  stepId: wfStep.id,
                },
                {
                  label: "驳回",
                  variant: "destructive" as const,
                  stepId: wfStep.id,
                },
              ],
            });

            await db
              .update(aiEmployees)
              .set({
                status: "idle",
                currentTask: null,
                tasksCompleted: sql`${aiEmployees.tasksCompleted} + 1`,
                avgResponseTime: `${Math.round(redoResult.durationMs / 1000)}s`,
                updatedAt: new Date(),
              })
              .where(eq(aiEmployees.id, wfStep.employeeId!));
          });

          // Wait for second approval
          const secondApproval = await step.waitForEvent(
            "wait-for-redo-approval",
            {
              event: "workflow/step-approved",
              match: "data.workflowInstanceId",
              timeout: "24h",
            }
          );

          if (!secondApproval || !secondApproval.data.approved) {
            // Second rejection or timeout — fail and cancel
            const finalFeedback =
              secondApproval?.data.feedback ?? "二次审批超时";

            await step.run(`final-reject-${wfStep.key}`, async () => {
              await db
                .update(workflowSteps)
                .set({
                  status: "failed",
                  errorMessage: finalFeedback,
                })
                .where(eq(workflowSteps.id, wfStep.id));

              await db.insert(teamMessages).values({
                teamId,
                senderType: "human",
                workflowInstanceId,
                workflowStepKey: wfStep.key,
                type: "status_update",
                content: `「${wfStep.label}」二次审批未通过：${finalFeedback}`,
              });
            });

            await step.run("cancel-workflow-on-final-reject", async () => {
              await db
                .update(workflowInstances)
                .set({ status: "cancelled", completedAt: new Date() })
                .where(eq(workflowInstances.id, workflowInstanceId));
            });
            return { status: "rejected", stepKey: wfStep.key };
          }

          // Second approval passed — mark step as completed
          await step.run(`redo-approve-${wfStep.key}`, async () => {
            await db
              .update(workflowSteps)
              .set({ status: "completed", completedAt: new Date() })
              .where(eq(workflowSteps.id, wfStep.id));
          });

          // Use redo output for subsequent steps
          completedOutputs.push(redoResult.output);
          continue;
        }

        // Approved — mark step as completed
        await step.run(`approve-${wfStep.key}`, async () => {
          await db
            .update(workflowSteps)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(workflowSteps.id, wfStep.id));
        });
      }

      completedOutputs.push(executionResult.output);
    }

    // Step 4: Complete workflow
    await step.run("complete-workflow", async () => {
      await db
        .update(workflowInstances)
        .set({
          status: "completed",
          completedAt: new Date(),
          currentStepKey: null,
        })
        .where(eq(workflowInstances.id, workflowInstanceId));

      await db.insert(teamMessages).values({
        teamId,
        senderType: "ai",
        workflowInstanceId,
        type: "status_update",
        content: `工作流「${topicTitle}」已全部完成！共完成 ${completedOutputs.length} 个步骤。`,
      });

      // Ensure all employees are back to idle after workflow completion
      const employeeIds = workflow.steps
        .filter((s) => s.employeeId)
        .map((s) => s.employeeId!);
      for (const empId of [...new Set(employeeIds)]) {
        await db
          .update(aiEmployees)
          .set({ status: "idle", currentTask: null })
          .where(eq(aiEmployees.id, empId));
      }
    });

    // 2.18: Write pattern memories on workflow completion
    await step.run("learn-from-completion", async () => {
      const uniqueEmployeeIds = [
        ...new Set(
          workflow.steps
            .filter((s) => s.employeeId)
            .map((s) => s.employeeId!)
        ),
      ];
      for (const empId of uniqueEmployeeIds) {
        await db.insert(employeeMemories).values({
          employeeId: empId,
          organizationId: event.data.organizationId,
          memoryType: "pattern",
          content: `成功完成工作流「${topicTitle}」（场景：${scenario}），共 ${completedOutputs.length} 步。`,
          source: `workflow:${workflowInstanceId}`,
          importance: 0.5,
        });
      }
    });

    // Trigger learning engine for involved employees
    await step.run("trigger-learning", async () => {
      const uniqueEmployeeIds = [
        ...new Set(
          workflow.steps
            .filter((s) => s.employeeId)
            .map((s) => s.employeeId!)
        ),
      ];
      for (const empId of uniqueEmployeeIds) {
        await inngest.send({
          name: "employee/learn",
          data: {
            employeeId: empId,
            organizationId: event.data.organizationId,
            trigger: "workflow_completion" as const,
          },
        });
      }
    });

    return {
      status: "completed",
      stepsCompleted: completedOutputs.length,
    };
  }
);
