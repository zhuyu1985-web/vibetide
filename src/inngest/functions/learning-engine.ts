import { inngest } from "../client";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema/ai-employees";
import { employeeMemories } from "@/db/schema/employee-memories";
import { userFeedback } from "@/db/schema/user-feedback";
import { eq, and, count, desc } from "drizzle-orm";

type PatternSource = "human_feedback" | "quality_review" | "self_reflection";

/**
 * Learning engine: processes accumulated feedback and extracts patterns.
 * Triggered by:
 *   - "employee/learn" event (after workflow completion)
 *   - Daily cron at 02:00 Asia/Shanghai
 */
export const learningEngine = inngest.createFunction(
  {
    id: "learning-engine",
  },
  [
    { event: "employee/learn" },
    { cron: "TZ=Asia/Shanghai 0 2 * * *" },
  ],
  async ({ event, step }) => {
    // Determine which employees to process
    const employeeIds = await step.run("resolve-employees", async () => {
      const data = event?.data as Record<string, unknown> | undefined;
      if (data && typeof data.employeeId === "string") {
        return [data.employeeId];
      }
      // Cron: process all employees
      const employees = await db
        .select({ id: aiEmployees.id, organizationId: aiEmployees.organizationId })
        .from(aiEmployees);
      return employees.map((e) => e.id);
    });

    let totalPatternsAdded = 0;

    for (const employeeId of employeeIds) {
      const result = await step.run(`learn-${employeeId}`, async () => {
        // Get employee's organization
        const emp = await db.query.aiEmployees.findFirst({
          where: eq(aiEmployees.id, employeeId),
          columns: { learnedPatterns: true, organizationId: true },
        });
        if (!emp) return { added: 0 };

        const orgId = emp.organizationId;

        // Get feedback stats by stepKey and type
        const feedbackRows = await db
          .select({
            feedbackType: userFeedback.feedbackType,
            stepKey: userFeedback.stepKey,
            cnt: count(),
          })
          .from(userFeedback)
          .where(
            and(
              eq(userFeedback.employeeId, employeeId),
              eq(userFeedback.organizationId, orgId)
            )
          )
          .groupBy(userFeedback.feedbackType, userFeedback.stepKey);

        const patterns = (emp.learnedPatterns ?? {}) as Record<
          string,
          { source: PatternSource; count: number; lastSeen: string }
        >;

        let newPatternsCount = 0;
        const now = new Date().toISOString();

        for (const row of feedbackRows) {
          const feedbackCount = row.cnt;
          const stepKey = row.stepKey || "general";

          // Rejection patterns (threshold: 2+)
          if (row.feedbackType === "reject" && feedbackCount >= 2) {
            const key = `避免: ${stepKey} 步骤常见拒绝原因`;
            if (!patterns[key]) {
              patterns[key] = { source: "human_feedback", count: feedbackCount, lastSeen: now };
              newPatternsCount++;
            } else {
              patterns[key].count = feedbackCount;
              patterns[key].lastSeen = now;
            }
          }

          // Edit patterns (threshold: 3+)
          if (row.feedbackType === "edit" && feedbackCount >= 3) {
            const key = `改进: ${stepKey} 步骤输出需人工调整`;
            if (!patterns[key]) {
              patterns[key] = { source: "human_feedback", count: feedbackCount, lastSeen: now };
              newPatternsCount++;
            } else {
              patterns[key].count = feedbackCount;
              patterns[key].lastSeen = now;
            }
          }

          // Positive reinforcement (threshold: 5+)
          if (row.feedbackType === "accept" && feedbackCount >= 5) {
            const key = `保持: ${stepKey} 步骤输出质量良好`;
            if (!patterns[key]) {
              patterns[key] = { source: "human_feedback", count: feedbackCount, lastSeen: now };
              newPatternsCount++;
            } else {
              patterns[key].count = feedbackCount;
              patterns[key].lastSeen = now;
            }
          }
        }

        // Update employee patterns
        if (newPatternsCount > 0 || feedbackRows.length > 0) {
          await db
            .update(aiEmployees)
            .set({ learnedPatterns: patterns, updatedAt: new Date() })
            .where(eq(aiEmployees.id, employeeId));

          // Record learning memory
          await db.insert(employeeMemories).values({
            employeeId,
            organizationId: orgId,
            memoryType: "feedback",
            content: `学习引擎处理了 ${feedbackRows.length} 组反馈，新增 ${newPatternsCount} 个模式`,
            source: "learning_engine",
            importance: 0.6,
          });
        }

        return { added: newPatternsCount };
      });

      totalPatternsAdded += result.added;
    }

    return {
      employeesProcessed: employeeIds.length,
      totalPatternsAdded,
    };
  }
);
