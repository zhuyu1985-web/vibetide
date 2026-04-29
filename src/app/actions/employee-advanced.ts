"use server";

import { db } from "@/db";
import { aiEmployees } from "@/db/schema/ai-employees";
import { skills, employeeSkills } from "@/db/schema/skills";
import { skillCombos } from "@/db/schema/skill-combos";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  getConfigVersion,
  createConfigVersion,
  getSkillCombo,
} from "@/lib/dal/employee-advanced";
import { getCurrentUserOrg } from "@/lib/dal/auth";
// ---------------------------------------------------------------------------
// Helper: snapshot current employee config
// ---------------------------------------------------------------------------
async function snapshotEmployee(employeeId: string) {
  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
  });
  if (!emp) throw new Error("Employee not found");

  return {
    name: emp.name,
    nickname: emp.nickname,
    title: emp.title,
    motto: emp.motto,
    roleType: emp.roleType,
    authorityLevel: emp.authorityLevel,
    autoActions: emp.autoActions,
    needApprovalActions: emp.needApprovalActions,
    workPreferences: emp.workPreferences,
    learnedPatterns: emp.learnedPatterns,
    status: emp.status,
    disabled: emp.disabled,
  };
}

// ---------------------------------------------------------------------------
// M4.F09: Rollback employee config to a previous version
// ---------------------------------------------------------------------------
export async function rollbackEmployeeConfig(
  employeeId: string,
  versionId: string
) {
  const user = await requireAuth();

  const version = await getConfigVersion(versionId);
  if (!version) throw new Error("Version not found");
  if (version.employeeId !== employeeId)
    throw new Error("Version does not belong to this employee");

  const snapshot = version.snapshot as Record<string, unknown>;

  // Apply snapshot fields to the employee
  await db
    .update(aiEmployees)
    .set({
      name: snapshot.name as string,
      nickname: snapshot.nickname as string,
      title: snapshot.title as string,
      motto: (snapshot.motto as string) || null,
      roleType: snapshot.roleType as string,
      authorityLevel: snapshot.authorityLevel as
        | "observer"
        | "advisor"
        | "executor"
        | "coordinator",
      autoActions: snapshot.autoActions as string[],
      needApprovalActions: snapshot.needApprovalActions as string[],
      workPreferences: snapshot.workPreferences as {
        proactivity: string;
        reportingFrequency: string;
        autonomyLevel: number;
        communicationStyle: string;
        workingHours: string;
      } | null,
      updatedAt: new Date(),
    })
    .where(eq(aiEmployees.id, employeeId));

  // Create a new version record marking the rollback
  const currentSnapshot = await snapshotEmployee(employeeId);
  await createConfigVersion(
    employeeId,
    currentSnapshot,
    user.id,
    ["rollback"],
    `回滚到版本 v${version.version}`
  );

  revalidatePath("/employee");
  return { success: true };
}

// ---------------------------------------------------------------------------
// M4.F19: Auto adjust authority level based on performance metrics
// ---------------------------------------------------------------------------
const AUTHORITY_LEVELS = [
  "observer",
  "advisor",
  "executor",
  "coordinator",
] as const;

export async function adjustAuthorityByPerformance(employeeId: string) {
  const user = await requireAuth();

  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
  });
  if (!emp) throw new Error("Employee not found");

  const { tasksCompleted, accuracy, satisfaction } = emp;
  const currentLevel = emp.authorityLevel;
  const currentIdx = AUTHORITY_LEVELS.indexOf(
    currentLevel as (typeof AUTHORITY_LEVELS)[number]
  );

  let newLevel = currentLevel;
  let reason = "";

  // Upgrade rule: high performance across the board
  if (
    accuracy >= 95 &&
    satisfaction >= 90 &&
    tasksCompleted >= 50 &&
    currentIdx < AUTHORITY_LEVELS.length - 1
  ) {
    newLevel = AUTHORITY_LEVELS[currentIdx + 1];
    reason = `绩效优秀（准确率 ${accuracy}%、满意度 ${satisfaction}%、已完成 ${tasksCompleted} 任务）自动升级`;
  }
  // Downgrade rule: poor performance
  else if ((accuracy < 60 || satisfaction < 50) && currentIdx > 0) {
    newLevel = AUTHORITY_LEVELS[currentIdx - 1];
    reason = `绩效不达标（准确率 ${accuracy}%、满意度 ${satisfaction}%）自动降级`;
  }

  if (newLevel === currentLevel) {
    return {
      success: true,
      changed: false,
      currentLevel,
      message: "当前绩效指标不满足调整条件，权限等级保持不变",
    };
  }

  // Record current state before change
  const beforeSnapshot = await snapshotEmployee(employeeId);
  await createConfigVersion(
    employeeId,
    beforeSnapshot,
    user.id,
    ["authorityLevel"],
    `权限变更前快照: ${currentLevel}`
  );

  // Apply the change
  await db
    .update(aiEmployees)
    .set({
      authorityLevel: newLevel as
        | "observer"
        | "advisor"
        | "executor"
        | "coordinator",
      updatedAt: new Date(),
    })
    .where(eq(aiEmployees.id, employeeId));

  // Record after change
  const afterSnapshot = await snapshotEmployee(employeeId);
  await createConfigVersion(
    employeeId,
    afterSnapshot,
    user.id,
    ["authorityLevel"],
    reason
  );

  revalidatePath("/employee");
  return {
    success: true,
    changed: true,
    previousLevel: currentLevel,
    newLevel,
    reason,
  };
}

// ---------------------------------------------------------------------------
// M4.F32: Test skill execution (with real tool invocation when available)
// ---------------------------------------------------------------------------
export async function testSkillExecution(
  skillId: string,
  testInput: string
) {
  await requireAuth();

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
  });
  if (!skill) throw new Error("Skill not found");

  const inputSchema = (skill.inputSchema as Record<string, string>) || {};
  const outputSchema = (skill.outputSchema as Record<string, string>) || {};
  const runtimeConfig = skill.runtimeConfig as {
    type?: string;
    avgLatencyMs?: number;
    maxConcurrency?: number;
    modelDependency?: string;
  } | null;

  // Build system prompt from skill metadata + SKILL.md content
  const systemPromptParts: string[] = [
    `# 角色`,
    `你是技能「${skill.name}」的执行引擎。`,
    `技能类别：${skill.category}`,
    `技能描述：${skill.description}`,
  ];

  if (skill.content) {
    systemPromptParts.push("", "# 技能说明文档 (SKILL.md)", skill.content);
  }

  if (Object.keys(inputSchema).length > 0) {
    systemPromptParts.push(
      "",
      "# 输入规格",
      ...Object.entries(inputSchema).map(([k, v]) => `- ${k}: ${v}`)
    );
  }

  if (Object.keys(outputSchema).length > 0) {
    systemPromptParts.push(
      "",
      "# 输出规格",
      ...Object.entries(outputSchema).map(([k, v]) => `- ${k}: ${v}`)
    );
  }

  systemPromptParts.push(
    "",
    "# 输出要求",
    "- 所有输出使用中文",
    "- 使用结构化 Markdown 格式",
    "- 先给出简要摘要，再展开详细内容",
    "- 输出末尾附上质量自评：【质量自评：XX/100】",
    "  评分标准：完整性(30%)、准确性(30%)、创意性(20%)、格式规范(20%)"
  );

  const systemPrompt = systemPromptParts.join("\n");

  // Resolve model: use DeepSeek via OpenAI-compatible API
  const resolvedProvider = "openai";
  const resolvedModel = process.env.OPENAI_MODEL || "deepseek-chat";

  if (!process.env.OPENAI_API_KEY) {
    return {
      skillName: skill.name,
      skillCategory: skill.category,
      skillVersion: skill.version,
      description: skill.description,
      testInput,
      inputSchema,
      outputSchema,
      runtimeInfo: {
        type: "无可用模型",
        estimatedLatency: "N/A",
        maxConcurrency: 0,
        modelDependency: "无",
      },
      expectedBehavior: "",
      executionResult: {
        success: false,
        error: "未配置 OPENAI_API_KEY。请在 .env.local 中配置。",
        durationMs: 0,
      },
      validationChecks: [{
        check: "API 密钥检查",
        status: "fail",
        detail: "未配置 OPENAI_API_KEY",
      }],
    };
  }

  let executionResult: {
    success: boolean;
    output?: string;
    error?: string;
    durationMs: number;
    tokensUsed?: { input: number; output: number };
    modelUsed: string;
  };

  try {
    const { generateText, stepCountIs } = await import("ai");
    const { getLanguageModel } = await import("@/lib/agent/model-router");
    const { resolveTools, toVercelTools } = await import("@/lib/agent/tool-registry");

    const model = getLanguageModel({
      provider: resolvedProvider as "zhipu" | "openai",
      model: resolvedModel,
      temperature: 0.5,
      maxTokens: 4096,
    });

    const agentTools = resolveTools([skill.name]);
    const pluginConfigs =
      skill.type === "plugin" && skill.pluginConfig
        ? new Map([
            [
              skill.name,
              {
                description: skill.description,
                config: skill.pluginConfig as {
                  endpoint: string;
                  method?: "GET" | "POST";
                  headers?: Record<string, string>;
                  authType?: "none" | "api_key" | "bearer";
                  authKey?: string;
                  requestTemplate?: string;
                  responseMapping?: Record<string, string>;
                  timeoutMs?: number;
                },
              },
            ],
          ])
        : undefined;
    const vercelTools = toVercelTools(agentTools, pluginConfigs);

    const startTime = Date.now();
    const result = await generateText({
      model,
      system: `${systemPrompt}\n\n# 工具调用要求\n- 如提供了可用工具，优先调用工具获取真实结果，不要凭空编造实时信息。\n- 若工具返回结构化结果，需基于工具结果整理中文 Markdown 输出。`,
      messages: [{ role: "user", content: `请按技能要求执行以下任务：\n${testInput}` }],
      tools: vercelTools,
      stopWhen: stepCountIs(5),
      temperature: 0.5,
      maxOutputTokens: 4096,
    });

    executionResult = {
      success: true,
      output: result.text,
      durationMs: Date.now() - startTime,
      tokensUsed: {
        input: result.usage?.inputTokens ?? 0,
        output: result.usage?.outputTokens ?? 0,
      },
      modelUsed: `${resolvedProvider}:${resolvedModel}`,
    };
  } catch (err) {
    executionResult = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: 0,
      modelUsed: `${resolvedProvider}:${resolvedModel}`,
    };
  }

  // Extract quality score from LLM output
  let qualityScore: number | undefined;
  if (executionResult.output) {
    const match = executionResult.output.match(/【质量自评[：:](\d+)\/100】/);
    if (match) qualityScore = parseInt(match[1], 10);
  }

  const testPlan = {
    skillName: skill.name,
    skillCategory: skill.category,
    skillVersion: skill.version,
    description: skill.description,
    testInput,
    inputSchema,
    outputSchema,
    runtimeInfo: {
      type: `LLM (${resolvedModel})`,
      estimatedLatency: executionResult.durationMs
        ? `${executionResult.durationMs}ms`
        : runtimeConfig?.avgLatencyMs
        ? `${runtimeConfig.avgLatencyMs}ms`
        : "未知",
      maxConcurrency: runtimeConfig?.maxConcurrency || 1,
      modelDependency: executionResult.modelUsed,
    },
    expectedBehavior: executionResult.success && executionResult.output
      ? executionResult.output.slice(0, 3000)
      : `技能「${skill.name}」(${skill.category}) 执行失败`,
    executionResult: {
      success: executionResult.success,
      output: executionResult.output?.slice(0, 3000),
      error: executionResult.error,
      durationMs: executionResult.durationMs,
    },
    validationChecks: [
      {
        check: "输入格式验证",
        status: testInput.trim().length > 0 ? "pass" : "fail",
        detail: testInput.trim().length > 0
          ? "输入内容非空，格式有效"
          : "输入内容为空",
      },
      {
        check: "模型调用",
        status: executionResult.success ? "pass" : "fail",
        detail: executionResult.success
          ? `${resolvedModel} 调用成功，耗时 ${executionResult.durationMs}ms`
          : `${resolvedModel} 调用失败: ${executionResult.error}`,
      },
      ...(executionResult.tokensUsed
        ? [
            {
              check: "Token 消耗",
              status: "info" as const,
              detail: `输入 ${executionResult.tokensUsed.input} + 输出 ${executionResult.tokensUsed.output} = ${executionResult.tokensUsed.input + executionResult.tokensUsed.output} tokens`,
            },
          ]
        : []),
      {
        check: "质量自评",
        status: qualityScore != null
          ? qualityScore >= 60 ? "pass" : "fail"
          : "info",
        detail: qualityScore != null
          ? `自评得分 ${qualityScore}/100`
          : "未提取到质量自评分数",
      },
    ],
  };

  return testPlan;
}

// ---------------------------------------------------------------------------
// Preview system prompt for an employee
// ---------------------------------------------------------------------------
export async function previewSystemPrompt(employeeId: string) {
  await requireAuth();

  const { assembleAgent } = await import("@/lib/agent/assembly");
  const agent = await assembleAgent(employeeId);

  return {
    systemPrompt: agent.systemPrompt.slice(0, 8000),
    totalLength: agent.systemPrompt.length,
    toolCount: agent.tools.length,
    toolNames: agent.tools.map((t) => t.name),
  };
}

// ---------------------------------------------------------------------------
// M4.F41: Skill Combo CRUD
// ---------------------------------------------------------------------------
export async function createSkillCombo(
  name: string,
  description: string,
  skillIds: string[]
) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("Organization not found");

  if (skillIds.length < 2) {
    throw new Error("技能组合至少需要 2 个技能");
  }

  // Validate all skills exist
  const existingSkills = await db
    .select({ id: skills.id })
    .from(skills)
    .where(inArray(skills.id, skillIds));

  if (existingSkills.length !== skillIds.length) {
    const found = new Set(existingSkills.map((s) => s.id));
    const missing = skillIds.filter((id) => !found.has(id));
    throw new Error(`以下技能不存在: ${missing.join(", ")}`);
  }

  const [combo] = await db
    .insert(skillCombos)
    .values({
      organizationId: orgId,
      name,
      description: description || null,
      skillIds,
      config: { sequential: true, passOutput: true },
    })
    .returning();

  revalidatePath("/employee");
  return combo;
}

export async function deleteSkillCombo(comboId: string) {
  await requireAuth();

  await db.delete(skillCombos).where(eq(skillCombos.id, comboId));
  revalidatePath("/employee");
}

export async function applySkillCombo(
  employeeId: string,
  comboId: string
) {
  await requireAuth();

  const combo = await getSkillCombo(comboId);
  if (!combo) throw new Error("Skill combo not found");

  const comboSkillIds = combo.skillIds as string[];

  // Get existing bindings for this employee
  const existingBindings = await db
    .select({ skillId: employeeSkills.skillId })
    .from(employeeSkills)
    .where(eq(employeeSkills.employeeId, employeeId));
  const existingSet = new Set(existingBindings.map((b) => b.skillId));

  // Bind skills not already bound
  let bound = 0;
  for (const skillId of comboSkillIds) {
    if (!existingSet.has(skillId)) {
      await db.insert(employeeSkills).values({
        employeeId,
        skillId,
        level: 50,
        bindingType: "extended",
      });
      bound++;
    }
  }

  revalidatePath("/employee");
  revalidatePath("/missions");
  return { success: true, bound, skipped: comboSkillIds.length - bound };
}

// ---------------------------------------------------------------------------
// M4.F09: Save current employee config as a version
// ---------------------------------------------------------------------------
export async function saveEmployeeConfigVersion(
  employeeId: string,
  changedFields: string[],
  changeDescription?: string
) {
  const user = await requireAuth();
  const snapshot = await snapshotEmployee(employeeId);
  const version = await createConfigVersion(
    employeeId,
    snapshot,
    user.id,
    changedFields,
    changeDescription
  );
  return version;
}
