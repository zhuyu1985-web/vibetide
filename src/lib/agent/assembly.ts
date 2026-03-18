import { db } from "@/db";
import {
  aiEmployees,
  employeeSkills,
  skills,
  employeeKnowledgeBases,
  knowledgeBases,
  employeeMemories,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { READ_ONLY_TOOL_NAMES, type EmployeeId } from "@/lib/constants";
import type { SkillCategory } from "@/lib/types";
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
  context?: { sensitiveTopics?: string[] }
): Promise<AssembledAgent> {
  // 1. Load employee
  const employee = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
  });
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  // 2. Load skills (including plugin config for plugin-type skills)
  const empSkills = await db
    .select({
      skillName: skills.name,
      skillCategory: skills.category,
      skillDescription: skills.description,
      skillContent: skills.content,
      skillType: skills.type,
      pluginConfig: skills.pluginConfig,
      level: employeeSkills.level,
    })
    .from(employeeSkills)
    .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
    .where(eq(employeeSkills.employeeId, employeeId));

  const skillNames = empSkills.map((s) => s.skillName);
  const skillCategories = [
    ...new Set(empSkills.map((s) => s.skillCategory)),
  ] as SkillCategory[];

  // 3. Load knowledge bases
  const empKBs = await db
    .select({
      kbName: knowledgeBases.name,
      kbDescription: knowledgeBases.description,
      kbType: knowledgeBases.type,
    })
    .from(employeeKnowledgeBases)
    .innerJoin(
      knowledgeBases,
      eq(employeeKnowledgeBases.knowledgeBaseId, knowledgeBases.id)
    )
    .where(eq(employeeKnowledgeBases.employeeId, employeeId));

  const knowledgeContext = empKBs.length > 0
    ? empKBs
        .map((kb) => `- ${kb.kbName}${kb.kbDescription ? `：${kb.kbDescription}` : ""}`)
        .join("\n")
    : "";

  // 3b. Load top-10 high-importance memories
  const memoryRows = await db
    .select({
      content: employeeMemories.content,
      memoryType: employeeMemories.memoryType,
      importance: employeeMemories.importance,
    })
    .from(employeeMemories)
    .where(eq(employeeMemories.employeeId, employeeId))
    .orderBy(desc(employeeMemories.importance))
    .limit(10);

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
  const skillContents: Record<string, string> = {};
  for (const s of empSkills) {
    if (s.skillContent) {
      skillContents[s.skillName] = s.skillContent;
    }
  }

  // 4. Build tools (filtered by authority level)
  const readOnlyToolNames = new Set<string>(READ_ONLY_TOOL_NAMES);

  let filteredSkillNames = skillNames;
  if (employee.authorityLevel === "observer") {
    filteredSkillNames = []; // no tools
  } else if (employee.authorityLevel === "advisor") {
    filteredSkillNames = skillNames.filter((n) => readOnlyToolNames.has(n));
  }
  // executor and coordinator get all bound tools

  const tools = resolveTools(filteredSkillNames);

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
  };

  // Build system prompt with full agent context
  agent.systemPrompt = buildSystemPrompt(agent);

  return agent;
}
