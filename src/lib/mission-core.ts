/**
 * Mission Core — shared pure/quasi-pure functions used by both the direct
 * executor (`mission-executor.ts`) and the Inngest functions
 * (`leader-plan.ts`, `execute-mission-task.ts`, `leader-consolidate.ts`).
 *
 * Extracting them here eliminates duplication while keeping every call-site's
 * external behaviour unchanged.
 */

import { db } from "@/db";
import {
  aiEmployees,
  employeeSkills,
  skills,
  missionTasks,
  missionMessages,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { StepOutput } from "@/lib/agent";
import type { EmployeeId } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types used across call-sites
// ---------------------------------------------------------------------------

export interface EmployeeWithSkills {
  id: string;
  slug: string;
  name: string;
  title: string;
  nickname: string;
  skills: string[];
}

export interface ParsedTaskDef {
  title: string;
  description: string;
  expectedOutput?: string;
  assignedEmployeeSlug: string;
  priority?: number;
  dependsOn?: number[];
}

// ---------------------------------------------------------------------------
// 1. loadAvailableEmployees — load non-disabled employees with their skills
// ---------------------------------------------------------------------------

export async function loadAvailableEmployees(
  organizationId: string
): Promise<EmployeeWithSkills[]> {
  // Single query with LEFT JOIN to fetch employees + skills together (replaces N+1 pattern)
  const rows = await db
    .select({
      id: aiEmployees.id,
      slug: aiEmployees.slug,
      name: aiEmployees.name,
      title: aiEmployees.title,
      nickname: aiEmployees.nickname,
      skillName: skills.name,
    })
    .from(aiEmployees)
    .leftJoin(employeeSkills, eq(employeeSkills.employeeId, aiEmployees.id))
    .leftJoin(skills, eq(employeeSkills.skillId, skills.id))
    .where(
      and(
        eq(aiEmployees.organizationId, organizationId),
        eq(aiEmployees.disabled, 0)
      )
    );

  // Group rows by employee
  const empMap = new Map<string, EmployeeWithSkills>();
  for (const row of rows) {
    let emp = empMap.get(row.id);
    if (!emp) {
      emp = { id: row.id, slug: row.slug, name: row.name, title: row.title, nickname: row.nickname, skills: [] };
      empMap.set(row.id, emp);
    }
    if (row.skillName) {
      emp.skills.push(row.skillName);
    }
  }

  return [...empMap.values()];
}

// ---------------------------------------------------------------------------
// 2. buildLeaderDecomposePrompt — build the prompt the leader uses to
//    decompose a mission into sub-tasks (content identical to both files)
// ---------------------------------------------------------------------------

export function buildLeaderDecomposePrompt(
  mission: { userInstruction: string; scenario: string; title: string },
  employeesWithSkills: Array<{
    slug: string;
    name: string;
    nickname: string;
    title: string;
    skills: string[];
  }>
): string {
  const employeeListText = employeesWithSkills
    .map(
      (emp) =>
        `- slug: ${emp.slug} | 名称: ${emp.name}（${emp.nickname}） | 职位: ${emp.title} | 技能: ${emp.skills.join("、") || "无"}`
    )
    .join("\n");

  return `你是任务总监，需要将用户的指令分解为多个子任务，并分配给合适的团队成员。

## 用户指令
${mission.userInstruction}

## 任务场景
${mission.scenario}

## 任务标题
${mission.title}

## 可用团队成员
${employeeListText}

## 要求
1. 分析用户指令，拆解为具体的子任务
2. 为每个子任务选择最合适的执行人（基于其技能）
3. 确定子任务之间的依赖关系（哪些任务必须在其他任务完成后才能开始）
4. 每个子任务需要有清晰的标题、详细描述和期望输出

## 输出格式
请严格按照以下 JSON 格式输出，不要包含任何其他文本：

\`\`\`json
{
  "tasks": [
    {
      "title": "子任务标题",
      "description": "详细描述，包括具体要求和注意事项",
      "expectedOutput": "期望的输出内容描述",
      "assignedEmployeeSlug": "employee_slug",
      "priority": 1,
      "dependsOn": []
    },
    {
      "title": "第二个子任务",
      "description": "详细描述",
      "expectedOutput": "期望输出",
      "assignedEmployeeSlug": "employee_slug",
      "priority": 0,
      "dependsOn": [0]
    }
  ]
}
\`\`\`

注意：
- dependsOn 使用任务在数组中的索引（从 0 开始），表示依赖哪些前置任务
- priority 数值越大越重要
- 确保不要产生循环依赖
- **子任务数量不得超过 10 个**。请精简合并同类任务，避免重复。每个成员最多分配 2 个子任务
- 不要为同一类型的工作创建多个子任务（如"信息搜集"只需一个任务，不要拆成多个）`;
}

// ---------------------------------------------------------------------------
// 3. parseLeaderOutput — extract JSON task list from the leader's output
//    with a fallback when parsing fails
// ---------------------------------------------------------------------------

export function parseLeaderOutput(
  outputText: string,
  fallback: { title: string; instruction: string; defaultSlug: string }
): { tasks: ParsedTaskDef[] } {
  let jsonStr = outputText;

  // Try markdown code block first
  const jsonMatch = outputText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Try raw JSON object
    const rawJsonMatch = outputText.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
    if (rawJsonMatch) jsonStr = rawJsonMatch[0];
  }

  let parsed: { tasks: ParsedTaskDef[] };

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback: create a single task with the full instruction
    parsed = {
      tasks: [
        {
          title: fallback.title,
          description: fallback.instruction,
          assignedEmployeeSlug: fallback.defaultSlug,
          priority: 1,
          dependsOn: [],
        },
      ],
    };
  }

  if (!parsed.tasks || parsed.tasks.length === 0) {
    throw new Error("Leader did not produce any tasks");
  }

  // Cap at 10 tasks — truncate excess and fix broken dependency refs
  const MAX_TASKS = 10;
  if (parsed.tasks.length > MAX_TASKS) {
    console.warn(`[mission-core] Leader produced ${parsed.tasks.length} tasks, truncating to ${MAX_TASKS}`);
    parsed.tasks = parsed.tasks.slice(0, MAX_TASKS);
    // Remove dependency refs that point beyond the truncated array
    for (const task of parsed.tasks) {
      if (task.dependsOn) {
        task.dependsOn = task.dependsOn.filter((idx) => idx >= 0 && idx < MAX_TASKS);
      }
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// 4. validateDAG — topological-sort cycle detection
// ---------------------------------------------------------------------------

export function validateDAG(
  tasks: Array<{ dependsOn?: number[] }>
): { valid: boolean; error?: string } {
  const n = tasks.length;

  // Check self-references
  for (let i = 0; i < n; i++) {
    if (tasks[i].dependsOn?.includes(i)) {
      return { valid: false, error: `任务 ${i} 存在自引用依赖` };
    }
  }

  // Check out-of-bounds indices
  for (let i = 0; i < n; i++) {
    for (const dep of tasks[i].dependsOn || []) {
      if (dep < 0 || dep >= n) {
        return {
          valid: false,
          error: `任务 ${i} 的依赖索引 ${dep} 越界`,
        };
      }
    }
  }

  // Kahn's algorithm — topological sort
  const inDegree = new Array(n).fill(0);
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (const dep of tasks[i].dependsOn || []) {
      adj[dep].push(i);
      inDegree[i]++;
    }
  }

  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  let processed = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    processed++;
    for (const next of adj[node]) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }

  if (processed < n) {
    return { valid: false, error: "任务之间存在循环依赖" };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// 5. loadDependencyOutputs — load outputs of upstream tasks as StepOutput[]
// ---------------------------------------------------------------------------

export async function loadDependencyOutputs(
  deps: string[]
): Promise<StepOutput[]> {
  if (deps.length === 0) return [];

  const depTasks = await Promise.all(
    deps.map((depId) =>
      db.query.missionTasks.findFirst({
        where: eq(missionTasks.id, depId),
      })
    )
  );

  return depTasks
    .filter((t) => t && t.outputData)
    .map((t) => {
      const output = t!.outputData as StepOutput;
      return {
        stepKey: t!.id,
        employeeSlug: (output.employeeSlug || "xiaolei") as EmployeeId,
        summary: output.summary || "",
        artifacts: output.artifacts || [],
        metrics: output.metrics,
        status: output.status || "success",
      } satisfies StepOutput;
    });
}

// ---------------------------------------------------------------------------
// 6. loadEmployeeMessages — load messages addressed to an employee in a
//    specific mission
// ---------------------------------------------------------------------------

export async function loadEmployeeMessages(
  missionId: string,
  employeeId: string
): Promise<string> {
  const msgs = await db
    .select({ content: missionMessages.content })
    .from(missionMessages)
    .where(
      and(
        eq(missionMessages.missionId, missionId),
        eq(missionMessages.toEmployeeId, employeeId)
      )
    );

  return msgs.map((m) => m.content).join("\n\n");
}

// ---------------------------------------------------------------------------
// 7. buildConsolidatePrompt — build the consolidation prompt for the leader
// ---------------------------------------------------------------------------

export function buildConsolidatePrompt(
  mission: {
    title: string;
    scenario: string;
    userInstruction: string;
  },
  completedTasks: Array<{
    title: string;
    description: string;
    outputData: unknown;
  }>,
  options?: { messagesText?: string }
): string {
  const taskOutputsText = completedTasks
    .map((t, i) => {
      const output = t.outputData as StepOutput | null;
      const summary = output?.summary || "（无输出）";
      const artifacts = output?.artifacts || [];
      const artifactText =
        artifacts.length > 0
          ? artifacts
              .map(
                (a) =>
                  `  - [${a.type}] ${a.title}: ${a.content.slice(0, 500)}`
              )
              .join("\n")
          : "";
      return `### 子任务 ${i + 1}：${t.title}\n${t.description}\n\n**执行结果：**\n${summary}${artifactText ? `\n\n**产出物：**\n${artifactText}` : ""}`;
    })
    .join("\n\n---\n\n");

  const messagesSection = options?.messagesText
    ? `\n## 任务过程中的沟通记录\n${options.messagesText}\n`
    : "";

  return `你是任务总监，所有子任务已经完成。请汇总所有成果，生成最终的交付物。

## 任务信息
标题：${mission.title}
场景：${mission.scenario}
用户指令：${mission.userInstruction}

## 各子任务执行结果
${taskOutputsText}
${messagesSection}
## 要求
1. 综合所有子任务的产出，整合为一份完整、连贯的最终交付物
2. 确保内容质量和一致性
3. 如有冲突或遗漏，请指出并给出建议
4. 最终输出应当直接可用，不需要额外编辑`;
}

// ---------------------------------------------------------------------------
// 8. mapTaskOutputsToStepOutputs — convert raw task rows to StepOutput[]
// ---------------------------------------------------------------------------

export function mapTaskOutputsToStepOutputs(
  tasks: Array<{ id: string; outputData: unknown }>
): StepOutput[] {
  return tasks
    .filter((t) => t.outputData)
    .map((t) => {
      const output = t.outputData as StepOutput;
      return {
        stepKey: t.id,
        employeeSlug: (output.employeeSlug || "xiaolei") as EmployeeId,
        summary: output.summary || "",
        artifacts: output.artifacts || [],
        metrics: output.metrics,
        status: output.status || "success",
      } satisfies StepOutput;
    });
}

// ---------------------------------------------------------------------------
// 9. checkTokenBudget — verify remaining budget before spending tokens
// ---------------------------------------------------------------------------

export function checkTokenBudget(
  mission: { tokensUsed: number; tokenBudget: number },
  estimatedTokens: number = 0
): { allowed: boolean; remaining: number } {
  const remaining = mission.tokenBudget - mission.tokensUsed;
  return { allowed: remaining > estimatedTokens, remaining };
}
