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
import { compatibleRolesFor } from "@/lib/agent/tool-kinds";

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
  /** 四层重构:工种(craft)slug = ai_employees.roleType。用于"技能→工种"确定性派单。 */
  roleType?: string;
  /** 1 = 工种默认实例(派单优先);0 = 客户配置实例。 */
  isPreset?: number;
  /** 绑定技能的 slug 列表(与 skills 名称一一对应),用于按 slug 匹配 requiredSkill。 */
  skillSlugs?: string[];
  /** 领域一等维度：实例主领域 = ai_employees.domain_id。null/undefined = 通用。 */
  domainId?: string | null;
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
      roleType: aiEmployees.roleType,
      isPreset: aiEmployees.isPreset,
      domainId: aiEmployees.domainId,
      skillName: skills.name,
      skillSlug: skills.slug,
    })
    .from(aiEmployees)
    .leftJoin(employeeSkills, eq(employeeSkills.employeeId, aiEmployees.id))
    .leftJoin(skills, eq(employeeSkills.skillId, skills.id))
    .where(
      and(
        eq(aiEmployees.organizationId, organizationId),
        eq(aiEmployees.disabled, 0),
        // 四层重构:隐藏的 legacy 员工不参与派单(迁移后旧 8+ 员工置 hidden=1,
        // 仅保留供 mission 历史显示)。hidden 列默认 0,迁移前此过滤为 no-op。
        eq(aiEmployees.hidden, 0)
      )
    );

  // Group rows by employee
  const empMap = new Map<string, EmployeeWithSkills>();
  for (const row of rows) {
    let emp = empMap.get(row.id);
    if (!emp) {
      emp = {
        id: row.id,
        slug: row.slug,
        name: row.name,
        title: row.title,
        nickname: row.nickname,
        roleType: row.roleType,
        isPreset: row.isPreset,
        domainId: row.domainId,
        skills: [],
        skillSlugs: [],
      };
      empMap.set(row.id, emp);
    }
    if (row.skillName) {
      emp.skills.push(row.skillName);
    }
    if (row.skillSlug) {
      emp.skillSlugs!.push(row.skillSlug);
    }
  }

  return [...empMap.values()];
}

// ---------------------------------------------------------------------------
// 1.5. pickEmployeeForStep — fast-path step → employee assignment
//
// Used by the workflow-template fast path in BOTH `mission-executor.ts` and
// `inngest/functions/leader-plan.ts`. Without this, both call-sites silently
// fell back to `mission.leaderEmployeeId` whenever a step did not carry an
// explicit `employeeSlug` — and since builtin templates' `step()` factory
// never sets that field, every step in a builtin workflow ended up assigned
// to the same single leader employee (e.g. "科技周报" 5 steps all on xiaowen
// instead of being split across the defaultTeam of 3).
//
// Resolution order:
//   1) Explicit `step.config.employeeSlug` / `step.employeeSlug`
//   1.5) 四层重构:确定性"技能→工种"派单 —— step 声明的 requiredSkill/skillSlug 经
//        compatibleRoles(SKILL_OWNER)解析出工种集,在 org 员工里按 roleType 匹配工种实例
//        (优先 defaultTeam 内 > isPreset=1 默认实例 > 第一个)。仅当员工带 roleType 时生效,
//        因此迁移前(旧员工无新工种 roleType)自动跳过、退回旧逻辑,向后兼容。
//   2) Within `defaultTeam`, the member whose skills include `step.config.skillName`
//   3) Within `defaultTeam`, round-robin by step order
//   4) `null` (caller decides whether to fall back to leader)
// ---------------------------------------------------------------------------

export function pickEmployeeForStep(
  step: {
    order?: number;
    employeeSlug?: string;
    config?: {
      employeeSlug?: string;
      skillName?: string;
      skillSlug?: string;
      requiredSkill?: string;
      requiredCraft?: string;
      domainId?: string | null;
    };
  },
  defaultTeamSlugs: string[],
  employees: EmployeeWithSkills[],
  /** slug → 工种 slug 列表;不传则回退到静态 compatibleRolesFor(覆盖全部 builtin 技能)。 */
  skillCraftMap?: Map<string, string[]>,
): { employee: EmployeeWithSkills | null; domainFallback: boolean } {
  // 1) Explicit assignment wins.
  const explicit = step.config?.employeeSlug ?? step.employeeSlug;
  if (explicit) {
    const e = employees.find((x) => x.slug === explicit);
    if (e) return { employee: e, domainFallback: false };
  }

  // 1.5) 确定性技能→工种派单。requiredCraft 可单独声明工种(无需配套 requiredSkill);
  // 否则由 requiredSkill/skillSlug 经 compatibleRoles 解析工种集。
  const requiredSkill = step.config?.requiredSkill ?? step.config?.skillSlug;
  if (requiredSkill || step.config?.requiredCraft) {
    const craftSet = step.config?.requiredCraft
      ? [step.config.requiredCraft]
      : skillCraftMap?.get(requiredSkill!) ?? compatibleRolesFor(requiredSkill!);
    if (craftSet.length > 0) {
      const candidates = employees.filter(
        (e) => e.roleType && craftSet.includes(e.roleType),
      );
      if (candidates.length > 0) {
        // defaultTeam 内的候选优先(场景显式班子);否则全体候选。
        const inTeam = candidates.filter((e) => defaultTeamSlugs.includes(e.slug));
        let pool = inTeam.length > 0 ? inTeam : candidates;
        // 领域第二因子：指定 domainId 时缩小到该领域实例；无则 fallback 通用实例并标注。
        let domainFallback = false;
        const wantDomain = step.config?.domainId;
        if (wantDomain) {
          const matched = pool.filter((e) => e.domainId === wantDomain);
          if (matched.length > 0) {
            pool = matched;
          } else {
            const generic = pool.filter((e) => !e.domainId);
            pool = generic.length > 0 ? generic : pool;
            domainFallback = true;
          }
        }
        // 同池内:按 craftSet 顺序(core 主人 index 最小→优先),同工种再优先 isPreset=1。
        pool.sort((a, b) => {
          const ia = craftSet.indexOf(a.roleType!);
          const ib = craftSet.indexOf(b.roleType!);
          if (ia !== ib) return ia - ib;
          return (b.isPreset ?? 0) - (a.isPreset ?? 0);
        });
        return { employee: pool[0], domainFallback };
      }
      // craftSet 有但本 org 无对应工种实例 → 落到旧逻辑兜底(迁移前/数据缺失场景)。
    }
  }

  // 2/3) Restrict candidate pool to defaultTeam members. If the template did
  // not specify a defaultTeam, fall through to caller (returns null).
  if (defaultTeamSlugs.length === 0) return { employee: null, domainFallback: false };
  const teamMembers = defaultTeamSlugs
    .map((slug) => employees.find((e) => e.slug === slug))
    .filter((e): e is EmployeeWithSkills => Boolean(e));
  if (teamMembers.length === 0) return { employee: null, domainFallback: false };

  // 2) Skill-name match: the step declares a skill name; pick the team member
  // who actually has that skill bound. employee_skills stores the human-
  // readable name (`skills.name`), which is what `step.config.skillName` holds.
  const skillName = step.config?.skillName;
  if (skillName) {
    const skilled = teamMembers.find((e) => e.skills.includes(skillName));
    if (skilled) return { employee: skilled, domainFallback: false };
  }

  // 3) Round-robin by step order so consecutive steps spread across the team.
  // step.order is 1-based in the seed, but defensively handle 0/undefined.
  const order = Math.max(1, step.order ?? 1);
  return {
    employee: teamMembers[(order - 1) % teamMembers.length] ?? null,
    domainFallback: false,
  };
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
      // 保留 outputData 全部字段（如 topics / results / articles），只为缺失的
      // StepOutput 必填字段补 default。让 {{stepN.field}} 模板能引用工具/skill
      // 真实输出的字段（A.1.2.5 修：原版显式重映射会 strip 未知字段）。
      return {
        ...output,
        stepKey: t!.id,
        employeeSlug: (output.employeeSlug || "xiaolei") as EmployeeId,
        summary: output.summary || "",
        artifacts: output.artifacts || [],
        metrics: output.metrics,
        status: output.status || "success",
      } as StepOutput;
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

// depth_level → 目标正文字数（精品内容/深度大稿类场景）
const DEPTH_LEVEL_WORD_COUNT: Record<string, number> = {
  standard: 2500,
  deep: 3500,
  investigative: 5000,
};

/**
 * 从 mission.inputParams 推断目标字数。
 * 优先级：显式 targetWordCount > depth_level 映射 > undefined（由 LLM 自定）
 */
function inferTargetWordCount(
  inputParams: Record<string, unknown> | null | undefined,
): number | undefined {
  if (!inputParams) return undefined;
  const explicit = inputParams.targetWordCount ?? inputParams.target_word_count;
  if (typeof explicit === "number" && explicit > 0) return explicit;
  const depth = inputParams.depth_level ?? inputParams.depthLevel;
  if (typeof depth === "string" && DEPTH_LEVEL_WORD_COUNT[depth]) {
    return DEPTH_LEVEL_WORD_COUNT[depth];
  }
  return undefined;
}

export function buildConsolidatePrompt(
  mission: {
    title: string;
    scenario: string;
    userInstruction: string;
    inputParams?: Record<string, unknown> | null;
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

  const targetWords = inferTargetWordCount(mission.inputParams);
  const wordCountSection = targetWords
    ? `\n## 字数要求（强制）
最终稿件正文不少于 ${targetWords} 字（当前目标：${targetWords} 字左右，允许 ±10%）。
- 不要只输出 bullet 摘要
- 不要写"详见各子任务"这种占位
- 正文放到 artifact 的 content 字段，并在 body / content 字段同步一份完整稿件，便于入库\n`
    : "";

  return `你是任务总监，所有子任务已经完成。请汇总所有成果，生成最终的交付物。

## 任务信息
标题：${mission.title}
场景：${mission.scenario}
用户指令：${mission.userInstruction}

## 各子任务执行结果
${taskOutputsText}
${messagesSection}${wordCountSection}
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
