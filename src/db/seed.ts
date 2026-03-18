import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import { BUILTIN_SKILLS, EMPLOYEE_CORE_SKILLS } from "../lib/constants";

// Load env manually for standalone script (.env.local takes priority)
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

// Mock data imports (using relative paths for tsx execution)
const employeesData = [
  {
    slug: "xiaolei",
    name: "热点猎手",
    nickname: "小雷",
    title: "热点猎手",
    motto: "热点不等人，快一秒就是头条",
    roleType: "trending_scout",
    authorityLevel: "advisor" as const,
    status: "working" as const,
    currentTask: "监控微博热搜、百度热榜、头条指数",
    tasksCompleted: 1247,
    accuracy: 94.2,
    avgResponseTime: "2.3s",
    satisfaction: 96,
  },
  {
    slug: "xiaoce",
    name: "选题策划师",
    nickname: "小策",
    title: "选题策划师",
    motto: "好选题是成功的一半",
    roleType: "content_strategist",
    authorityLevel: "advisor" as const,
    status: "working" as const,
    currentTask: "为#AI手机大战#策划3个差异化角度",
    tasksCompleted: 856,
    accuracy: 91.5,
    avgResponseTime: "4.1s",
    satisfaction: 93,
  },
  {
    slug: "xiaozi",
    name: "素材管家",
    nickname: "小资",
    title: "素材管家",
    motto: "素材在手，创作无忧",
    roleType: "asset_manager",
    authorityLevel: "executor" as const,
    status: "working" as const,
    currentTask: "为视频稿件准备AI手机评测素材包",
    tasksCompleted: 2103,
    accuracy: 97.1,
    avgResponseTime: "1.8s",
    satisfaction: 95,
  },
  {
    slug: "xiaowen",
    name: "内容创作师",
    nickname: "小文",
    title: "内容创作师",
    motto: "字字珠玑，篇篇精品",
    roleType: "content_writer",
    authorityLevel: "executor" as const,
    status: "working" as const,
    currentTask: "撰写《AI手机大战：消费者的三重抉择》长文",
    tasksCompleted: 634,
    accuracy: 89.8,
    avgResponseTime: "12.5s",
    satisfaction: 91,
  },
  {
    slug: "xiaojian",
    name: "视频制片人",
    nickname: "小剪",
    title: "视频制片人",
    motto: "每一帧都是艺术",
    roleType: "video_producer",
    authorityLevel: "executor" as const,
    status: "idle" as const,
    currentTask: null,
    tasksCompleted: 412,
    accuracy: 92.3,
    avgResponseTime: "25.0s",
    satisfaction: 94,
  },
  {
    slug: "xiaoshen",
    name: "质量审核官",
    nickname: "小审",
    title: "质量审核官",
    motto: "宁可慢一步，不可错一字",
    roleType: "quality_reviewer",
    authorityLevel: "advisor" as const,
    status: "reviewing" as const,
    currentTask: "审核《新能源汽车降价潮》稿件",
    tasksCompleted: 1876,
    accuracy: 98.5,
    avgResponseTime: "6.2s",
    satisfaction: 97,
  },
  {
    slug: "xiaofa",
    name: "渠道运营师",
    nickname: "小发",
    title: "渠道运营师",
    motto: "精准触达，高效转化",
    roleType: "channel_operator",
    authorityLevel: "executor" as const,
    status: "idle" as const,
    currentTask: null,
    tasksCompleted: 3421,
    accuracy: 95.7,
    avgResponseTime: "3.5s",
    satisfaction: 94,
  },
  {
    slug: "xiaoshu",
    name: "数据分析师",
    nickname: "小数",
    title: "数据分析师",
    motto: "数据会说话",
    roleType: "data_analyst",
    authorityLevel: "advisor" as const,
    status: "working" as const,
    currentTask: "生成本周全渠道数据报告",
    tasksCompleted: 967,
    accuracy: 96.8,
    avgResponseTime: "5.0s",
    satisfaction: 95,
  },
];

async function seed() {
  console.log("Seeding database...\n");

  // 1. Create default organization (idempotent)
  console.log("1. Creating organization...");
  const existingOrg = await db.query.organizations.findFirst({
    where: (o, { eq }) => eq(o.slug, "vibe-media-demo"),
  });
  const [org] = existingOrg
    ? [existingOrg]
    : await db
        .insert(schema.organizations)
        .values({
          name: "Vibe Media Demo",
          slug: "vibe-media-demo",
        })
        .returning();
  console.log(`   ${existingOrg ? "Found" : "Created"} org: ${org.name} (${org.id})\n`);

  // 2. Insert BUILTIN_SKILLS into skills table (idempotent)
  console.log("2. Inserting builtin skills...");
  const skillMap = new Map<string, string>(); // slug -> uuid
  let skillsCreated = 0;

  let skillsUpdated = 0;
  for (const skillDef of BUILTIN_SKILLS) {
    const existing = await db.query.skills.findFirst({
      where: (s, { eq, and }) =>
        and(eq(s.organizationId, org.id), eq(s.name, skillDef.name)),
    });
    if (existing) {
      // Upsert: update content, version, schemas, and config for existing skills
      await db
        .update(schema.skills)
        .set({
          content: skillDef.content,
          version: skillDef.version,
          description: skillDef.description,
          inputSchema: skillDef.inputSchema ?? null,
          outputSchema: skillDef.outputSchema ?? null,
          runtimeConfig: skillDef.runtimeConfig ?? null,
          compatibleRoles: skillDef.compatibleRoles ?? [],
          updatedAt: new Date(),
        })
        .where(eq(schema.skills.id, existing.id));
      skillMap.set(skillDef.slug, existing.id);
      skillsUpdated++;
      continue;
    }
    const [skill] = await db
      .insert(schema.skills)
      .values({
        organizationId: org.id,
        name: skillDef.name,
        category: skillDef.category,
        type: "builtin",
        version: skillDef.version,
        description: skillDef.description,
        content: skillDef.content,
        inputSchema: skillDef.inputSchema,
        outputSchema: skillDef.outputSchema,
        runtimeConfig: skillDef.runtimeConfig,
        compatibleRoles: skillDef.compatibleRoles,
      })
      .returning();
    skillMap.set(skillDef.slug, skill.id);
    skillsCreated++;
  }
  console.log(`   ${skillsCreated} new / ${skillsUpdated} updated / ${BUILTIN_SKILLS.length - skillsCreated - skillsUpdated} unchanged builtin skills\n`);

  // 3. Insert AI employees and bind core skills (idempotent)
  console.log("3. Inserting AI employees and binding skills...");
  const employeeMap = new Map<string, string>(); // slug -> uuid
  let empsCreated = 0;

  for (const empData of employeesData) {
    const existingEmp = await db.query.aiEmployees.findFirst({
      where: (e, { eq, and }) =>
        and(eq(e.organizationId, org.id), eq(e.slug, empData.slug)),
    });

    if (existingEmp) {
      employeeMap.set(empData.slug, existingEmp.id);
      console.log(`   ${empData.nickname} (${empData.slug}) -> ${existingEmp.id} (exists)`);
      continue;
    }

    const [employee] = await db
      .insert(schema.aiEmployees)
      .values({
        organizationId: org.id,
        ...empData,
        learnedPatterns: {},
      })
      .returning();

    employeeMap.set(empData.slug, employee.id);
    empsCreated++;
    console.log(`   ${empData.nickname} (${empData.slug}) -> ${employee.id}`);

    // Bind core skills from EMPLOYEE_CORE_SKILLS
    const coreSkillSlugs = EMPLOYEE_CORE_SKILLS[empData.slug] || [];
    for (const skillSlug of coreSkillSlugs) {
      const skillId = skillMap.get(skillSlug);
      if (skillId) {
        await db.insert(schema.employeeSkills).values({
          employeeId: employee.id,
          skillId,
          level: 80 + Math.floor(Math.random() * 15), // 80-94
          bindingType: "core",
        });
      }
    }
  }
  console.log(`   ${empsCreated} new / ${employeesData.length - empsCreated} existing employees\n`);

  // 4. Insert teams
  console.log("4. Inserting teams...");
  const teamsData = [
    {
      name: "新闻快讯突击队",
      scenario: "breaking_news",
      rules: { approvalRequired: true, reportFrequency: "实时", sensitiveTopics: ["政治", "军事", "灾难"] },
      aiMembers: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen", "xiaofa"],
      humanMembers: ["张编辑"],
    },
    {
      name: "深度报道精英组",
      scenario: "deep_report",
      rules: { approvalRequired: true, reportFrequency: "每日", sensitiveTopics: ["政治", "法律", "伦理"] },
      aiMembers: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaoshu"],
      humanMembers: ["李主编", "王记者"],
    },
    {
      name: "新媒体运营全能队",
      scenario: "social_media",
      rules: { approvalRequired: false, reportFrequency: "每4小时", sensitiveTopics: ["政治", "低俗"] },
      aiMembers: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaojian", "xiaoshen", "xiaofa", "xiaoshu"],
      humanMembers: ["张编辑", "赵运营"],
    },
  ];

  for (const teamData of teamsData) {
    const existingTeam = await db.query.teams.findFirst({
      where: (t, { eq, and }) =>
        and(eq(t.organizationId, org.id), eq(t.name, teamData.name)),
    });

    if (existingTeam) {
      console.log(`   Team: ${teamData.name} (exists)`);
      continue;
    }

    const [team] = await db
      .insert(schema.teams)
      .values({
        organizationId: org.id,
        name: teamData.name,
        scenario: teamData.scenario,
        rules: teamData.rules,
      })
      .returning();

    // Add AI members
    for (const slug of teamData.aiMembers) {
      const empId = employeeMap.get(slug);
      if (empId) {
        await db.insert(schema.teamMembers).values({
          teamId: team.id,
          memberType: "ai",
          aiEmployeeId: empId,
          displayName: slug,
          teamRole: slug,
        });
      }
    }

    // Add human members
    for (const name of teamData.humanMembers) {
      await db.insert(schema.teamMembers).values({
        teamId: team.id,
        memberType: "human",
        displayName: name,
        teamRole: name,
      });
    }

    console.log(`   Team: ${teamData.name}`);
  }
  console.log();

  // 4. Insert workflow instances
  console.log("4. Inserting workflow instances...");
  const workflowsData = [
    {
      topicId: "ht1",
      topicTitle: "AI手机大战：华为、苹果、三星三方角力",
      startedAt: new Date("2026-02-26T08:20:00Z"),
      estimatedCompletion: new Date("2026-02-26T14:00:00Z"),
      steps: [
        { key: "monitor", label: "热点监控", slug: "xiaolei", order: 1, status: "completed" as const, progress: 100, output: "热度97，急升中，建议P0级追踪", startedAt: new Date("2026-02-26T08:20:00Z"), completedAt: new Date("2026-02-26T08:25:00Z") },
        { key: "plan", label: "选题策划", slug: "xiaoce", order: 2, status: "completed" as const, progress: 100, output: "已生成3个差异化角度", startedAt: new Date("2026-02-26T08:25:00Z"), completedAt: new Date("2026-02-26T08:40:00Z") },
        { key: "material", label: "素材准备", slug: "xiaozi", order: 3, status: "completed" as const, progress: 100, output: "16个素材文件已准备就绪", startedAt: new Date("2026-02-26T08:40:00Z"), completedAt: new Date("2026-02-26T09:00:00Z") },
        { key: "create", label: "内容创作", slug: "xiaowen", order: 4, status: "completed" as const, progress: 100, output: "2800字长文初稿完成", startedAt: new Date("2026-02-26T09:00:00Z"), completedAt: new Date("2026-02-26T11:30:00Z") },
        { key: "produce", label: "视频制作", slug: "xiaojian", order: 5, status: "active" as const, progress: 75, output: "58秒短视频制作中", startedAt: new Date("2026-02-26T11:30:00Z"), completedAt: null },
        { key: "review", label: "质量审核", slug: "xiaoshen", order: 6, status: "completed" as const, progress: 100, output: "综合评分92/100，建议通过", startedAt: new Date("2026-02-26T12:30:00Z"), completedAt: new Date("2026-02-26T12:35:00Z") },
        { key: "publish", label: "渠道发布", slug: "xiaofa", order: 7, status: "pending" as const, progress: 0, output: null, startedAt: null, completedAt: null },
        { key: "analyze", label: "数据分析", slug: "xiaoshu", order: 8, status: "pending" as const, progress: 0, output: null, startedAt: null, completedAt: null },
      ],
    },
    {
      topicId: "ht2",
      topicTitle: "新能源汽车集体降价潮来袭",
      startedAt: new Date("2026-02-26T07:45:00Z"),
      estimatedCompletion: new Date("2026-02-26T15:00:00Z"),
      steps: [
        { key: "monitor", label: "热点监控", slug: "xiaolei", order: 1, status: "completed" as const, progress: 100, output: "热度93，持续上升", startedAt: new Date("2026-02-26T07:45:00Z"), completedAt: new Date("2026-02-26T07:50:00Z") },
        { key: "plan", label: "选题策划", slug: "xiaoce", order: 2, status: "completed" as const, progress: 100, output: "3个选题角度已生成", startedAt: new Date("2026-02-26T07:50:00Z"), completedAt: new Date("2026-02-26T08:10:00Z") },
        { key: "material", label: "素材准备", slug: "xiaozi", order: 3, status: "completed" as const, progress: 100, output: "降价海报+4S店素材已就绪", startedAt: new Date("2026-02-26T08:10:00Z"), completedAt: new Date("2026-02-26T08:30:00Z") },
        { key: "create", label: "内容创作", slug: "xiaowen", order: 4, status: "active" as const, progress: 60, output: "深度分析稿件撰写中(60%)", startedAt: new Date("2026-02-26T09:00:00Z"), completedAt: null },
        { key: "produce", label: "视频制作", slug: "xiaojian", order: 5, status: "pending" as const, progress: 0, output: null, startedAt: null, completedAt: null },
        { key: "review", label: "质量审核", slug: "xiaoshen", order: 6, status: "pending" as const, progress: 0, output: null, startedAt: null, completedAt: null },
        { key: "publish", label: "渠道发布", slug: "xiaofa", order: 7, status: "pending" as const, progress: 0, output: null, startedAt: null, completedAt: null },
        { key: "analyze", label: "数据分析", slug: "xiaoshu", order: 8, status: "pending" as const, progress: 0, output: null, startedAt: null, completedAt: null },
      ],
    },
  ];

  for (const wfData of workflowsData) {
    const [instance] = await db
      .insert(schema.workflowInstances)
      .values({
        topicId: wfData.topicId,
        topicTitle: wfData.topicTitle,
        startedAt: wfData.startedAt,
        estimatedCompletion: wfData.estimatedCompletion,
      })
      .returning();

    for (const step of wfData.steps) {
      await db.insert(schema.workflowSteps).values({
        workflowInstanceId: instance.id,
        key: step.key,
        label: step.label,
        employeeId: employeeMap.get(step.slug),
        stepOrder: step.order,
        status: step.status,
        progress: step.progress,
        output: step.output,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
      });
    }

    console.log(`   Workflow: ${wfData.topicTitle}`);
  }
  console.log();

  // 5. Insert team messages
  console.log("5. Inserting team messages...");
  const messagesData = [
    { slug: "xiaolei", type: "alert" as const, content: "紧急热点预警！「AI手机大战」话题热度在过去1小时内飙升120%，目前热度指数97，建议立即启动追踪流程。", timestamp: "2026-02-26T12:05:00Z" },
    { slug: "xiaoce", type: "decision_request" as const, content: "针对「AI手机大战」热点，我策划了3个差异化角度，请选择优先执行的方向：\n\n1. 消费者视角：三款AI手机实测对比\n2. 行业分析：AI手机重新定义智能体验\n3. 投资观点：AI手机产业链机会", timestamp: "2026-02-26T12:08:00Z" },
    { slug: "xiaozi", type: "status_update" as const, content: "已为「AI手机大战」选题准备好素材包：\n- 华为发布会高清视频片段 x3\n- 苹果AI功能演示截图 x8\n- 三星Galaxy AI宣传图 x5\n- 版权状态：全部可用", timestamp: "2026-02-26T12:12:00Z" },
    { slug: "xiaowen", type: "work_output" as const, content: "《AI手机大战：消费者的三重抉择》初稿已完成（2800字），已发送至小审审核。", timestamp: "2026-02-26T12:25:00Z" },
    { slug: "xiaoshen", type: "status_update" as const, content: "《AI手机大战》稿件审核完成，综合评分 92/100：\n- 事实准确性：95 ✓\n- 敏感内容检测：通过 ✓\n- 风格一致性：90 ✓", timestamp: "2026-02-26T12:35:00Z" },
    { slug: "xiaolei", type: "alert" as const, content: "新热点捕获：「新能源汽车集体降价潮」，热度指数93，建议优先级P0。", timestamp: "2026-02-26T11:30:00Z" },
    { slug: "xiaoshu", type: "work_output" as const, content: "本周数据周报已生成：\n- 总阅读量：125.6万（+18.3%）\n- 爆款率：23%\n- 最佳渠道：抖音（环比+32%）", timestamp: "2026-02-26T10:00:00Z" },
    { slug: "xiaojian", type: "work_output" as const, content: "「AI手机大战」短视频已制作完成：\n- 时长：58秒\n- 封面：自动生成3版\n- 字幕：中文硬字幕已嵌入", timestamp: "2026-02-26T13:15:00Z" },
  ];

  for (const msg of messagesData) {
    await db.insert(schema.teamMessages).values({
      senderType: "ai",
      aiEmployeeId: employeeMap.get(msg.slug),
      type: msg.type,
      content: msg.content,
      createdAt: new Date(msg.timestamp),
    });
  }
  console.log(`   Inserted ${messagesData.length} messages\n`);

  // 6. Insert knowledge bases
  console.log("6. Inserting knowledge bases...");
  const knowledgeBasesData = [
    { name: "新闻行业知识库", description: "包含新闻写作规范、行业术语、报道标准等", type: "general", documentCount: 156 },
    { name: "频道风格指南", description: "频道特有的写作风格、排版规范、配色方案", type: "channel_style", documentCount: 42 },
    { name: "敏感话题处理手册", description: "政治、法律、伦理等敏感话题的处理规范和审查标准", type: "sensitive_topics", documentCount: 78 },
    { name: "AI科技领域专业库", description: "AI芯片、大模型、智能终端等科技领域专业知识", type: "domain", documentCount: 234 },
  ];

  const kbMap = new Map<string, string>();
  for (const kbData of knowledgeBasesData) {
    const [kb] = await db
      .insert(schema.knowledgeBases)
      .values({
        organizationId: org.id,
        ...kbData,
      })
      .returning();
    kbMap.set(kbData.name, kb.id);
    console.log(`   KB: ${kbData.name}`);
  }

  // Bind knowledge bases to employees
  const kbBindings = [
    { slug: "xiaolei", kbs: ["新闻行业知识库", "AI科技领域专业库"] },
    { slug: "xiaoce", kbs: ["新闻行业知识库", "频道风格指南"] },
    { slug: "xiaowen", kbs: ["新闻行业知识库", "频道风格指南", "AI科技领域专业库"] },
    { slug: "xiaoshen", kbs: ["敏感话题处理手册", "新闻行业知识库"] },
    { slug: "xiaoshu", kbs: ["AI科技领域专业库"] },
  ];

  for (const binding of kbBindings) {
    const empId = employeeMap.get(binding.slug);
    if (!empId) continue;
    for (const kbName of binding.kbs) {
      const kbId = kbMap.get(kbName);
      if (!kbId) continue;
      await db.insert(schema.employeeKnowledgeBases).values({
        employeeId: empId,
        knowledgeBaseId: kbId,
      });
    }
  }
  console.log(`   Bound knowledge bases to employees\n`);

  // 7. Insert workflow templates
  console.log("7. Inserting workflow templates...");
  const templatesData = [
    {
      name: "快讯工作流",
      description: "突发新闻快速响应，15分钟内完成从监控到发布的全流程",
      steps: [
        { key: "monitor", label: "热点监控", employeeSlug: "xiaolei", order: 1 },
        { key: "plan", label: "选题策划", employeeSlug: "xiaoce", order: 2 },
        { key: "create", label: "内容创作", employeeSlug: "xiaowen", order: 3 },
        { key: "review", label: "质量审核", employeeSlug: "xiaoshen", order: 4 },
        { key: "publish", label: "渠道发布", employeeSlug: "xiaofa", order: 5 },
      ],
    },
    {
      name: "深度报道工作流",
      description: "深度调研+数据分析+多媒体制作，高质量长文全流程",
      steps: [
        { key: "monitor", label: "热点监控", employeeSlug: "xiaolei", order: 1 },
        { key: "plan", label: "选题策划", employeeSlug: "xiaoce", order: 2 },
        { key: "material", label: "素材准备", employeeSlug: "xiaozi", order: 3 },
        { key: "create", label: "内容创作", employeeSlug: "xiaowen", order: 4 },
        { key: "produce", label: "视频制作", employeeSlug: "xiaojian", order: 5 },
        { key: "review", label: "质量审核", employeeSlug: "xiaoshen", order: 6 },
        { key: "publish", label: "渠道发布", employeeSlug: "xiaofa", order: 7 },
        { key: "analyze", label: "数据分析", employeeSlug: "xiaoshu", order: 8 },
      ],
    },
  ];

  for (const tmpl of templatesData) {
    await db.insert(schema.workflowTemplates).values({
      organizationId: org.id,
      name: tmpl.name,
      description: tmpl.description,
      steps: tmpl.steps,
    });
    console.log(`   Template: ${tmpl.name}`);
  }
  console.log();

  // 8. Insert categories (tree structure)
  console.log("8. Inserting categories...");
  const categoryMap = new Map<string, string>();

  const rootCategories = [
    { name: "时政要闻", slug: "politics", description: "政治、政策、两会等重要时政报道" },
    { name: "科技前沿", slug: "technology", description: "AI、芯片、新能源等科技领域" },
    { name: "财经观察", slug: "finance", description: "宏观经济、资本市场、企业动态" },
  ];

  for (const cat of rootCategories) {
    const [row] = await db
      .insert(schema.categories)
      .values({ organizationId: org.id, ...cat, level: 0, sortOrder: rootCategories.indexOf(cat) })
      .returning();
    categoryMap.set(cat.slug, row.id);
    console.log(`   Root: ${cat.name}`);
  }

  const childCategories = [
    { name: "政策解读", slug: "policy", description: "政策深度解读与分析", parentSlug: "politics" },
    { name: "两会专题", slug: "lianghui", description: "全国两会系列报道", parentSlug: "politics" },
    { name: "人工智能", slug: "ai", description: "AI大模型、智能终端", parentSlug: "technology" },
    { name: "新能源汽车", slug: "new-energy", description: "新能源车企动态与评测", parentSlug: "technology" },
    { name: "消费电子", slug: "consumer-electronics", description: "手机、电脑、智能穿戴", parentSlug: "technology" },
    { name: "资本市场", slug: "capital-market", description: "股市、基金、IPO", parentSlug: "finance" },
    { name: "宏观经济", slug: "macro-economy", description: "GDP、CPI、货币政策", parentSlug: "finance" },
  ];

  for (let i = 0; i < childCategories.length; i++) {
    const cat = childCategories[i];
    const parentId = categoryMap.get(cat.parentSlug);
    const [row] = await db
      .insert(schema.categories)
      .values({
        organizationId: org.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        parentId,
        level: 1,
        sortOrder: i,
      })
      .returning();
    categoryMap.set(cat.slug, row.id);
    console.log(`   Child: ${cat.name} -> ${cat.parentSlug}`);
  }
  console.log();

  // 9. Insert media assets
  console.log("9. Inserting media assets...");
  const assetMap = new Map<string, string>();
  const mediaAssetsData = [
    { title: "两会特别报道：养老金并轨改革深度解读", type: "video" as const, duration: "08:32", durationSeconds: 512, fileSize: 1288490188, fileSizeDisplay: "1.2GB", source: "央视新闻", tags: ["两会", "养老金", "改革"], categorySlug: "lianghui", status: "completed" as const, progress: 100, totalTags: 47 },
    { title: "华为Mate 70发布会精华片段", type: "video" as const, duration: "12:45", durationSeconds: 765, fileSize: 2147483648, fileSizeDisplay: "2.0GB", source: "华为官方", tags: ["华为", "手机", "AI"], categorySlug: "consumer-electronics", status: "completed" as const, progress: 100, totalTags: 32 },
    { title: "新能源汽车降价潮分析图表", type: "image" as const, fileSize: 5242880, fileSizeDisplay: "5MB", source: "数据部", tags: ["新能源", "降价", "图表"], categorySlug: "new-energy", status: "completed" as const, progress: 100, totalTags: 8 },
    { title: "AI手机评测素材合集", type: "video" as const, duration: "25:10", durationSeconds: 1510, fileSize: 4294967296, fileSizeDisplay: "4.0GB", source: "评测团队", tags: ["AI手机", "评测", "苹果", "三星"], categorySlug: "ai", status: "processing" as const, progress: 65, totalTags: 0 },
    { title: "2026年经济工作会议录音", type: "audio" as const, duration: "45:00", durationSeconds: 2700, fileSize: 67108864, fileSizeDisplay: "64MB", source: "新华社", tags: ["经济", "会议", "政策"], categorySlug: "macro-economy", status: "completed" as const, progress: 100, totalTags: 23 },
    { title: "GPT-5技术白皮书", type: "document" as const, fileSize: 10485760, fileSizeDisplay: "10MB", source: "OpenAI", tags: ["GPT-5", "大模型", "技术"], categorySlug: "ai", status: "queued" as const, progress: 0, totalTags: 0 },
    { title: "中美贸易谈判新闻发布会", type: "video" as const, duration: "35:20", durationSeconds: 2120, fileSize: 3221225472, fileSizeDisplay: "3.0GB", source: "商务部", tags: ["中美贸易", "外交", "关税"], categorySlug: "politics", status: "completed" as const, progress: 100, totalTags: 56 },
    { title: "特斯拉Model Y改款发布现场", type: "video" as const, duration: "15:30", durationSeconds: 930, fileSize: 1610612736, fileSizeDisplay: "1.5GB", source: "Tesla官方", tags: ["特斯拉", "电动车", "发布会"], categorySlug: "new-energy", status: "completed" as const, progress: 100, totalTags: 28 },
    { title: "A股市场数据周报", type: "document" as const, fileSize: 2097152, fileSizeDisplay: "2MB", source: "数据部", tags: ["A股", "周报", "数据分析"], categorySlug: "capital-market", status: "completed" as const, progress: 100, totalTags: 15 },
    { title: "AI芯片产业链全景图", type: "image" as const, fileSize: 8388608, fileSizeDisplay: "8MB", source: "研究院", tags: ["芯片", "AI", "产业链"], categorySlug: "ai", status: "completed" as const, progress: 100, totalTags: 12 },
    { title: "养老金并轨政策文件汇编", type: "document" as const, fileSize: 15728640, fileSizeDisplay: "15MB", source: "人社部", tags: ["养老金", "政策", "并轨"], categorySlug: "policy", status: "queued" as const, progress: 0, totalTags: 0 },
    { title: "春节消费大数据报告配图", type: "image" as const, fileSize: 3145728, fileSizeDisplay: "3MB", source: "数据部", tags: ["春节", "消费", "数据"], categorySlug: "macro-economy", status: "completed" as const, progress: 100, totalTags: 6 },
  ];

  for (const asset of mediaAssetsData) {
    const [row] = await db
      .insert(schema.mediaAssets)
      .values({
        organizationId: org.id,
        title: asset.title,
        type: asset.type,
        duration: asset.duration || null,
        durationSeconds: asset.durationSeconds || null,
        fileSize: asset.fileSize,
        fileSizeDisplay: asset.fileSizeDisplay,
        source: asset.source,
        tags: asset.tags,
        categoryId: categoryMap.get(asset.categorySlug) || null,
        understandingStatus: asset.status,
        understandingProgress: asset.progress,
        totalTags: asset.totalTags,
        processedAt: asset.status === "completed" ? new Date() : null,
      })
      .returning();
    assetMap.set(asset.title, row.id);
    console.log(`   Asset: ${asset.title}`);
  }
  console.log();

  // 10. Insert articles
  console.log("10. Inserting articles...");
  const articlesData = [
    { title: "AI手机大战：消费者的三重抉择", mediaType: "article", status: "published" as const, categorySlug: "consumer-electronics", assigneeSlug: "xiaowen", body: "华为、苹果、三星三方角力，消费者该如何选择？本文从性能、生态、价格三个维度深度对比...", wordCount: 2800, tags: ["AI手机", "华为", "苹果", "三星"], publishedAt: new Date("2026-02-27T10:00:00Z") },
    { title: "新能源汽车集体降价潮深度分析", mediaType: "article", status: "reviewing" as const, categorySlug: "new-energy", assigneeSlug: "xiaowen", body: "进入2026年，新能源汽车市场迎来新一轮价格战。特斯拉率先打响第一枪...", wordCount: 3500, tags: ["新能源", "降价", "特斯拉"] },
    { title: "两会养老金改革全解读", mediaType: "video", status: "approved" as const, categorySlug: "lianghui", assigneeSlug: "xiaowen", body: "养老金并轨改革在两会期间引发热议，我们梳理了改革的来龙去脉...", wordCount: 1500, tags: ["两会", "养老金", "改革"] },
    { title: "GPT-5来了：大模型竞争进入新纪元", mediaType: "article", status: "draft" as const, categorySlug: "ai", assigneeSlug: "xiaowen", body: "", wordCount: 0, tags: ["GPT-5", "大模型", "AI竞争"] },
    { title: "春节消费大数据：三线城市增速超北上广", mediaType: "article", status: "published" as const, categorySlug: "macro-economy", assigneeSlug: "xiaoshu", body: "春节期间全国消费数据出炉，三四线城市消费增速首次超过一线城市...", wordCount: 2200, tags: ["春节", "消费", "数据"], publishedAt: new Date("2026-02-20T08:00:00Z") },
    { title: "A股牛市信号？三大指标同时转正", mediaType: "article", status: "draft" as const, categorySlug: "capital-market", assigneeSlug: "xiaowen", body: "沪深300、创业板指、北向资金三大指标同时出现积极信号...", wordCount: 800, tags: ["A股", "牛市", "投资"] },
    { title: "中美贸易谈判最新进展速递", mediaType: "article", status: "approved" as const, categorySlug: "politics", assigneeSlug: "xiaowen", body: "商务部最新发布的声明显示，中美贸易代表将于下月举行新一轮面对面会谈...", wordCount: 1200, tags: ["中美贸易", "外交"] },
    { title: "特斯拉Model Y改款深度评测", mediaType: "video", status: "reviewing" as const, categorySlug: "new-energy", assigneeSlug: "xiaojian", body: "全新Model Y在外观、续航、智驾三方面均有显著提升...", wordCount: 1800, tags: ["特斯拉", "评测", "电动车"] },
  ];

  for (const article of articlesData) {
    await db.insert(schema.articles).values({
      organizationId: org.id,
      title: article.title,
      mediaType: article.mediaType,
      status: article.status,
      categoryId: categoryMap.get(article.categorySlug) || null,
      assigneeId: employeeMap.get(article.assigneeSlug) || null,
      body: article.body,
      wordCount: article.wordCount,
      tags: article.tags,
      publishedAt: article.publishedAt || null,
      content: { headline: article.title, body: article.body, imageNotes: [] },
    });
    console.log(`   Article: ${article.title} (${article.status})`);
  }
  console.log();

  // 11. Insert asset segments and tags for first asset
  console.log("11. Inserting asset segments & tags...");
  const firstAssetId = assetMap.get("两会特别报道：养老金并轨改革深度解读")!;
  const segmentsData = [
    { startTime: "00:00", endTime: "01:45", startTimeSeconds: 0, endTimeSeconds: 105, transcript: "各位观众大家好，欢迎收看两会特别报道。今天我们将深入解读养老金并轨改革的最新进展。", ocrTexts: ["两会特别报道", "养老金并轨改革"], nluSummary: "节目开场，介绍养老金并轨改革背景", sceneType: "演播室", visualQuality: 95, order: 1 },
    { startTime: "01:45", endTime: "03:30", startTimeSeconds: 105, endTimeSeconds: 210, transcript: "记者采访了人社部相关负责人，详细介绍了并轨后养老金计发办法的变化。", ocrTexts: ["人社部", "计发办法"], nluSummary: "记者采访人社部官员，解读计算方法变化", sceneType: "采访", visualQuality: 92, order: 2 },
    { startTime: "03:30", endTime: "05:15", startTimeSeconds: 210, endTimeSeconds: 315, transcript: "数据显示，并轨后企业退休人员养老金待遇将逐步提升，预计到2030年实现完全统一。", ocrTexts: ["数据对比", "2030年"], nluSummary: "数据可视化展示改革进度与预期", sceneType: "图表展示", visualQuality: 90, order: 3 },
  ];

  const segmentIds: string[] = [];
  for (const seg of segmentsData) {
    const [row] = await db
      .insert(schema.assetSegments)
      .values({
        assetId: firstAssetId,
        startTime: seg.startTime,
        endTime: seg.endTime,
        startTimeSeconds: seg.startTimeSeconds,
        endTimeSeconds: seg.endTimeSeconds,
        transcript: seg.transcript,
        ocrTexts: seg.ocrTexts,
        nluSummary: seg.nluSummary,
        sceneType: seg.sceneType,
        visualQuality: seg.visualQuality,
        segmentOrder: seg.order,
      })
      .returning();
    segmentIds.push(row.id);
  }
  console.log(`   ${segmentsData.length} segments inserted`);

  // Tags for the first asset
  const tagsData = [
    { category: "topic" as const, label: "养老金改革", confidence: 0.97, segIdx: 0 },
    { category: "event" as const, label: "两会报道", confidence: 0.95, segIdx: 0 },
    { category: "shotType" as const, label: "中景", confidence: 0.88, segIdx: 0 },
    { category: "emotion" as const, label: "严肃客观", confidence: 0.92, segIdx: 0 },
    { category: "person" as const, label: "人社部官员", confidence: 0.91, segIdx: 1 },
    { category: "topic" as const, label: "政策解读", confidence: 0.94, segIdx: 1 },
    { category: "shotType" as const, label: "采访特写", confidence: 0.90, segIdx: 1 },
    { category: "action" as const, label: "采访", confidence: 0.93, segIdx: 1 },
    { category: "topic" as const, label: "数据可视化", confidence: 0.89, segIdx: 2 },
    { category: "object" as const, label: "图表", confidence: 0.86, segIdx: 2 },
  ];

  for (const tag of tagsData) {
    await db.insert(schema.assetTags).values({
      assetId: firstAssetId,
      segmentId: segmentIds[tag.segIdx],
      category: tag.category,
      label: tag.label,
      confidence: tag.confidence,
    });
  }
  console.log(`   ${tagsData.length} tags inserted`);

  // Detected faces
  await db.insert(schema.detectedFaces).values({
    segmentId: segmentIds[0],
    assetId: firstAssetId,
    name: "主持人李明",
    role: "主持人",
    confidence: 0.96,
    appearances: 4,
  });
  await db.insert(schema.detectedFaces).values({
    segmentId: segmentIds[1],
    assetId: firstAssetId,
    name: "记者王芳",
    role: "记者",
    confidence: 0.94,
    appearances: 3,
  });
  console.log("   2 detected faces inserted\n");

  // 12. Insert channel advisors
  console.log("12. Inserting channel advisors...");
  const advisorsData = [
    { name: "老陈", channelType: "微信公众号（深度分析）", personality: "资深新闻人，严谨理性，注重事实核查", avatar: "陈", style: "严谨专业、数据驱动、长文见长", strengths: ["深度分析能力强", "政经解读专业", "标题克制有品质感"], catchphrase: "数据说话，事实先行。", status: "active" as const, targetAudience: "25-45岁，关注时政财经的专业人士", channelPositioning: "深度分析型公众号，主打高质量长文" },
    { name: "小暖", channelType: "小红书（生活方式）", personality: "温暖亲切的生活方式博主，擅长情感共鸣", avatar: "暖", style: "温暖治愈、图文精美、善用emoji和口语化表达", strengths: ["情感共鸣强", "视觉排版优秀", "互动率高"], catchphrase: "生活处处有惊喜~", status: "active" as const, targetAudience: "18-35岁女性，追求品质生活", channelPositioning: "生活方式博主，温暖治愈风" },
    { name: "阿强", channelType: "抖音+B站（科技评测）", personality: "热血科技迷，说话直接，喜欢用数据和评测说话", avatar: "强", style: "直接犀利、节奏快、梗多、信息密度高", strengths: ["节奏把控好", "技术讲解通俗", "封面吸睛"], catchphrase: "这波操作，我给满分！", status: "active" as const, targetAudience: "16-30岁科技爱好者", channelPositioning: "科技评测达人，硬核but通俗" },
    { name: "学姐", channelType: "头条号+知乎（财经分析）", personality: "知性理性的财经分析师，逻辑清晰", avatar: "姐", style: "逻辑严密、观点独到、善用类比和框架", strengths: ["逻辑框架清晰", "宏观视角好", "读者信任度高"], catchphrase: "透过数字看本质。", status: "active" as const, targetAudience: "25-50岁，有投资理财需求的中产", channelPositioning: "财经分析专家，理性有深度" },
  ];

  const advisorMap = new Map<string, string>();
  for (const adv of advisorsData) {
    const [row] = await db
      .insert(schema.channelAdvisors)
      .values({ organizationId: org.id, ...adv })
      .returning();
    advisorMap.set(adv.name, row.id);
    console.log(`   Advisor: ${adv.name} (${adv.channelType})`);
  }

  // Channel DNA for first advisor
  await db.insert(schema.channelDnaProfiles).values({
    advisorId: advisorMap.get("老陈")!,
    dimensions: [
      { dimension: "专业深度", score: 92 },
      { dimension: "时效性", score: 78 },
      { dimension: "可读性", score: 85 },
      { dimension: "互动性", score: 65 },
      { dimension: "视觉表达", score: 70 },
      { dimension: "情感共鸣", score: 60 },
    ],
    report: "老陈的频道风格以深度分析见长，专业性得分最高(92)，适合长文深度报道类内容。互动性和情感共鸣维度较弱，建议适当增加读者互动环节。",
    analyzedAt: new Date(),
  });
  console.log();

  // 13. Insert knowledge items and sync logs
  console.log("13. Inserting knowledge items & sync logs...");
  const firstKbId = kbMap.get("新闻行业知识库")!;

  const knowledgeItemsData = [
    { title: "新闻写作五要素", snippet: "新闻写作必须包含When、Where、Who、What、Why五个基本要素...", sourceDocument: "新闻写作规范手册.pdf", tags: ["写作规范", "基础知识"] },
    { title: "标题写作技巧", snippet: "好的标题应该简洁有力，包含核心信息，避免标题党...", sourceDocument: "标题艺术.pdf", tags: ["标题", "写作技巧"] },
    { title: "数据引用规范", snippet: "引用数据时必须标注数据来源、统计时间范围和统计口径...", sourceDocument: "数据引用指南.pdf", tags: ["数据", "引用规范"] },
    { title: "敏感话题处理原则", snippet: "涉及国家安全、民族宗教、未成年人等话题需特别审慎...", sourceDocument: "敏感话题处理手册.pdf", tags: ["敏感话题", "审核"] },
  ];

  for (const item of knowledgeItemsData) {
    await db.insert(schema.knowledgeItems).values({
      knowledgeBaseId: firstKbId,
      title: item.title,
      snippet: item.snippet,
      sourceDocument: item.sourceDocument,
      tags: item.tags,
      sourceType: "upload",
      chunkIndex: knowledgeItemsData.indexOf(item),
      relevanceScore: 0.85 + Math.random() * 0.15,
    });
  }
  console.log(`   ${knowledgeItemsData.length} knowledge items inserted`);

  await db.insert(schema.knowledgeSyncLogs).values({
    knowledgeBaseId: firstKbId,
    action: "初始导入",
    status: "success",
    detail: "成功导入156篇文档，生成423个知识块",
    documentsProcessed: 156,
    chunksGenerated: 423,
    errorsCount: 0,
  });
  await db.insert(schema.knowledgeSyncLogs).values({
    knowledgeBaseId: firstKbId,
    action: "增量同步",
    status: "success",
    detail: "新增12篇文档，更新8篇，生成54个新知识块",
    documentsProcessed: 20,
    chunksGenerated: 54,
    errorsCount: 0,
  });
  console.log("   2 sync logs inserted\n");

  // 14. Insert knowledge graph nodes and relations
  console.log("14. Inserting knowledge graph...");
  const nodeMap = new Map<string, string>();
  const nodesData = [
    { entityType: "topic" as const, entityName: "养老金改革", description: "中国养老保险制度并轨改革", connectionCount: 5 },
    { entityType: "person" as const, entityName: "李强", description: "国务院总理", connectionCount: 3 },
    { entityType: "event" as const, entityName: "2026全国两会", description: "第十四届全国人民代表大会第四次会议", connectionCount: 6 },
    { entityType: "organization" as const, entityName: "人力资源和社会保障部", description: "国务院组成部门", connectionCount: 4 },
    { entityType: "topic" as const, entityName: "AI手机", description: "集成AI大模型能力的智能手机", connectionCount: 4 },
    { entityType: "person" as const, entityName: "余承东", description: "华为常务董事", connectionCount: 3 },
    { entityType: "location" as const, entityName: "北京", description: "中国首都", connectionCount: 5 },
    { entityType: "event" as const, entityName: "新能源降价潮", description: "2026年新能源汽车集体降价事件", connectionCount: 3 },
  ];

  for (const node of nodesData) {
    const [row] = await db
      .insert(schema.knowledgeNodes)
      .values({ organizationId: org.id, ...node })
      .returning();
    nodeMap.set(node.entityName, row.id);
  }
  console.log(`   ${nodesData.length} nodes inserted`);

  const relationsData = [
    { source: "养老金改革", target: "2026全国两会", relationType: "discussed_at", weight: 0.95 },
    { source: "养老金改革", target: "人力资源和社会保障部", relationType: "managed_by", weight: 0.9 },
    { source: "李强", target: "2026全国两会", relationType: "participates_in", weight: 0.88 },
    { source: "AI手机", target: "余承东", relationType: "promoted_by", weight: 0.85 },
    { source: "2026全国两会", target: "北京", relationType: "located_in", weight: 0.99 },
    { source: "新能源降价潮", target: "北京", relationType: "impacts", weight: 0.7 },
  ];

  for (const rel of relationsData) {
    await db.insert(schema.knowledgeRelations_).values({
      sourceNodeId: nodeMap.get(rel.source)!,
      targetNodeId: nodeMap.get(rel.target)!,
      relationType: rel.relationType,
      weight: rel.weight,
    });
  }
  console.log(`   ${relationsData.length} relations inserted\n`);

  // 15. Insert revive recommendations
  console.log("15. Inserting revive recommendations...");
  const reviveData = [
    { assetTitle: "两会特别报道：养老金并轨改革深度解读", scenario: "topic_match" as const, matchedTopic: "养老金改革最新政策", reason: "与当前热点话题高度相关", matchScore: 0.92, suggestedAction: "剪辑核心片段，配合最新政策数据重新发布", estimatedReach: "50万+", status: "pending" as const },
    { assetTitle: "华为Mate 70发布会精华片段", scenario: "hot_match" as const, matchedTopic: "AI手机大战", reason: "与AI手机热点直接相关", matchScore: 0.88, suggestedAction: "提取AI功能演示片段，制作对比视频", estimatedReach: "80万+", status: "adopted" as const },
    { assetTitle: "特斯拉Model Y改款发布现场", scenario: "daily_push" as const, matchedTopic: "新能源汽车降价潮", reason: "特斯拉相关素材可复用于降价分析报道", matchScore: 0.78, suggestedAction: "结合降价数据，重新包装发布", estimatedReach: "30万+", status: "pending" as const },
    { assetTitle: "中美贸易谈判新闻发布会", scenario: "intl_broadcast" as const, matchedTopic: "中美贸易最新进展", reason: "适合国际传播渠道二次发布", matchScore: 0.85, suggestedAction: "翻译配音后投放海外平台", estimatedReach: "100万+", status: "pending" as const },
  ];

  for (const rec of reviveData) {
    const assetId = assetMap.get(rec.assetTitle);
    if (!assetId) continue;
    await db.insert(schema.reviveRecommendations).values({
      organizationId: org.id,
      assetId,
      scenario: rec.scenario,
      matchedTopic: rec.matchedTopic,
      reason: rec.reason,
      matchScore: rec.matchScore,
      suggestedAction: rec.suggestedAction,
      estimatedReach: rec.estimatedReach,
      status: rec.status,
    });
    console.log(`   Revive: ${rec.assetTitle} (${rec.scenario})`);
  }
  console.log();

  // -----------------------------------------------------------------------
  // Module 3: Omnichannel Distribution
  // -----------------------------------------------------------------------

  // 16. Insert channels (F3.1.07)
  console.log("16. Inserting channels...");
  const channelMap = new Map<string, string>();
  const channelsData = [
    { name: "微信公众号", platform: "wechat", icon: "MessageSquare", followers: 285000, status: "active" as const },
    { name: "头条号", platform: "toutiao", icon: "Newspaper", followers: 520000, status: "active" as const },
    { name: "抖音", platform: "douyin", icon: "Play", followers: 1230000, status: "active" as const },
    { name: "微博", platform: "weibo", icon: "AtSign", followers: 380000, status: "active" as const },
    { name: "百家号", platform: "baidu", icon: "Globe", followers: 195000, status: "active" as const },
    { name: "B站", platform: "bilibili", icon: "Tv", followers: 89000, status: "active" as const },
    { name: "小红书", platform: "xiaohongshu", icon: "BookOpen", followers: 156000, status: "active" as const },
    { name: "知乎", platform: "zhihu", icon: "HelpCircle", followers: 72000, status: "paused" as const },
  ];

  for (const ch of channelsData) {
    const [row] = await db
      .insert(schema.channels)
      .values({ organizationId: org.id, ...ch })
      .returning();
    channelMap.set(ch.platform, row.id);
    console.log(`   Channel: ${ch.name} (${ch.platform})`);
  }
  console.log();

  // 17. Insert publish plans
  console.log("17. Inserting publish plans...");
  const publishPlansData: {
    channelPlatform: string;
    title: string;
    scheduledAt: string;
    status: "published" | "scheduled";
    publishedAt?: string;
    adaptedContent?: { headline?: string; body?: string; tags?: string[]; format?: string };
  }[] = [
    { channelPlatform: "wechat", title: "AI手机大战：消费者的三重抉择", scheduledAt: "2026-02-26T14:00:00Z", status: "published", publishedAt: "2026-02-26T14:01:00Z",
      adaptedContent: { headline: "AI手机大战：消费者的三重抉择", body: "华为、苹果、三星三大阵营的AI手机之战正式打响...", tags: ["AI手机", "华为", "苹果", "深度分析"], format: "long-article" } },
    { channelPlatform: "toutiao", title: "AI手机大战：消费者的三重抉择", scheduledAt: "2026-02-26T14:30:00Z", status: "published", publishedAt: "2026-02-26T14:31:00Z",
      adaptedContent: { headline: "三大手机巨头AI对决，消费者该选谁？", body: "AI手机三国杀：华为鸿蒙、苹果Siri Pro、三星Galaxy AI全面对比...", tags: ["AI手机", "科技", "评测"], format: "standard" } },
    { channelPlatform: "douyin", title: "60秒看懂AI手机大战", scheduledAt: "2026-02-26T15:00:00Z", status: "published", publishedAt: "2026-02-26T15:00:00Z",
      adaptedContent: { headline: "60秒看懂AI手机大战", body: "三大品牌AI功能速览，谁才是真正的AI手机？", tags: ["AI手机", "科技", "测评", "数码"], format: "short-video" } },
    { channelPlatform: "weibo", title: "AI手机大战：消费者的三重抉择", scheduledAt: "2026-02-26T14:00:00Z", status: "published", publishedAt: "2026-02-26T14:02:00Z",
      adaptedContent: { headline: "#AI手机大战# 你站哪队？", body: "华为、苹果、三星AI手机三选一，你怎么选？", tags: ["AI手机大战", "华为", "苹果", "三星"], format: "weibo-post" } },
    { channelPlatform: "bilibili", title: "60秒看懂AI手机大战", scheduledAt: "2026-02-26T16:00:00Z", status: "published", publishedAt: "2026-02-26T16:00:00Z",
      adaptedContent: { headline: "【科技速报】60秒看懂AI手机大战", body: "三大品牌AI功能深度拆解...", tags: ["科技", "AI", "手机", "评测"], format: "bilibili-video" } },
    { channelPlatform: "wechat", title: "新能源降价潮深度分析", scheduledAt: "2026-02-27T08:00:00Z", status: "scheduled",
      adaptedContent: { headline: "新能源降价潮深度分析：谁在流血，谁在获利", body: "2026年开年新能源汽车价格战全面升级...", tags: ["新能源", "汽车", "降价", "分析"], format: "long-article" } },
    { channelPlatform: "toutiao", title: "新能源降价潮深度分析", scheduledAt: "2026-02-27T08:30:00Z", status: "scheduled",
      adaptedContent: { headline: "新能源车集体降价！最高降5万，背后原因揭秘", body: "开年以来已有15家车企宣布降价...", tags: ["新能源", "降价", "汽车"], format: "standard" } },
    { channelPlatform: "xiaohongshu", title: "新能源降价潮深度分析", scheduledAt: "2026-02-27T10:00:00Z", status: "scheduled",
      adaptedContent: { headline: "新能源车降价攻略｜这几款值得入手", body: "整理了最新降价车型清单，看看有没有你心仪的...", tags: ["新能源", "买车攻略", "降价", "汽车"], format: "xiaohongshu-note" } },
    { channelPlatform: "wechat", title: "两会数字经济前瞻", scheduledAt: "2026-02-27T14:00:00Z", status: "scheduled" },
    { channelPlatform: "wechat", title: "GPT-5发布：AI再进一步", scheduledAt: "2026-02-25T14:00:00Z", status: "published", publishedAt: "2026-02-25T14:00:00Z",
      adaptedContent: { headline: "GPT-5发布：AI再进一步", body: "OpenAI最新发布GPT-5，多模态能力大幅提升...", tags: ["GPT-5", "AI", "大模型"], format: "long-article" } },
    { channelPlatform: "douyin", title: "GPT-5发布速览", scheduledAt: "2026-02-25T15:00:00Z", status: "published", publishedAt: "2026-02-25T15:00:00Z",
      adaptedContent: { headline: "GPT-5来了！一分钟看完所有升级", body: "GPT-5核心升级要点速览", tags: ["GPT-5", "AI", "科技"], format: "short-video" } },
    { channelPlatform: "wechat", title: "数字人民币跨境新突破", scheduledAt: "2026-02-24T14:00:00Z", status: "published", publishedAt: "2026-02-24T14:01:00Z",
      adaptedContent: { headline: "数字人民币跨境新突破", body: "央行最新公布数字人民币跨境支付试点进展...", tags: ["数字人民币", "跨境支付", "金融科技"], format: "long-article" } },
  ];

  for (const plan of publishPlansData) {
    const channelId = channelMap.get(plan.channelPlatform);
    if (!channelId) continue;
    await db.insert(schema.publishPlans).values({
      organizationId: org.id,
      channelId,
      title: plan.title,
      scheduledAt: new Date(plan.scheduledAt),
      publishedAt: plan.publishedAt ? new Date(plan.publishedAt) : null,
      status: plan.status,
      adaptedContent: plan.adaptedContent || null,
    });
  }
  console.log(`   ${publishPlansData.length} publish plans inserted\n`);

  // 18. Insert channel metrics (7 days x 8 channels)
  console.log("18. Inserting channel metrics...");
  const metricsBase: Record<string, { views: number; likes: number; shares: number; comments: number }> = {
    wechat: { views: 45000, likes: 3200, shares: 890, comments: 420 },
    toutiao: { views: 68000, likes: 4500, shares: 1200, comments: 310 },
    douyin: { views: 185000, likes: 12000, shares: 5600, comments: 2800 },
    weibo: { views: 32000, likes: 2100, shares: 780, comments: 560 },
    baidu: { views: 28000, likes: 1800, shares: 320, comments: 180 },
    bilibili: { views: 42000, likes: 3800, shares: 1100, comments: 890 },
    xiaohongshu: { views: 56000, likes: 5200, shares: 2300, comments: 670 },
    zhihu: { views: 15000, likes: 980, shares: 210, comments: 340 },
  };

  const dates = ["2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26"];
  let metricsCount = 0;
  for (const [platform, chId] of channelMap.entries()) {
    const base = metricsBase[platform];
    if (!base) continue;
    const chData = channelsData.find((c) => c.platform === platform);
    for (let i = 0; i < dates.length; i++) {
      const mult = 0.8 + Math.random() * 0.5;
      const growth = 1 + i * 0.03;
      const views = Math.round(base.views * mult * growth);
      const likes = Math.round(base.likes * mult * growth);
      const shares = Math.round(base.shares * mult * growth);
      const comments = Math.round(base.comments * mult * growth);
      const followers = (chData?.followers || 0) + Math.round(i * (chData?.followers || 0) * 0.002);
      const engagement = parseFloat((((likes + shares + comments) / views) * 100).toFixed(2));

      await db.insert(schema.channelMetrics).values({
        organizationId: org.id,
        channelId: chId,
        date: dates[i],
        views, likes, shares, comments, followers, engagement,
      });
      metricsCount++;
    }
  }
  console.log(`   ${metricsCount} channel metrics inserted\n`);

  // 19. Insert review results (F3.1.08-12)
  console.log("19. Inserting review results...");
  const xiaoshenId = employeeMap.get("xiaoshen")!;
  const reviewsData = [
    {
      contentId: "AI手机大战：消费者的三重抉择",
      status: "approved" as const,
      score: 92,
      issues: [
        { type: "factual", severity: "low" as const, location: "第3段", description: "三星AI功能发布时间需确认", suggestion: "建议核实发布日期", resolved: true },
      ],
    },
    {
      contentId: "新能源汽车集体降价潮深度分析",
      status: "approved" as const,
      score: 88,
      issues: [
        { type: "quality", severity: "low" as const, location: "标题", description: "标题略长，可进一步精炼", suggestion: "建议缩短为15字以内", resolved: true },
        { type: "factual", severity: "medium" as const, location: "第5段", description: "降价幅度数据来源不明", suggestion: "建议标注数据来源", resolved: false },
      ],
    },
    {
      contentId: "GPT-5来了：大模型竞争进入新纪元",
      status: "rejected" as const,
      score: 45,
      issues: [
        { type: "sensitive", severity: "high" as const, location: "第2段", description: "涉及未经证实的技术参数", suggestion: "删除未经官方确认的性能数据", resolved: false },
        { type: "copyright", severity: "medium" as const, location: "配图区", description: "疑似使用未授权图片", suggestion: "替换为自有素材或已授权图片", resolved: false },
      ],
    },
  ];

  for (const rev of reviewsData) {
    await db.insert(schema.reviewResults).values({
      organizationId: org.id,
      contentId: rev.contentId,
      contentType: "article",
      reviewerEmployeeId: xiaoshenId,
      status: rev.status,
      issues: rev.issues,
      score: rev.score,
    });
    console.log(`   Review: ${rev.contentId} (${rev.status}, ${rev.score}分)`);
  }
  console.log();

  // 20. Insert case library (F3.3.02)
  console.log("20. Inserting case library...");
  const casesData = [
    {
      contentId: "case-1",
      title: "AI手机大战：消费者的三重抉择",
      channel: "微信公众号",
      score: 92,
      successFactors: { titleStrategy: "悬念式标题，引发好奇", topicAngle: "消费者视角切入，贴近读者", contentStructure: "总分总结构，逻辑清晰", emotionalResonance: "选择焦虑引发共鸣" },
      tags: ["AI手机", "华为", "苹果", "深度分析", "爆款"],
      publishedAt: "2026-02-26T14:00:00Z",
    },
    {
      contentId: "case-2",
      title: "GPT-5发布：AI再进一步",
      channel: "抖音",
      score: 88,
      successFactors: { titleStrategy: "简洁直接，信息明确", topicAngle: "技术突破角度", contentStructure: "快节奏信息密度高", emotionalResonance: "科技感带来期待" },
      tags: ["GPT-5", "AI", "大模型", "速报"],
      publishedAt: "2026-02-25T15:00:00Z",
    },
    {
      contentId: "case-3",
      title: "春节消费大数据：三线城市增速超北上广",
      channel: "头条号",
      score: 85,
      successFactors: { titleStrategy: "数据反差制造惊喜", topicAngle: "区域对比角度新颖", contentStructure: "图文结合数据可视化好", emotionalResonance: "地域自豪感" },
      tags: ["春节", "消费", "数据", "城市"],
      publishedAt: "2026-02-20T08:00:00Z",
    },
    {
      contentId: "case-4",
      title: "数字人民币跨境新突破",
      channel: "微信公众号",
      score: 82,
      successFactors: { titleStrategy: "关键词明确，SEO友好", topicAngle: "政策解读+实际影响", contentStructure: "问答体裁易读性强" },
      tags: ["数字人民币", "跨境", "金融科技"],
      publishedAt: "2026-02-24T14:00:00Z",
    },
  ];

  for (const c of casesData) {
    await db.insert(schema.caseLibrary).values({
      organizationId: org.id,
      contentId: c.contentId,
      title: c.title,
      channel: c.channel,
      score: c.score,
      successFactors: c.successFactors,
      tags: c.tags,
      publishedAt: new Date(c.publishedAt),
    });
    console.log(`   Case: ${c.title} (${c.score}分)`);
  }
  console.log();

  // 21. Insert hit predictions (F3.3.03)
  console.log("21. Inserting hit predictions...");
  const predictionsData = [
    {
      contentId: "AI手机大战：消费者的三重抉择",
      predictedScore: 85,
      actualScore: 92,
      dimensions: { titleAppeal: 88, topicRelevance: 92, contentDepth: 85, emotionalHook: 78, timingFit: 90 },
      suggestions: [],
    },
    {
      contentId: "新能源汽车集体降价潮深度分析",
      predictedScore: 78,
      actualScore: null,
      dimensions: { titleAppeal: 72, topicRelevance: 88, contentDepth: 82, emotionalHook: 70, timingFit: 85 },
      suggestions: [
        { area: "标题", current: "标题较长且平淡", recommended: "使用数字+悬念式标题", impact: "预计提升10-15%点击率" },
        { area: "情感钩子", current: "偏理性分析风格", recommended: "增加消费者故事/痛点", impact: "预计提升互动率20%" },
      ],
    },
    {
      contentId: "GPT-5来了：大模型竞争进入新纪元",
      predictedScore: 52,
      actualScore: null,
      dimensions: { titleAppeal: 65, topicRelevance: 70, contentDepth: 40, emotionalHook: 45, timingFit: 55 },
      suggestions: [
        { area: "内容深度", current: "信息不充分，数据缺失", recommended: "补充独家技术对比数据", impact: "预计提升内容评分25+" },
        { area: "选题角度", current: "角度常规，同质化严重", recommended: "聚焦对国内AI产业的影响", impact: "预计提升差异化得分" },
        { area: "时效性", current: "发布节奏偏慢", recommended: "抢在竞品前24h发布", impact: "时效性评分可达80+" },
      ],
    },
  ];

  for (const pred of predictionsData) {
    await db.insert(schema.hitPredictions).values({
      organizationId: org.id,
      contentId: pred.contentId,
      predictedScore: pred.predictedScore,
      actualScore: pred.actualScore,
      dimensions: pred.dimensions,
      suggestions: pred.suggestions,
    });
    console.log(`   Prediction: ${pred.contentId} (预测${pred.predictedScore}${pred.actualScore !== null ? `，实际${pred.actualScore}` : ""})`);
  }
  console.log();

  // 22. Insert competitor hits (F3.3.01)
  console.log("22. Inserting competitor hits...");
  const competitorHitsData = [
    {
      competitorName: "南方都市报",
      title: "AI手机横评：5款旗舰真实体验报告",
      platform: "微信公众号",
      metrics: { views: 850000, likes: 42000, shares: 18000, comments: 5600 },
      successFactors: { titleStrategy: "数字+评测体裁，可信度高", topicAngle: "横向评测角度全面客观", contentStructure: "表格+图表结合，信息密度高", emotionalResonance: "购买决策辅助，实用性强" },
    },
    {
      competitorName: "36氪",
      title: "特斯拉降价背后的算计：马斯克的中国棋局",
      platform: "头条号",
      metrics: { views: 620000, likes: 28000, shares: 12000, comments: 3800 },
      successFactors: { titleStrategy: "人物+悬念，故事感强", topicAngle: "战略分析角度独特", contentStructure: "叙事+分析交替，可读性好", emotionalResonance: "商业博弈引发好奇" },
    },
    {
      competitorName: "差评",
      title: "我花3万买了3台AI手机，结果...",
      platform: "抖音",
      metrics: { views: 2800000, likes: 156000, shares: 45000, comments: 28000 },
      successFactors: { titleStrategy: "亲身体验+悬念钩子", topicAngle: "用户视角真实体验", contentStructure: "开箱评测+对比，节奏紧凑", emotionalResonance: "好奇心驱动+省钱焦虑" },
    },
    {
      competitorName: "财新",
      title: "新能源价格战：谁在流血，谁在获利",
      platform: "知乎",
      metrics: { views: 380000, likes: 18000, shares: 8200, comments: 4100 },
      successFactors: { titleStrategy: "对比冲突制造张力", topicAngle: "产业链利润分析角度", contentStructure: "深度调研+数据支撑", emotionalResonance: "行业洗牌的紧迫感" },
    },
  ];

  for (const hit of competitorHitsData) {
    await db.insert(schema.competitorHits).values({
      organizationId: org.id,
      ...hit,
    });
    console.log(`   Competitor: ${hit.competitorName} - ${hit.title}`);
  }
  console.log();

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
