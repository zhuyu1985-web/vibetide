/**
 * Smoke test: 验证 daily_ai_news 工作流模板的结构是否符合"每日 AI 资讯"场景预期。
 *
 * 仅校验内存对象（无 DB 依赖），可直接 `npx tsx scripts/verify-daily-ai-news-template.ts` 运行。
 */
import { BUILTIN_WORKFLOWS, buildBuiltinScenarioSeeds } from "@/db/seed-builtin-workflows";

const failures: string[] = [];

function expect(cond: unknown, msg: string) {
  if (!cond) failures.push("✗ " + msg);
  else console.log("✓ " + msg);
}

const tpl = BUILTIN_WORKFLOWS.find((w) => w.slug === "daily_ai_news");
expect(!!tpl, "BUILTIN_WORKFLOWS 包含 slug=daily_ai_news");
if (!tpl) {
  console.error(failures.join("\n"));
  process.exit(1);
}

// 触发器
expect(tpl.triggerType === "scheduled", "触发方式 = scheduled（定时）");
expect(
  tpl.triggerConfig?.cron === "30 8 * * *",
  `cron 表达式 = "30 8 * * *"（每日 08:30），实际：${tpl.triggerConfig?.cron}`,
);
expect(
  tpl.triggerConfig?.timezone === "Asia/Shanghai",
  `时区 = Asia/Shanghai，实际：${tpl.triggerConfig?.timezone}`,
);

// 步骤序列
const expectedSteps: Array<{ slug: string; name: string }> = [
  { slug: "trending_topics", name: "AI 热点线索匹配" },
  { slug: "topic_extraction", name: "AI 话题筛选去重" },
  { slug: "news_aggregation", name: "多源资讯补全" },
  { slug: "summary_generate", name: "逐条摘要生成" },
  { slug: "content_generate", name: "合并成稿" },
  { slug: "cms_publish", name: "定时发布到 APP" },
];

expect(
  tpl.steps.length === expectedSteps.length,
  `步骤数 = ${expectedSteps.length}，实际 ${tpl.steps.length}`,
);

expectedSteps.forEach((exp, i) => {
  const step = tpl.steps[i];
  expect(
    step?.config.skillSlug === exp.slug,
    `Step ${i + 1} skillSlug = ${exp.slug}（${exp.name}），实际 ${step?.config.skillSlug}`,
  );
  expect(
    step?.name === exp.name,
    `Step ${i + 1} name = "${exp.name}"，实际 "${step?.name}"`,
  );
});

// 依赖链：每一步依赖前一步
tpl.steps.forEach((s, i) => {
  if (i === 0) {
    expect(s.dependsOn.length === 0, `Step 1 dependsOn 应为空`);
  } else {
    const prev = `step-${i}`;
    expect(
      s.dependsOn.includes(prev),
      `Step ${i + 1} dependsOn 应包含 ${prev}，实际 ${JSON.stringify(s.dependsOn)}`,
    );
  }
});

// CMS 发布步骤参数
const publishStep = tpl.steps[5];
expect(
  publishStep?.config.parameters?.appChannelSlug === "{{publish_channel_slug}}",
  `CMS 发布步骤参数 appChannelSlug 应为 "{{publish_channel_slug}}"`,
);
expect(
  publishStep?.config.parameters?.triggerSource === "scheduled",
  `CMS 发布步骤参数 triggerSource 应为 "scheduled"`,
);

// 输入字段含 publish_channel_slug + 默认 app_news
const channelField = tpl.inputFields.find((f) => f.name === "publish_channel_slug");
expect(!!channelField, "inputFields 含 publish_channel_slug");
expect(
  channelField?.defaultValue === "app_news",
  `publish_channel_slug 默认值 = app_news，实际 ${channelField?.defaultValue}`,
);

// systemInstruction / promptTemplate 含关键场景词
expect(
  /热点发现线索/.test(tpl.systemInstruction ?? ""),
  "systemInstruction 含 '热点发现线索'",
);
expect(
  /CMS APP/.test(tpl.systemInstruction ?? ""),
  "systemInstruction 含 'CMS APP'",
);

// toBuiltinSeedInput 透传
const seedInput = buildBuiltinScenarioSeeds().find(
  (s) => s.legacyScenarioKey === "daily_ai_news",
);
expect(!!seedInput, "buildBuiltinScenarioSeeds 输出含 daily_ai_news");
expect(seedInput?.triggerType === "scheduled", "seedInput.triggerType = scheduled（透传）");
expect(
  seedInput?.triggerConfig?.cron === "30 8 * * *",
  `seedInput.triggerConfig.cron = "30 8 * * *"（透传）`,
);

console.log("\n— Result —");
if (failures.length === 0) {
  console.log(`✅ 全部通过（${BUILTIN_WORKFLOWS.length} 个 builtin workflow，daily_ai_news 校验全绿）`);
  process.exit(0);
} else {
  console.error(`❌ ${failures.length} 项失败：`);
  failures.forEach((f) => console.error("  " + f));
  process.exit(1);
}
