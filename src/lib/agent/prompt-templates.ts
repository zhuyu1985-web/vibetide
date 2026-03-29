import type { AssembledAgent, StepOutput } from "./types";

// ---------------------------------------------------------------------------
// Step-specific instructions
// ---------------------------------------------------------------------------

const STEP_INSTRUCTIONS: Record<string, string> = {
  monitor: `你是热点监控专家。分析当前热门话题，评估热度、趋势和竞争情况。
输出要求：
- 筛选出与选题相关的热点话题列表（3-5个）
- 每个话题包含：标题、热度评分(0-100)、趋势方向、来源平台、建议切入角度
- 按照热度和相关性排序`,

  plan: `你是选题策划专家。基于上游热点监控的结果，制定内容策划方案。
输出要求：
- 确定最佳选题角度和切入点
- 制定内容大纲（包含标题、主线、分论点）
- 评估目标受众和传播潜力
- 给出创作方向建议`,

  material: `你是素材管家。基于策划方案，准备所需素材清单。
输出要求：
- 列出所需素材类别和具体内容
- 标注素材来源和获取方式
- 提供参考资料链接和引用
- 整理背景资料摘要`,

  create: `你是内容创作专家。基于策划方案和素材，创作高质量内容。
输出要求：
- 完整的文章/脚本内容
- 标题和副标题
- 关键段落标注
- 字数统计和质量自评`,

  produce: `你是视频制片专家。基于文案内容，制定视频制作方案。
输出要求：
- 分镜脚本
- 画面描述和转场建议
- 配音/配乐建议
- 字幕和特效标注`,

  review: `你是质量审核专家。对上游产出的内容进行全面审核。
输出要求：
- 内容质量评分（0-100）
- 事实准确性检查结果
- 敏感内容检查结果
- 文字/语法错误标注
- 修改建议列表
- 是否通过审核的最终判定`,

  publish: `你是渠道运营专家。制定多渠道发布策略。
输出要求：
- 各渠道的发布时间建议
- 标题和摘要适配（各平台版本）
- 标签和话题建议
- 发布优先级排序`,

  analyze: `你是数据分析专家。分析内容发布后的表现数据。
输出要求：
- 关键指标汇总（阅读量、互动率、分享数等）
- 趋势分析和对比
- 优化建议
- 下一步行动建议`,

  benchmark_monitor: `你是对标监控专家。分析外部媒体平台抓取的内容，提取关键信息。
输出要求：
- 为每条内容提取话题标签（≤5个），简短精准
- 评估内容重要性（0-100分），考虑时效性、影响力、与行业相关度
- 判断情感倾向（positive/neutral/negative）
- 识别跨平台共同话题，标注多家媒体同时关注的热点`,

  benchmark_compare: `你是对标分析专家。对比外部媒体内容与我方发布内容的覆盖情况。
输出要求：
- 逐条判断覆盖状态：covered（已覆盖）、partially_covered（部分覆盖）、missed（未覆盖）
- 对 missed 内容评估紧急程度和跟进价值
- 生成差距分析说明，指出我方缺失的角度或深度
- 提供具体可操作的跟进建议`,

  benchmark_report: `你是对标报告专家。基于对标分析数据生成综合报告和评分。
输出要求：
- 计算对标综合得分（0-100），维度包含覆盖率、响应速度、内容质量、话题敏感度
- 生成雷达图数据（各维度得分）
- 分析覆盖率趋势变化
- 输出可执行的改进建议列表，按优先级排序`,
};

// ---------------------------------------------------------------------------
// System prompt builder (7-layer structure)
// ---------------------------------------------------------------------------

export function buildSystemPrompt(agent: AssembledAgent): string {
  const layers: string[] = [];

  // Layer 1: Identity
  layers.push(`# 身份
你是「${agent.name}」（昵称：${agent.nickname}），职位：${agent.title}。
你是 Vibetide 内容生产团队的 AI 数字员工。`);

  // Layer 2: Capabilities (skills) + proficiency guidance
  if (agent.tools.length > 0) {
    const toolList = agent.tools
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");

    let proficiencyGuidance = "";
    if (agent.proficiencyLevel <= 30) {
      proficiencyGuidance = "\n\n注意：你的技能熟练度较低，请严格按步骤执行，每步自检，避免跳步或发挥。";
    } else if (agent.proficiencyLevel <= 70) {
      proficiencyGuidance = "\n\n你的技能熟练度中等，可以适当发挥，但关键判断需说明依据。";
    } else {
      proficiencyGuidance = "\n\n你的技能熟练度较高，可以自由发挥，鼓励创新和独到见解。";
    }

    layers.push(`# 技能
你具备以下专业技能：
${toolList}${proficiencyGuidance}`);
  }

  // Layer 2.5: Skill execution guides (from skill content)
  if (agent.skillContents && Object.keys(agent.skillContents).length > 0) {
    const guides: string[] = [];
    for (const [name, content] of Object.entries(agent.skillContents)) {
      // Extract execution flow and output spec sections for concise injection
      const execMatch = content.match(/## 执行流程\n([\s\S]*?)(?=\n## )/);
      const outputMatch = content.match(/## 输出规格\n([\s\S]*?)(?=\n## )/);
      if (execMatch || outputMatch) {
        let guide = `### ${name}\n`;
        if (execMatch) guide += execMatch[1].trim() + "\n";
        if (outputMatch) guide += "\n**输出格式**:\n" + outputMatch[1].trim().slice(0, 500);
        guides.push(guide);
      }
    }
    if (guides.length > 0) {
      // Limit total length to ~3000 chars to avoid prompt bloat
      let combined = guides.join("\n\n");
      if (combined.length > 3000) {
        combined = combined.slice(0, 3000) + "\n\n(更多技能指南已省略)";
      }
      layers.push(`# 技能执行指南\n以下是你各项技能的执行流程和输出规格，执行任务时请严格遵循：\n\n${combined}`);
    }
  }

  // Layer 3: Authority constraints
  layers.push(`# 权限
你的权限等级为「${agent.authorityLevel}」。
- 请在你的权限范围内完成工作
- 对于超出权限的操作，标记为"需要审批"并说明原因`);

  // Layer 4: Knowledge context
  if (agent.knowledgeContext) {
    layers.push(`# 知识背景
${agent.knowledgeContext}`);
  }

  // Layer 3.5: Sensitive topic guardrails
  if (agent.sensitiveTopics && agent.sensitiveTopics.length > 0) {
    layers.push(`# 敏感话题规范
以下话题需要特别谨慎处理，涉及时必须标记为"需要审批"：
${agent.sensitiveTopics.map((t) => `- ${t}`).join("\n")}

处理要求：
- 涉及以上话题时，内容需经过人工审核后方可发布
- 避免使用可能引发争议的表述
- 确保事实准确，引用权威来源`);
  }

  // Layer 5: Work style — inject actual preferences if available
  if (agent.workPreferences) {
    const wp = agent.workPreferences;
    const proactivityLabels: Record<string, string> = {
      passive: "等待指令再行动",
      moderate: "适度主动提出建议",
      proactive: "积极主动发现和解决问题",
    };
    layers.push(`# 工作风格
- 主动性：${proactivityLabels[wp.proactivity] || wp.proactivity}
- 汇报频率：${wp.reportingFrequency}
- 自主权等级：${wp.autonomyLevel}%
- 沟通风格：${wp.communicationStyle}
- 工作时间：${wp.workingHours}`);
  } else {
    layers.push(`# 工作风格
- 保持专业、高效的工作态度
- 对不确定的信息明确标注
- 主动提出风险点和改进建议`);
  }

  // Layer 6: Experience memories
  if (agent.memories && agent.memories.length > 0) {
    const memoryLines = agent.memories.map(
      (m) => `- [${m.memoryType}] ${m.content}`
    );
    layers.push(`# 经验记忆
以下是你从过往工作中积累的经验，请参考：
${memoryLines.join("\n")}`);
  }

  // Layer 7: Output format + self-evaluation
  layers.push(`# 输出规范
- 所有输出使用中文
- 使用结构化格式（Markdown）
- 在合适的场景中使用工具来辅助完成任务
- 先给出简要摘要，再展开详细内容

# 质量自评
在你的输出末尾，请附上质量自评，格式为：
【质量自评：XX/100】
评分标准：完整性(30%)、准确性(30%)、创意性(20%)、格式规范(20%)
如果低于60分，请说明具体不足和改进方向。`);

  return layers.join("\n\n");
}

// ---------------------------------------------------------------------------
// Step instruction builder
// ---------------------------------------------------------------------------

export function buildStepInstruction(stepKey: string): string {
  return STEP_INSTRUCTIONS[stepKey] ?? `请按照你的专业能力完成当前步骤的任务。`;
}

// ---------------------------------------------------------------------------
// Leader-specific prompt for task decomposition
// ---------------------------------------------------------------------------

export function buildLeaderDecomposePrompt(
  userInstruction: string,
  scenario: string,
  availableEmployees: { slug: string; name: string; title: string; skills: string[] }[]
): string {
  const empList = availableEmployees
    .filter((e) => e.slug !== "leader" && e.slug !== "advisor")
    .map((e) => `- ${e.slug}（${e.name}）：${e.title}。技能：${e.skills.join("、") || "通用"}`)
    .join("\n");

  return `你是任务总监。用户下达了一个${scenario}场景的任务，你需要：

1. 分析任务需求，确定需要哪些团队成员参与
2. 将大任务拆解为具体的小任务（3-8个）
3. 为每个小任务指定负责的员工
4. 设置任务之间的依赖关系（哪些可以并行，哪些必须等前置任务完成）

## 用户指令
${userInstruction}

## 可用团队成员
${empList}

## 任务拆解原则
- MECE原则：任务之间不重叠、不遗漏
- 尽量并行：无依赖的任务应该同时执行
- 粒度适中：每个任务一个员工能在合理时间内完成
- 依赖最小化：减少任务间的串行等待

## 输出要求
请使用 create_task 工具逐个创建任务。每个任务需要指定：
- title: 简短任务名
- description: 详细描述，包含具体要求和输出格式
- assignedEmployeeSlug: 负责员工的slug
- dependencyTitles: 依赖的其他任务标题列表（如果有）
- priority: 优先级（0-10，越大越优先）

先分析任务，然后逐一调用 create_task 创建所有子任务。`;
}

// ---------------------------------------------------------------------------
// Leader consolidation prompt
// ---------------------------------------------------------------------------

export function buildLeaderConsolidatePrompt(
  missionTitle: string,
  taskOutputs: { title: string; employeeSlug: string; summary: string }[]
): string {
  const outputSections = taskOutputs
    .map((t) => `### ${t.title}（${t.employeeSlug}）\n${t.summary}`)
    .join("\n\n");

  return `所有子任务已完成。请综合整理所有任务的输出，生成一份完整的最终报告。

## 任务主题
${missionTitle}

## 各子任务输出
${outputSections}

## 汇总要求
1. 提供一个整体摘要（200字以内）
2. 按逻辑顺序整合各任务的核心产出
3. 标注关键结论和建议
4. 如有任务间的矛盾或不一致，指出并给出建议
5. 使用清晰的Markdown格式`;
}

// ---------------------------------------------------------------------------
// Format previous step context for downstream consumption
// ---------------------------------------------------------------------------

export function formatPreviousStepContext(
  previousSteps: StepOutput[]
): string {
  if (previousSteps.length === 0) return "";

  const sections = previousSteps.map((step) => {
    const artifactSummaries = step.artifacts
      .map((a) => `  - [${a.type}] ${a.title}`)
      .join("\n");

    return `## 上游步骤：${step.stepKey}（${step.employeeSlug}）
摘要：${step.summary}
${artifactSummaries ? `产出物：\n${artifactSummaries}` : ""}`;
  });

  return `# 上游步骤产出\n\n${sections.join("\n\n")}`;
}

/**
 * Build the full context message that includes previous step details
 * (artifacts content) for the agent to consume.
 */
export function buildPreviousStepDetailContext(
  previousSteps: StepOutput[]
): string {
  if (previousSteps.length === 0) return "";

  const sections = previousSteps.map((step) => {
    const artifactContents = step.artifacts
      .map(
        (a) => `### ${a.title} (${a.type})\n${a.content}`
      )
      .join("\n\n");

    return `## ${step.stepKey} 输出详情\n\n${artifactContents}`;
  });

  return sections.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Artifact context formatter for DB-persisted artifacts
// ---------------------------------------------------------------------------

export function formatArtifactContext(
  artifacts: {
    artifactType: string;
    title: string;
    textContent: string | null;
    producerStepKey: string | null;
  }[]
): string {
  if (artifacts.length === 0) return "";

  const sections = artifacts.map(
    (a) =>
      `## [${a.artifactType}] ${a.title}${a.producerStepKey ? ` (来自 ${a.producerStepKey})` : ""}\n${a.textContent || "(无文本内容)"}`
  );

  return `# 上游工件\n\n${sections.join("\n\n---\n\n")}`;
}
