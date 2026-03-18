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
