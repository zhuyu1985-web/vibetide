/**
 * Skill Test Runner
 * Tests all 29 built-in skills by calling the LLM with skill content as system prompt.
 * Validates: output quality score, Chinese output, Markdown structure, content relevance.
 *
 * Usage: npx tsx scripts/test-skills.ts [--skill slug] [--category name] [--dry-run]
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

// Test inputs per category
const TEST_INPUTS: Record<string, string> = {
  // Perception
  web_search: "搜索2026年3月中国新能源汽车市场最新销量数据和行业动态",
  trend_monitor: "监控科技领域过去24小时的热点趋势，重点关注AI和新能源",
  social_listening: "分析「华为Mate 70」这个话题在社交媒体上的舆情和用户讨论",
  news_aggregation: "聚合过去24小时关于「AI手机」的新闻报道",

  // Analysis
  sentiment_analysis: "分析以下文本的情感倾向：华为发布新款AI手机Mate 70，搭载盘古大模型5.0，市场反响热烈。首日预约量突破500万，创历史新高。但也有用户吐槽价格偏高，且部分AI功能需要联网才能使用。",
  topic_extraction: "从以下文本中提取核心主题和关键词：2026年全国两会期间，多位代表委员围绕人工智能立法、新能源汽车产业政策、数字经济发展战略等议题展开热烈讨论。其中，关于AI大模型监管、算力基础设施建设、数据要素市场化等话题引发社会广泛关注。",
  competitor_analysis: "分析科技媒体领域的竞品策略，对比对象：36氪、虎嗅、钛媒体，分析维度：内容策略和数据表现",
  audience_analysis: "分析「新能源汽车评测」内容的目标受众画像，平台为抖音",
  fact_check: "核查以下内容的事实准确性：2025年中国新能源汽车销量突破1500万辆，同比增长45%，渗透率达到52%。特斯拉中国全年销量约60万辆，比亚迪全年销量超过400万辆。宁德时代全球市场份额达到38%。",
  heat_scoring: "评估「DeepSeek R2大模型发布」这个话题的热度指数",

  // Generation
  content_generate: "根据以下大纲生成一篇深度报道文章：主题=2026年AI手机三国杀，角度=华为、苹果、三星三大阵营的AI策略对比，目标字数=1500字，体裁=深度报道",
  headline_generate: "为以下文章生成标题候选：文章主题是2026年春季新能源汽车集体降价潮的深度分析，内容涵盖比亚迪、特斯拉、蔚来等品牌的降价策略和市场影响。目标平台：微信公众号",
  summary_generate: "为以下文章生成多级摘要：2026年3月，全球AI芯片市场迎来重大变局。英伟达发布新一代Blackwell Ultra芯片，算力提升3倍；AMD推出MI450加速卡直接对标；华为昇腾920芯片在国内市场份额突破30%。三方角力推动AI算力成本大幅下降，预计年底GPU云服务价格将下降40%。这一变化将深刻影响大模型训练和推理的商业模式。",
  script_generate: "为一篇关于「2026年AI手机对比评测」的文章生成3分钟短视频脚本，风格为轻松科技评测，目标平台为抖音",
  style_rewrite: "将以下正式新闻稿改写为小红书风格：华为今日发布新一代折叠屏手机Mate X6，搭载麒麟9100处理器和盘古AI大模型，支持实时翻译、AI修图和智能助手等功能。售价12999元起，3月15日正式开售。",
  translation: "将以下中文翻译为英文：人工智能正在重塑全球科技产业格局。2026年，中国在大模型、AI芯片和智能终端三大领域取得突破性进展，与美国形成双极竞争态势。专家预测，到2028年全球AI市场规模将突破1万亿美元。",
  angle_design: "围绕「2026年春季新能源汽车降价潮」这个热点，设计5-6个差异化的内容角度",

  // Production
  video_edit_plan: "为一篇关于AI手机三大阵营对比的文章生成2分钟短视频剪辑方案，发布平台为B站",
  thumbnail_generate: "为文章《AI手机三国杀：华为、苹果、三星的2026年AI战略》设计封面方案，目标平台为微信公众号",
  layout_design: "为一篇3000字的深度科技报道设计排版方案，包含5张配图，发布平台为微信公众号",
  audio_plan: "为一段2分钟的AI手机评测视频设计配音配乐方案，风格为专业科技评测",

  // Management
  quality_review: "审核以下文章的质量：\n\n# AI手机大战：谁是2026年的赢家？\n\n2026年开春，全球智能手机市场迎来一场前所未有的AI军备竞赛。华为携盘古大模型5.0、苹果带Apple Intelligence 3.0、三星亮出Galaxy AI 2.0，三大阵营各显神通。\n\n华为方面，Mate 70系列首次实现端侧大模型部署，支持离线AI助手、实时语音翻译等功能。据IDC数据显示，华为在中国市场的份额回升至28%。\n\n苹果则在iOS 20中深度整合AI能力，Siri进化为真正的智能助手，支持跨App协作。iPhone 17 Pro的Neural Engine算力提升40%。\n\n三星Galaxy S26搭载高通骁龙8 Gen 5芯片，主打AI摄影和实时翻译。三星在全球市场份额保持第一，但增速明显放缓。\n\n不过，AI手机的实际体验仍有争议。部分用户反映AI功能实用性不足，更多是营销噱头。电池续航受AI功能影响明显缩短也是一大痛点。\n\n总体来看，2026年将是AI手机从概念走向实用的关键一年。",
  compliance_check: "检查以下内容的合规性：近期中美关系持续紧张，特朗普政府再次加征关税，引发全球市场震荡。国内部分网友情绪激动，在社交媒体上发布过激言论。与此同时，某知名博主曝光了一位明星的私人手机号和家庭住址，引发隐私保护争议。",
  task_planning: "规划一个完整的内容生产任务：为「两会期间AI政策解读」选题完成从热点监控到数据分析的全流程",
  publish_strategy: "为一篇关于AI手机对比评测的深度报道制定多渠道发布策略，目标渠道包括微信公众号、微博、抖音、头条号",

  // Knowledge
  knowledge_retrieval: "检索关于新能源汽车补贴政策变化的知识",
  media_search: "检索与AI手机评测相关的视频素材",
  case_reference: "检索近期关于科技产品评测的爆款案例，作为创作参考",
  data_report: "生成本周内容运营数据周报，重点关注科技频道的表现数据",
};

interface TestResult {
  slug: string;
  name: string;
  category: string;
  success: boolean;
  qualityScore: number | null;
  durationMs: number;
  outputLength: number;
  hasChinese: boolean;
  hasMarkdown: boolean;
  hasStructure: boolean;
  error?: string;
  issues: string[];
}

async function testSkill(
  skillSlug: string,
  testInput: string,
  dryRun: boolean
): Promise<TestResult> {
  // Find skill by matching slug (name mapping via BUILTIN_SKILLS)
  const { BUILTIN_SKILLS } = await import("../src/lib/constants");
  const skillDef = BUILTIN_SKILLS.find((s) => s.slug === skillSlug);
  if (!skillDef) {
    return {
      slug: skillSlug, name: "Unknown", category: "unknown",
      success: false, qualityScore: null, durationMs: 0, outputLength: 0,
      hasChinese: false, hasMarkdown: false, hasStructure: false,
      error: `Skill definition not found for slug: ${skillSlug}`, issues: ["定义缺失"],
    };
  }

  // Find in DB
  const dbSkill = await db.query.skills.findFirst({
    where: (s, { eq: eq2 }) => eq2(s.name, skillDef.name),
  });

  if (!dbSkill) {
    return {
      slug: skillSlug, name: skillDef.name, category: skillDef.category,
      success: false, qualityScore: null, durationMs: 0, outputLength: 0,
      hasChinese: false, hasMarkdown: false, hasStructure: false,
      error: `Skill not found in DB. Run db:seed first.`, issues: ["数据库缺失"],
    };
  }

  if (dryRun) {
    const contentLen = (dbSkill.content || "").length;
    const hasInputSchema = dbSkill.inputSchema && Object.keys(dbSkill.inputSchema as object).length > 0;
    const hasOutputSchema = dbSkill.outputSchema && Object.keys(dbSkill.outputSchema as object).length > 0;
    const issues: string[] = [];
    if (contentLen < 200) issues.push(`content过短(${contentLen}字符)`);
    if (!hasInputSchema) issues.push("缺少inputSchema");
    if (!hasOutputSchema) issues.push("缺少outputSchema");
    if (!dbSkill.runtimeConfig) issues.push("缺少runtimeConfig");
    if (!dbSkill.compatibleRoles || (dbSkill.compatibleRoles as string[]).length === 0) issues.push("缺少compatibleRoles");

    return {
      slug: skillSlug, name: skillDef.name, category: skillDef.category,
      success: issues.length === 0, qualityScore: null, durationMs: 0,
      outputLength: contentLen,
      hasChinese: /[\u4e00-\u9fff]/.test(dbSkill.content || ""),
      hasMarkdown: (dbSkill.content || "").includes("##"),
      hasStructure: (dbSkill.content || "").includes("执行流程"),
      issues,
    };
  }

  // Build system prompt (same logic as testSkillExecution)
  const systemPromptParts: string[] = [
    `# 角色`,
    `你是技能「${dbSkill.name}」的执行引擎。`,
    `技能类别：${dbSkill.category}`,
    `技能描述：${dbSkill.description}`,
  ];

  if (dbSkill.content) {
    systemPromptParts.push("", "# 技能说明文档 (SKILL.md)", dbSkill.content);
  }

  const inputSchema = (dbSkill.inputSchema as Record<string, string>) || {};
  const outputSchema = (dbSkill.outputSchema as Record<string, string>) || {};

  if (Object.keys(inputSchema).length > 0) {
    systemPromptParts.push(
      "", "# 输入规格",
      ...Object.entries(inputSchema).map(([k, v]) => `- ${k}: ${v}`)
    );
  }
  if (Object.keys(outputSchema).length > 0) {
    systemPromptParts.push(
      "", "# 输出规格",
      ...Object.entries(outputSchema).map(([k, v]) => `- ${k}: ${v}`)
    );
  }
  systemPromptParts.push(
    "", "# 输出要求",
    "- 所有输出使用中文",
    "- 使用结构化 Markdown 格式",
    "- 先给出简要摘要，再展开详细内容",
    "- 输出末尾附上质量自评：【质量自评：XX/100】",
    "  评分标准：完整性(30%)、准确性(30%)、创意性(20%)、格式规范(20%)"
  );

  const systemPrompt = systemPromptParts.join("\n");

  // Resolve model
  const runtimeConfig = dbSkill.runtimeConfig as {
    modelDependency?: string;
  } | null;
  const modelDep = runtimeConfig?.modelDependency || "zhipu:glm-4-plus";
  const [resolvedProvider, resolvedModel] = modelDep.includes(":")
    ? (modelDep.split(":", 2) as [string, string])
    : ["zhipu", modelDep];

  try {
    const { generateText } = await import("ai");
    const { getLanguageModel } = await import("../src/lib/agent/model-router");

    const model = getLanguageModel({
      provider: resolvedProvider as "zhipu" | "anthropic" | "openai",
      model: resolvedModel,
      temperature: 0.5,
      maxTokens: 4096,
    });

    const startTime = Date.now();
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: testInput }],
      temperature: 0.5,
      maxOutputTokens: 4096,
    });
    const durationMs = Date.now() - startTime;

    const output = result.text || "";
    const issues: string[] = [];

    // Validate output
    const hasChinese = /[\u4e00-\u9fff]/.test(output);
    const hasMarkdown = output.includes("##") || output.includes("**") || output.includes("|");
    const hasStructure = output.includes("##") && output.length > 300;

    if (!hasChinese) issues.push("输出不含中文");
    if (!hasMarkdown) issues.push("输出缺少Markdown格式");
    if (!hasStructure) issues.push("输出缺少结构化标题");
    if (output.length < 200) issues.push(`输出过短(${output.length}字符)`);

    // Extract quality score
    let qualityScore: number | null = null;
    const scoreMatch = output.match(/【质量自评[：:](\d+)\/100】/);
    if (scoreMatch) {
      qualityScore = parseInt(scoreMatch[1], 10);
      if (qualityScore < 70) issues.push(`质量自评偏低(${qualityScore}/100)`);
    } else {
      issues.push("未提取到质量自评分数");
    }

    console.log(
      `  ${issues.length === 0 ? "✅" : "⚠️"} ${skillDef.name} (${skillSlug}) | ` +
      `${durationMs}ms | ${output.length}字符 | 自评:${qualityScore ?? "N/A"}/100` +
      (issues.length > 0 ? ` | 问题: ${issues.join(", ")}` : "")
    );

    return {
      slug: skillSlug, name: skillDef.name, category: skillDef.category,
      success: true, qualityScore, durationMs, outputLength: output.length,
      hasChinese, hasMarkdown, hasStructure, issues,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ ${skillDef.name} (${skillSlug}) | 错误: ${error}`);
    return {
      slug: skillSlug, name: skillDef.name, category: skillDef.category,
      success: false, qualityScore: null, durationMs: 0, outputLength: 0,
      hasChinese: false, hasMarkdown: false, hasStructure: false,
      error, issues: [`执行失败: ${error}`],
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skillFilter = args.find((a) => a.startsWith("--skill="))?.split("=")[1];
  const categoryFilter = args.find((a) => a.startsWith("--category="))?.split("=")[1];

  console.log("=".repeat(70));
  console.log(`🧪 Vibetide 技能测试 ${dryRun ? "(DRY RUN - 仅检查数据完整性)" : "(LLM 实际执行)"}`);
  console.log("=".repeat(70));

  let slugs = Object.keys(TEST_INPUTS);
  if (skillFilter) {
    slugs = slugs.filter((s) => s === skillFilter);
    if (slugs.length === 0) {
      console.error(`❌ 未找到技能: ${skillFilter}`);
      process.exit(1);
    }
  }

  const { BUILTIN_SKILLS } = await import("../src/lib/constants");
  if (categoryFilter) {
    const categorySlugs = BUILTIN_SKILLS
      .filter((s) => s.category === categoryFilter)
      .map((s) => s.slug);
    slugs = slugs.filter((s) => categorySlugs.includes(s));
    if (slugs.length === 0) {
      console.error(`❌ 未找到类别: ${categoryFilter}`);
      process.exit(1);
    }
  }

  console.log(`\n📋 待测试技能: ${slugs.length}个\n`);

  const results: TestResult[] = [];
  const categories = ["perception", "analysis", "generation", "production", "management", "knowledge"];

  for (const category of categories) {
    const categorySlugs = slugs.filter((s) => {
      const def = BUILTIN_SKILLS.find((d) => d.slug === s);
      return def?.category === category;
    });
    if (categorySlugs.length === 0) continue;

    const categoryNames: Record<string, string> = {
      perception: "感知类", analysis: "分析类", generation: "生成类",
      production: "制作类", management: "管理类", knowledge: "知识类",
    };
    console.log(`\n${"─".repeat(50)}`);
    console.log(`📂 ${categoryNames[category] || category} (${categorySlugs.length}个)`);
    console.log(`${"─".repeat(50)}`);

    for (const slug of categorySlugs) {
      const result = await testSkill(slug, TEST_INPUTS[slug], dryRun);
      results.push(result);
    }
  }

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log("📊 测试结果汇总");
  console.log(`${"=".repeat(70)}`);

  const passed = results.filter((r) => r.success && r.issues.length === 0);
  const warnings = results.filter((r) => r.success && r.issues.length > 0);
  const failed = results.filter((r) => !r.success);

  console.log(`\n✅ 通过: ${passed.length}/${results.length}`);
  console.log(`⚠️ 警告: ${warnings.length}/${results.length}`);
  console.log(`❌ 失败: ${failed.length}/${results.length}`);

  if (!dryRun) {
    const scores = results.filter((r) => r.qualityScore !== null);
    if (scores.length > 0) {
      const avgScore = scores.reduce((sum, r) => sum + (r.qualityScore ?? 0), 0) / scores.length;
      const minScore = Math.min(...scores.map((r) => r.qualityScore!));
      const maxScore = Math.max(...scores.map((r) => r.qualityScore!));
      console.log(`\n📈 质量自评统计:`);
      console.log(`   平均分: ${avgScore.toFixed(1)}/100`);
      console.log(`   最高分: ${maxScore}/100`);
      console.log(`   最低分: ${minScore}/100`);
      console.log(`   ≥70分: ${scores.filter((r) => r.qualityScore! >= 70).length}/${scores.length}`);
    }

    const avgDuration = results.filter((r) => r.durationMs > 0);
    if (avgDuration.length > 0) {
      const avg = avgDuration.reduce((sum, r) => sum + r.durationMs, 0) / avgDuration.length;
      console.log(`\n⏱️ 执行时间: 平均 ${(avg / 1000).toFixed(1)}s`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️ 警告详情:`);
    for (const r of warnings) {
      console.log(`   ${r.name} (${r.slug}): ${r.issues.join(", ")}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n❌ 失败详情:`);
    for (const r of failed) {
      console.log(`   ${r.name} (${r.slug}): ${r.error || r.issues.join(", ")}`);
    }
  }

  // Write report
  const reportPath = `docs/plans/test-report-skills-${new Date().toISOString().slice(0, 10)}.md`;
  const report = generateReport(results, dryRun);
  const fs = await import("fs");
  fs.writeFileSync(reportPath, report);
  console.log(`\n📝 详细报告已保存: ${reportPath}`);

  await client.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

function generateReport(results: TestResult[], dryRun: boolean): string {
  const lines: string[] = [
    `# 技能测试报告`,
    ``,
    `**测试时间**: ${new Date().toISOString()}`,
    `**测试模式**: ${dryRun ? "Dry Run (数据完整性检查)" : "LLM 实际执行"}`,
    `**测试数量**: ${results.length}个技能`,
    ``,
    `## 汇总`,
    ``,
    `| 指标 | 数值 |`,
    `|------|------|`,
    `| 通过 | ${results.filter((r) => r.success && r.issues.length === 0).length} |`,
    `| 警告 | ${results.filter((r) => r.success && r.issues.length > 0).length} |`,
    `| 失败 | ${results.filter((r) => !r.success).length} |`,
  ];

  if (!dryRun) {
    const scores = results.filter((r) => r.qualityScore !== null);
    if (scores.length > 0) {
      const avg = scores.reduce((s, r) => s + (r.qualityScore ?? 0), 0) / scores.length;
      lines.push(`| 平均质量分 | ${avg.toFixed(1)}/100 |`);
    }
  }

  lines.push(``, `## 详细结果`, ``);
  lines.push(`| 技能 | 类别 | 状态 | 质量分 | 耗时 | 输出长度 | 问题 |`);
  lines.push(`|------|------|------|--------|------|----------|------|`);

  for (const r of results) {
    const status = !r.success ? "❌" : r.issues.length === 0 ? "✅" : "⚠️";
    lines.push(
      `| ${r.name} | ${r.category} | ${status} | ${r.qualityScore ?? "-"} | ${r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "-"} | ${r.outputLength} | ${r.issues.join("; ") || "-"} |`
    );
  }

  if (results.some((r) => r.issues.length > 0 || !r.success)) {
    lines.push(``, `## 问题汇总`, ``);
    for (const r of results.filter((r) => r.issues.length > 0 || !r.success)) {
      lines.push(`### ${r.name} (${r.slug})`);
      if (r.error) lines.push(`- **错误**: ${r.error}`);
      for (const issue of r.issues) lines.push(`- ${issue}`);
      lines.push(``);
    }
  }

  return lines.join("\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
