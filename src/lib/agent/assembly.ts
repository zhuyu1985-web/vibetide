import { db } from "@/db";
import {
  aiEmployees,
  employeeSkills,
  skills,
  employeeKnowledgeBases,
  knowledgeBases,
  employeeMemories,
} from "@/db/schema";
import { eq, desc, and, gt, sql } from "drizzle-orm";
import { READ_ONLY_TOOL_NAMES, type EmployeeId } from "@/lib/constants";
import type { SkillCategory } from "@/lib/types";
import { loadSkillContent, getBuiltinSkillNameToSlug } from "@/lib/skill-loader";
import { buildSystemPrompt } from "./prompt-templates";
import { resolveModelConfig } from "./model-router";
import { resolveTools } from "./tool-registry";
import type { AssembledAgent, ModelConfig } from "./types";

/**
 * Assemble a fully configured Agent from DB data.
 *
 * Loads employee profile, skills, and knowledge bases,
 * then builds system prompt, resolves tools, and picks model.
 */
export async function assembleAgent(
  employeeId: string,
  modelOverride?: Partial<ModelConfig>,
  context?: { sensitiveTopics?: string[]; skillOverrides?: string[] }
): Promise<AssembledAgent> {
  // 1. Load employee + skills + knowledge bases + memories in parallel
  const [employee, empSkills, empKBs, memoryRows] = await Promise.all([
    db.query.aiEmployees.findFirst({
      where: eq(aiEmployees.id, employeeId),
    }),
    db
      .select({
        skillName: skills.name,
        skillSlug: skills.slug,
        skillCategory: skills.category,
        skillDescription: skills.description,
        skillContent: skills.content,
        skillType: skills.type,
        pluginConfig: skills.pluginConfig,
        level: employeeSkills.level,
      })
      .from(employeeSkills)
      .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
      .where(eq(employeeSkills.employeeId, employeeId)),
    db
      .select({
        kbId: knowledgeBases.id,
        kbName: knowledgeBases.name,
        kbDescription: knowledgeBases.description,
        kbType: knowledgeBases.type,
      })
      .from(employeeKnowledgeBases)
      .innerJoin(
        knowledgeBases,
        eq(employeeKnowledgeBases.knowledgeBaseId, knowledgeBases.id)
      )
      .where(eq(employeeKnowledgeBases.employeeId, employeeId)),
    db
      .select({
        id: employeeMemories.id,
        content: employeeMemories.content,
        memoryType: employeeMemories.memoryType,
        importance: employeeMemories.importance,
        confidence: employeeMemories.confidence,
        decayRate: employeeMemories.decayRate,
      })
      .from(employeeMemories)
      .where(and(eq(employeeMemories.employeeId, employeeId), gt(employeeMemories.confidence, 0.3)))
      .orderBy(desc(employeeMemories.importance))
      .limit(10),
  ]);

  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  // Update access stats for loaded memories (fire-and-forget)
  if (memoryRows.length > 0) {
    Promise.all(
      memoryRows.map((m) =>
        db
          .update(employeeMemories)
          .set({
            accessCount: sql`${employeeMemories.accessCount} + 1`,
            lastAccessedAt: new Date(),
          })
          .where(eq(employeeMemories.id, m.id))
      )
    ).catch((err) =>
      console.error("[assembly] Memory access update failed:", err)
    );
  }

  const skillNames = empSkills.map((s) => s.skillName);
  const skillCategories = [
    ...new Set(empSkills.map((s) => s.skillCategory)),
  ] as SkillCategory[];

  const knowledgeContext = empKBs.length > 0
    ? empKBs
        .map((kb) => `- ${kb.kbName}${kb.kbDescription ? `：${kb.kbDescription}` : ""}`)
        .join("\n")
    : "";

  const memories = memoryRows.map((m) => ({
    content: m.content,
    memoryType: m.memoryType,
    importance: m.importance,
  }));

  // 3c. Compute average proficiency level
  const avgLevel =
    empSkills.length > 0
      ? Math.round(
          empSkills.reduce((sum, s) => sum + s.level, 0) / empSkills.length
        )
      : 50;

  // 3d. Build skill contents map for prompt injection
  // Builtin skills: load content from SKILL.md files (file system)
  // Custom/plugin skills: load content from DB
  const nameToSlug = getBuiltinSkillNameToSlug();
  const skillContents: Record<string, string> = {};
  for (const s of empSkills) {
    if (s.skillType === "builtin") {
      const slug = s.skillSlug ?? nameToSlug.get(s.skillName) ?? s.skillName;
      const fileContent = loadSkillContent(slug);
      if (fileContent) {
        skillContents[s.skillName] = fileContent;
      }
    } else if (s.skillContent) {
      skillContents[s.skillName] = s.skillContent;
    }
  }

  // 4. Build tools (filtered by authority level)
  const readOnlyToolNames = new Set<string>(READ_ONLY_TOOL_NAMES);
  const resolvedTools = resolveTools(skillNames);

  let tools = resolvedTools;
  if (employee.authorityLevel === "observer") {
    tools = [];
  } else if (employee.authorityLevel === "advisor") {
    tools = resolvedTools.filter((tool) => readOnlyToolNames.has(tool.name));
  }

  // Intent-based skill override: restrict tools to the specified set
  if (context?.skillOverrides && context.skillOverrides.length > 0) {
    const overrideSet = new Set(context.skillOverrides);
    tools = tools.filter((tool) => overrideSet.has(tool.name));
  }

  // Auto-inject kb_search descriptor when employee has KB bindings.
  // The actual tool implementation is built at execution time via createKnowledgeBaseTools.
  if (empKBs.length > 0 && employee.authorityLevel !== "observer") {
    tools = [
      ...tools,
      {
        name: "kb_search",
        description: "在你绑定的知识库中按语义检索相关内容片段。需要参考组织内部资料、风格指南、敏感词或领域知识时使用。",
        parameters: {},
      },
    ];
  }

  // 4b. Build plugin configs map for plugin-type skills
  type PluginEntry = NonNullable<AssembledAgent["pluginConfigs"]> extends Map<string, infer V> ? V : never;
  const pluginConfigs = new Map<string, PluginEntry>();
  for (const s of empSkills) {
    if (s.skillType === "plugin" && s.pluginConfig) {
      pluginConfigs.set(s.skillName, {
        description: s.skillDescription,
        config: s.pluginConfig as PluginEntry["config"],
      });
    }
  }

  // 5. Resolve model
  const modelConfig = resolveModelConfig(skillCategories, modelOverride);

  // 6. Build the assembled agent (system prompt built inside)
  const agent: AssembledAgent = {
    employeeId,
    slug: employee.slug as EmployeeId,
    name: employee.name,
    nickname: employee.nickname,
    title: employee.title,
    systemPrompt: "", // set below
    tools,
    modelConfig,
    knowledgeContext,
    authorityLevel: employee.authorityLevel,
    skillCategories,
    memories,
    proficiencyLevel: avgLevel,
    workPreferences: employee.workPreferences as AssembledAgent["workPreferences"],
    sensitiveTopics: context?.sensitiveTopics,
    skillContents: Object.keys(skillContents).length > 0 ? skillContents : undefined,
    pluginConfigs: pluginConfigs.size > 0 ? pluginConfigs : undefined,
    knowledgeBaseIds: empKBs.length > 0 ? empKBs.map((kb) => kb.kbId) : undefined,
  };

  // Build system prompt with full agent context
  agent.systemPrompt = buildSystemPrompt(agent);

  return agent;
}
