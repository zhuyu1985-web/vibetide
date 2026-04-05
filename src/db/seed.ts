import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import { EMPLOYEE_CORE_SKILLS } from "../lib/constants";
import { getAllBuiltinSkills } from "../lib/skill-loader";

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
  {
    slug: "leader",
    name: "任务总监",
    nickname: "小领",
    title: "智能项目管理与任务调度",
    motto: "统筹全局，高效协作",
    roleType: "manager",
    authorityLevel: "coordinator" as const,
    status: "working" as const,
    currentTask: "协调团队完成内容任务",
    tasksCompleted: 0,
    accuracy: 98.0,
    avgResponseTime: "2.0s",
    satisfaction: 97,
  },
];

async function seed() {
  console.log("Seeding database...\n");

  // 1. Find or create default organization (idempotent)
  // Use the oldest existing org so data aligns with ensureUserProfile (which
  // also picks the oldest org for new users). Only create a new org when none
  // exists at all.
  console.log("1. Finding/creating organization...");
  const existingOrg = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
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

  // 2. Insert builtin skills into skills table (from skills/*/SKILL.md)
  console.log("2. Inserting builtin skills...");
  const builtinSkills = getAllBuiltinSkills();
  const skillMap = new Map<string, string>(); // slug -> uuid
  let skillsCreated = 0;

  let skillsUpdated = 0;
  for (const skillDef of builtinSkills) {
    // Match by slug first (preferred), fallback to name for pre-migration data
    const existing = await db.query.skills.findFirst({
      where: (s, { eq, and, or }) =>
        and(
          eq(s.organizationId, org.id),
          or(eq(s.slug, skillDef.slug), eq(s.name, skillDef.name))
        ),
    });
    if (existing) {
      // Upsert: update metadata + slug (content is loaded from SKILL.md at runtime)
      await db
        .update(schema.skills)
        .set({
          slug: skillDef.slug,
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
        slug: skillDef.slug,
        category: skillDef.category,
        type: "builtin",
        version: skillDef.version,
        description: skillDef.description,
        content: "",
        inputSchema: skillDef.inputSchema,
        outputSchema: skillDef.outputSchema,
        runtimeConfig: skillDef.runtimeConfig,
        compatibleRoles: skillDef.compatibleRoles,
      })
      .returning();
    skillMap.set(skillDef.slug, skill.id);
    skillsCreated++;
  }
  console.log(`   ${skillsCreated} new / ${skillsUpdated} updated / ${builtinSkills.length - skillsCreated - skillsUpdated} unchanged builtin skills\n`);

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

  // 4. Seed missions
  console.log("4. Inserting missions...");

  const leaderId = employeeMap.get("leader")!;

  const missionsData = [
    {
      title: "两会热点深度追踪与系列报道",
      scenario: "deep_report",
      userInstruction: "围绕今年两会核心议题，完成3篇深度报道：经济政策走向、科技创新布局、民生保障新举措。要求多方采访、数据支撑、配图精美。",
      teamSlugs: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaofa"],
      status: "completed" as const,
      phase: "delivering" as const,
      progress: 100,
      tasks: [
        { title: "两会热点监控与议题筛选", desc: "监控两会相关热搜、微博话题，筛选最受关注的3大议题", assignee: "xiaolei", status: "completed" as const },
        { title: "经济政策选题策划", desc: "围绕经济政策方向策划深度报道角度", assignee: "xiaoce", status: "completed" as const },
        { title: "背景素材收集与整理", desc: "收集近5年两会经济政策数据、专家观点", assignee: "xiaozi", status: "completed" as const },
        { title: "深度报道撰写：经济政策篇", desc: "撰写3000字深度报道", assignee: "xiaowen", status: "completed" as const },
        { title: "内容质量审核", desc: "审核事实准确性、政策表述合规性", assignee: "xiaoshen", status: "completed" as const },
        { title: "全渠道发布", desc: "适配微信公众号、今日头条、百家号格式并发布", assignee: "xiaofa", status: "completed" as const },
      ],
      messages: [
        { from: "xiaolei", type: "progress_update" as const, content: "已完成两会热点扫描，筛选出3个核心议题：经济政策、科技创新、民生保障" },
        { from: "xiaoce", type: "progress_update" as const, content: "选题策划完成，建议从'GDP目标调整'切入经济政策报道" },
        { from: "xiaowen", type: "progress_update" as const, content: "经济政策篇初稿完成，共3200字，包含5组数据图表" },
        { from: "xiaoshen", type: "progress_update" as const, content: "审核通过，建议优化第三段数据表述" },
      ],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      title: "AI手机大战：三大厂商旗舰对比评测",
      scenario: "breaking_news",
      userInstruction: "针对近期华为、苹果、三星三大厂商AI手机新品，快速产出对比评测稿件，重点关注AI功能差异。",
      teamSlugs: ["xiaolei", "xiaowen", "xiaoshen", "xiaofa"],
      status: "executing" as const,
      phase: "executing" as const,
      progress: 55,
      tasks: [
        { title: "AI手机发布会信息汇总", desc: "整理三大厂商AI手机发布会核心信息", assignee: "xiaolei", status: "completed" as const },
        { title: "撰写对比评测稿", desc: "从AI功能、性能、价格三维度撰写对比评测", assignee: "xiaowen", status: "in_progress" as const },
        { title: "事实核查与审核", desc: "核查技术参数、价格信息准确性", assignee: "xiaoshen", status: "pending" as const },
        { title: "多平台分发", desc: "发布至科技频道各平台", assignee: "xiaofa", status: "pending" as const },
      ],
      messages: [
        { from: "xiaolei", type: "progress_update" as const, content: "三大厂商发布会信息已汇总完毕，华为Mate 70 AI功能最为突出" },
        { from: "xiaowen", type: "chat" as const, content: "正在撰写对比评测，预计30分钟内完成初稿" },
      ],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: null,
    },
    {
      title: "春季新能源车企销量数据报道",
      scenario: "data_journalism",
      userInstruction: "基于3月新能源汽车销量数据，制作数据新闻报道，包含销量排行、同比增长、市场份额变化等可视化图表。",
      teamSlugs: ["xiaolei", "xiaoshu", "xiaowen", "xiaoshen"],
      status: "executing" as const,
      phase: "executing" as const,
      progress: 30,
      tasks: [
        { title: "销量数据采集", desc: "采集主流新能源车企3月销量数据", assignee: "xiaolei", status: "completed" as const },
        { title: "数据清洗与可视化", desc: "整理数据并制作图表", assignee: "xiaoshu", status: "in_progress" as const },
        { title: "数据新闻撰写", desc: "基于数据分析撰写新闻稿", assignee: "xiaowen", status: "pending" as const },
        { title: "审核发布", desc: "核查数据准确性并发布", assignee: "xiaoshen", status: "pending" as const },
      ],
      messages: [
        { from: "xiaolei", type: "data_handoff" as const, content: "3月销量数据已采集完成，比亚迪继续领跑，问界增速最快" },
        { from: "xiaoshu", type: "progress_update" as const, content: "正在制作销量对比图表和市场份额饼图" },
      ],
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      completedAt: null,
    },
    {
      title: "短视频系列：AI改变生活的10个瞬间",
      scenario: "video_content",
      userInstruction: "策划并制作一组10集短视频系列，展示AI技术在日常生活中的实际应用场景。每集1-2分钟。",
      teamSlugs: ["xiaoce", "xiaowen", "xiaojian", "xiaoshen", "xiaofa"],
      status: "planning" as const,
      phase: "decomposing" as const,
      progress: 10,
      tasks: [
        { title: "视频选题策划", desc: "策划10个AI生活场景主题", assignee: "xiaoce", status: "in_progress" as const },
        { title: "脚本撰写", desc: "完成10集视频脚本", assignee: "xiaowen", status: "pending" as const },
        { title: "视频制作方案", desc: "设计拍摄方案和后期要求", assignee: "xiaojian", status: "pending" as const },
      ],
      messages: [
        { from: "xiaoce", type: "progress_update" as const, content: "已初步拟定10个选题方向，包括AI翻译、AI健身、AI家居等" },
      ],
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      completedAt: null,
    },
    {
      title: "社交媒体热点追踪：#AI绘画争议#",
      scenario: "social_media",
      userInstruction: "追踪#AI绘画争议#话题，在微博、抖音、小红书三平台产出差异化内容。",
      teamSlugs: ["xiaoce", "xiaowen", "xiaofa", "xiaoshu"],
      status: "completed" as const,
      phase: "delivering" as const,
      progress: 100,
      tasks: [
        { title: "话题分析", desc: "分析#AI绘画争议#话题热度和舆论走向", assignee: "xiaoce", status: "completed" as const },
        { title: "三平台内容创作", desc: "为微博、抖音、小红书分别创作内容", assignee: "xiaowen", status: "completed" as const },
        { title: "内容分发", desc: "三平台同步发布", assignee: "xiaofa", status: "completed" as const },
        { title: "数据回收", desc: "统计各平台内容表现数据", assignee: "xiaoshu", status: "completed" as const },
      ],
      messages: [
        { from: "xiaoce", type: "progress_update" as const, content: "话题热度分析完成，微博讨论量已超2亿" },
        { from: "xiaowen", type: "progress_update" as const, content: "三平台内容已全部完成，抖音版本采用短视频形式" },
        { from: "xiaoshu", type: "progress_update" as const, content: "全平台曝光量达150万，微博转评赞合计2.3万" },
      ],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      title: "紧急：某科技公司裁员事件快讯",
      scenario: "flash_report",
      userInstruction: "某头部科技公司突发裁员消息，快速产出速报。",
      teamSlugs: ["xiaolei", "xiaowen"],
      status: "completed" as const,
      phase: "delivering" as const,
      progress: 100,
      tasks: [
        { title: "事件信息确认", desc: "确认裁员消息来源和具体情况", assignee: "xiaolei", status: "completed" as const },
        { title: "速报撰写", desc: "撰写500字以内快讯", assignee: "xiaowen", status: "completed" as const },
      ],
      messages: [
        { from: "xiaolei", type: "progress_update" as const, content: "已确认消息来源，涉及员工约2000人" },
        { from: "xiaowen", type: "progress_update" as const, content: "速报已完成，480字，含3个核心信息点" },
      ],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000),
    },
    {
      title: "发布会追踪：国务院新闻发布会",
      scenario: "press_conference",
      userInstruction: "追踪国务院新闻发布会，提取经济领域核心要点，撰写解读稿。",
      teamSlugs: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen"],
      status: "failed" as const,
      phase: "executing" as const,
      progress: 40,
      tasks: [
        { title: "发布会实时监控", desc: "实时监控发布会内容", assignee: "xiaolei", status: "completed" as const },
        { title: "要点提取与分析", desc: "提取经济领域核心要点", assignee: "xiaoce", status: "completed" as const },
        { title: "解读稿撰写", desc: "撰写发布会深度解读", assignee: "xiaowen", status: "failed" as const },
      ],
      messages: [
        { from: "xiaolei", type: "progress_update" as const, content: "发布会已结束，共记录28个要点" },
        { from: "xiaoce", type: "progress_update" as const, content: "已筛选出5个经济核心要点" },
        { from: "xiaowen", type: "chat" as const, content: "撰写过程中API调用超时，任务异常中断" },
      ],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      completedAt: null,
    },
  ];

  for (const mData of missionsData) {
    const teamMemberIds = mData.teamSlugs
      .map((slug) => employeeMap.get(slug))
      .filter((id): id is string => !!id);

    const [mission] = await db.insert(schema.missions).values({
      organizationId: org.id,
      title: mData.title,
      scenario: mData.scenario,
      userInstruction: mData.userInstruction,
      leaderEmployeeId: leaderId,
      teamMembers: teamMemberIds,
      status: mData.status,
      phase: mData.phase,
      progress: mData.progress,
      createdAt: mData.createdAt,
      startedAt: mData.startedAt ?? undefined,
      completedAt: mData.completedAt ?? undefined,
    }).returning();

    // Insert tasks
    for (let i = 0; i < (mData.tasks ?? []).length; i++) {
      const t = mData.tasks[i];
      const assigneeId = employeeMap.get(t.assignee);
      await db.insert(schema.missionTasks).values({
        missionId: mission.id,
        title: t.title,
        description: t.desc,
        assignedEmployeeId: assigneeId ?? null,
        status: t.status,
        priority: mData.tasks.length - i,
        progress: t.status === "completed" ? 100 : t.status === "in_progress" ? 50 : 0,
        startedAt: t.status !== "pending" ? mData.startedAt ?? undefined : undefined,
        completedAt: t.status === "completed" ? (mData.completedAt ?? new Date()) : undefined,
      });
    }

    // Insert messages
    for (let i = 0; i < (mData.messages ?? []).length; i++) {
      const msg = mData.messages[i];
      const fromId = employeeMap.get(msg.from);
      if (!fromId) continue;
      await db.insert(schema.missionMessages).values({
        missionId: mission.id,
        fromEmployeeId: fromId,
        messageType: msg.type,
        content: msg.content,
        channel: "broadcast",
        createdAt: new Date(mData.createdAt.getTime() + (i + 1) * 15 * 60 * 1000),
      });
    }

    console.log(`   Mission: ${mData.title} (${mData.status})`);
  }
  console.log(`   ${missionsData.length} missions seeded\n`);

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

  // 23. Insert employee scenarios for 小雷 (xiaolei)
  console.log("23. Inserting employee scenarios for 小雷...");
  const xiaoleiScenarios = [
    {
      employeeSlug: "xiaolei",
      name: "全网热点扫描",
      description: "扫描各平台热点话题，生成热点速报",
      icon: "Radar",
      systemInstruction:
        "请对{{domain}}领域进行全网热点扫描，覆盖微博、百度、头条、抖音、知乎等主流平台。输出格式：按热度排序的 Top 10 热点列表，每个热点包含标题、热度值、来源平台、上升趋势、建议追踪角度。最后给出整体热点态势总结。",
      inputFields: [
        {
          name: "domain",
          label: "关注领域",
          type: "select" as const,
          required: true,
          placeholder: "选择领域",
          options: [
            "全部",
            "科技",
            "财经",
            "娱乐",
            "体育",
            "社会",
            "教育",
            "汽车",
            "健康",
          ],
        },
      ],
      toolsHint: ["trending_topics", "web_search"],
      sortOrder: 1,
    },
    {
      employeeSlug: "xiaolei",
      name: "话题深度追踪",
      description: "深入分析特定话题的发展脉络",
      icon: "Search",
      systemInstruction:
        "请对话题「{{topic}}」进行深度追踪分析。包含：1) 话题起源和发展时间线 2) 各平台传播路径 3) 关键节点和转折 4) 舆论情绪变化 5) 相关利益方观点汇总 6) 预测后续发展趋势 7) 建议的内容切入角度。",
      inputFields: [
        {
          name: "topic",
          label: "追踪话题",
          type: "text" as const,
          required: true,
          placeholder: "输入要追踪的话题关键词",
        },
      ],
      toolsHint: ["web_search", "web_deep_read", "trending_topics"],
      sortOrder: 2,
    },
    {
      employeeSlug: "xiaolei",
      name: "平台热榜查看",
      description: "查看指定平台的实时热榜",
      icon: "BarChart3",
      systemInstruction:
        "请查看{{platform}}平台的实时热榜数据，列出当前 Top 20 热门话题，每个话题标注热度指数、上榜时长、趋势（上升/下降/平稳）。对排名前 5 的话题给出简要分析和内容制作建议。",
      inputFields: [
        {
          name: "platform",
          label: "目标平台",
          type: "select" as const,
          required: true,
          placeholder: "选择平台",
          options: [
            "微博",
            "百度",
            "头条",
            "抖音",
            "知乎",
            "B站",
            "微信",
          ],
        },
      ],
      toolsHint: ["trending_topics"],
      sortOrder: 3,
    },
    {
      employeeSlug: "xiaolei",
      name: "热点分析报告",
      description: "生成深度热点分析报告",
      icon: "FileText",
      systemInstruction:
        "请针对话题「{{topic}}」生成一份{{depth}}的热点分析报告。报告结构：1) 热点概述 2) 数据分析（热度趋势、平台分布、用户画像） 3) 舆情分析（正面/负面/中性占比、典型观点） 4) 竞品响应（主流媒体的报道角度） 5) 内容机会（建议的选题角度、体裁、发布时机） 6) 风险提示（敏感点、合规注意事项）",
      inputFields: [
        {
          name: "topic",
          label: "分析话题",
          type: "text" as const,
          required: true,
          placeholder: "输入要分析的话题",
        },
        {
          name: "depth",
          label: "报告深度",
          type: "select" as const,
          required: true,
          placeholder: "选择深度",
          options: ["快速摘要", "标准报告", "深度研报"],
        },
      ],
      toolsHint: ["trending_topics", "web_search", "web_deep_read"],
      sortOrder: 4,
    },
    {
      employeeSlug: "xiaolei",
      name: "关键词热度监测",
      description: "监测关键词在各平台的热度变化",
      icon: "Activity",
      systemInstruction:
        "请监测关键词「{{keyword}}」在{{timeRange}}内的热度变化情况。输出：1) 各平台当前热度指数 2) 热度趋势变化曲线描述 3) 关联热词和话题 4) 主要讨论内容摘要 5) 情感倾向分析 6) 是否建议跟进及原因。",
      inputFields: [
        {
          name: "keyword",
          label: "监测关键词",
          type: "text" as const,
          required: true,
          placeholder: "输入关键词",
        },
        {
          name: "timeRange",
          label: "时间范围",
          type: "select" as const,
          required: true,
          placeholder: "选择时间范围",
          options: ["最近1小时", "最近24小时", "最近7天", "最近30天"],
        },
      ],
      toolsHint: ["web_search", "trending_topics"],
      sortOrder: 5,
    },
  ];

  for (const s of xiaoleiScenarios) {
    await db.insert(schema.employeeScenarios).values({
      organizationId: org.id,
      ...s,
    });
    console.log(`   Scenario: ${s.name}`);
  }
  console.log();

  // -----------------------------------------------------------------------
  // Monitored Platforms (Benchmarking Deep-Dive)
  // -----------------------------------------------------------------------
  console.log("📡 Seeding monitored platforms...");

  const platformsData = [
    { name: "人民网", url: "people.com.cn", category: "central" as const, searchQuery: "site:people.com.cn" },
    { name: "新华网", url: "xinhuanet.com", category: "central" as const, searchQuery: "site:xinhuanet.com" },
    { name: "央视新闻", url: "news.cctv.com", category: "central" as const, searchQuery: "site:cctv.com 新闻" },
    { name: "光明网", url: "gmw.cn", category: "central" as const, searchQuery: "site:gmw.cn" },
    { name: "中国新闻网", url: "chinanews.com.cn", category: "central" as const, searchQuery: "site:chinanews.com.cn" },
    { name: "澎湃新闻", url: "thepaper.cn", category: "provincial" as const, province: "上海", searchQuery: "site:thepaper.cn" },
    { name: "红星新闻", url: "cdsb.com", category: "provincial" as const, province: "四川", searchQuery: "site:cdsb.com" },
  ];

  const platformIdMap = new Map<string, string>();
  for (const p of platformsData) {
    const [inserted] = await db.insert(schema.monitoredPlatforms).values({
      organizationId: org.id,
      name: p.name,
      url: p.url,
      category: p.category,
      province: "province" in p ? p.province : undefined,
      crawlConfig: { searchQuery: p.searchQuery },
      lastCrawledAt: new Date(Date.now() - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000),
      totalContentCount: 5,
    }).returning();
    platformIdMap.set(p.name, inserted.id);
    console.log(`   Platform: ${p.name} (${inserted.id})`);
  }
  console.log();

  // -----------------------------------------------------------------------
  // Platform Content (35 rows — 5 per platform)
  // -----------------------------------------------------------------------
  console.log("📰 Seeding platform content...");

  const [existingContent] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.platformContent).where(eq(schema.platformContent.organizationId, org.id));
  if (existingContent.count > 0) {
    console.log(`   Skipping (${existingContent.count} already exist)`);
  } else {
    const now = Date.now();
    const contentData: Array<{
      platformName: string;
      items: Array<{
        title: string;
        summary: string;
        sourceUrl: string;
        author: string;
        publishedAt: Date;
        topics: string[];
        category: string;
        sentiment: string;
        importance: number;
        coverageStatus: string;
        gapAnalysis?: string;
      }>;
    }> = [
      {
        platformName: "人民网",
        items: [
          { title: "科技部发布《人工智能安全白皮书》全文", summary: "科技部正式发布人工智能安全白皮书，明确了AI发展的六大安全原则和监管框架", sourceUrl: "https://people.com.cn/ai-safety-2026", author: "人民网科技频道", publishedAt: new Date(now - 2 * 3600000), topics: ["AI安全", "科技政策", "人工智能监管"], category: "政策", sentiment: "positive", importance: 92, coverageStatus: "missed", gapAnalysis: "我方未覆盖此重要政策解读" },
          { title: "两会代表建议加快数字经济立法", summary: "多位全国人大代表在两会期间提交数字经济相关议案", sourceUrl: "https://people.com.cn/digital-economy-proposal", author: "人民日报", publishedAt: new Date(now - 8 * 3600000), topics: ["两会", "数字经济", "立法"], category: "政策", sentiment: "neutral", importance: 78, coverageStatus: "covered" },
          { title: "新一代国产芯片流片成功", summary: "中科院微电子所宣布新一代5nm国产芯片成功流片", sourceUrl: "https://people.com.cn/chip-breakthrough", author: "人民网科技频道", publishedAt: new Date(now - 18 * 3600000), topics: ["芯片", "半导体", "自主创新"], category: "科技", sentiment: "positive", importance: 85, coverageStatus: "partially_covered", gapAnalysis: "我方仅做基础转载，缺少深度解读" },
          { title: "全国碳交易市场扩容方案出台", summary: "生态环境部发布碳交易市场扩容方案，新增水泥钢铁行业", sourceUrl: "https://people.com.cn/carbon-market-2026", author: "人民网环保频道", publishedAt: new Date(now - 36 * 3600000), topics: ["碳交易", "双碳", "环保政策"], category: "政策", sentiment: "positive", importance: 70, coverageStatus: "covered" },
          { title: "乡村振兴数字化转型典型案例发布", summary: "农业农村部公布10个乡村振兴数字化转型典型案例", sourceUrl: "https://people.com.cn/rural-digital-2026", author: "人民网三农频道", publishedAt: new Date(now - 48 * 3600000), topics: ["乡村振兴", "数字化转型"], category: "社会", sentiment: "positive", importance: 55, coverageStatus: "covered" },
        ],
      },
      {
        platformName: "新华网",
        items: [
          { title: "国务院常务会议部署AI产业发展新举措", summary: "国务院常务会议审议通过人工智能产业高质量发展若干措施", sourceUrl: "https://xinhuanet.com/ai-policy-2026", author: "新华社", publishedAt: new Date(now - 4 * 3600000), topics: ["AI产业", "国务院", "产业政策"], category: "政策", sentiment: "positive", importance: 95, coverageStatus: "missed", gapAnalysis: "重要政策发布，我方尚未跟进" },
          { title: "新能源汽车出口量创历史新高", summary: "海关总署数据显示一季度新能源汽车出口量同比增长45%", sourceUrl: "https://xinhuanet.com/nev-export-2026", author: "新华社经济部", publishedAt: new Date(now - 12 * 3600000), topics: ["新能源汽车", "出口", "制造业"], category: "经济", sentiment: "positive", importance: 80, coverageStatus: "partially_covered", gapAnalysis: "缺少数据可视化分析" },
          { title: "长三角一体化发展再提速", summary: "长三角三省一市签署新一轮合作框架协议", sourceUrl: "https://xinhuanet.com/yangtze-delta-2026", author: "新华社上海分社", publishedAt: new Date(now - 30 * 3600000), topics: ["长三角", "区域发展", "一体化"], category: "经济", sentiment: "positive", importance: 65, coverageStatus: "covered" },
          { title: "北京发布全球数字经济标杆城市方案", summary: "北京市政府发布建设全球数字经济标杆城市实施方案2.0版", sourceUrl: "https://xinhuanet.com/bj-digital-2026", author: "新华社北京分社", publishedAt: new Date(now - 42 * 3600000), topics: ["数字经济", "北京", "城市发展"], category: "政策", sentiment: "positive", importance: 72, coverageStatus: "covered" },
          { title: "全球半导体行业格局深度报告", summary: "全球半导体市场分析报告显示中国产能占比持续提升", sourceUrl: "https://xinhuanet.com/semiconductor-report", author: "新华社国际部", publishedAt: new Date(now - 60 * 3600000), topics: ["半导体", "全球市场", "产能分析"], category: "科技", sentiment: "neutral", importance: 75, coverageStatus: "missed", gapAnalysis: "重要行业报告未跟进" },
        ],
      },
      {
        platformName: "央视新闻",
        items: [
          { title: "AI手机大战：三巨头旗舰同日发布", summary: "华为、小米、OPPO三大品牌同日发布AI旗舰手机", sourceUrl: "https://news.cctv.com/ai-phone-2026", author: "央视财经", publishedAt: new Date(now - 6 * 3600000), topics: ["AI手机", "华为", "小米", "科技消费"], category: "科技", sentiment: "neutral", importance: 88, coverageStatus: "covered" },
          { title: "春季就业市场调查：AI岗位需求激增", summary: "人社部发布春季就业市场报告，AI相关岗位需求同比增长120%", sourceUrl: "https://news.cctv.com/ai-jobs-2026", author: "央视新闻联播", publishedAt: new Date(now - 15 * 3600000), topics: ["就业", "AI人才", "劳动市场"], category: "社会", sentiment: "positive", importance: 73, coverageStatus: "partially_covered", gapAnalysis: "报道角度单一，缺少求职者视角" },
          { title: "深圳前海自贸区政策升级", summary: "深圳前海自贸区发布新一轮改革开放方案", sourceUrl: "https://news.cctv.com/qianhai-2026", author: "央视新闻", publishedAt: new Date(now - 40 * 3600000), topics: ["前海", "自贸区", "改革开放"], category: "政策", sentiment: "positive", importance: 62, coverageStatus: "covered" },
          { title: "全国网络安全攻防演练启动", summary: "年度网络安全攻防演练在全国多个城市同步启动", sourceUrl: "https://news.cctv.com/cyber-exercise-2026", author: "央视新闻", publishedAt: new Date(now - 55 * 3600000), topics: ["网络安全", "攻防演练"], category: "科技", sentiment: "neutral", importance: 58, coverageStatus: "covered" },
          { title: "字节跳动内部大模型曝光引发热议", summary: "据报道字节跳动内部正在测试新一代大语言模型", sourceUrl: "https://news.cctv.com/bytedance-llm", author: "央视财经", publishedAt: new Date(now - 10 * 3600000), topics: ["字节跳动", "大模型", "AI竞争"], category: "科技", sentiment: "neutral", importance: 90, coverageStatus: "missed", gapAnalysis: "热度极高的科技话题未跟进" },
        ],
      },
      {
        platformName: "光明网",
        items: [
          { title: "教育部发布AI进校园指导意见", summary: "教育部出台人工智能技术在基础教育中的应用指导意见", sourceUrl: "https://gmw.cn/ai-education-2026", author: "光明日报教育版", publishedAt: new Date(now - 5 * 3600000), topics: ["AI教育", "基础教育", "教育政策"], category: "社会", sentiment: "positive", importance: 76, coverageStatus: "missed", gapAnalysis: "教育类政策我方关注不足" },
          { title: "高校科研成果转化率创新高", summary: "教育部统计2025年全国高校科研成果转化率达到28%", sourceUrl: "https://gmw.cn/research-transfer-2026", author: "光明日报", publishedAt: new Date(now - 24 * 3600000), topics: ["科研转化", "高校", "创新"], category: "科技", sentiment: "positive", importance: 60, coverageStatus: "covered" },
          { title: "文化数字化战略实施进展报告", summary: "中宣部发布文化数字化战略实施一周年进展报告", sourceUrl: "https://gmw.cn/culture-digital-2026", author: "光明网文化频道", publishedAt: new Date(now - 50 * 3600000), topics: ["文化数字化", "战略报告"], category: "社会", sentiment: "positive", importance: 55, coverageStatus: "covered" },
          { title: "Z世代消费趋势报告：AI消费占比超15%", summary: "最新消费趋势报告显示Z世代在AI产品上的支出占比首次超过15%", sourceUrl: "https://gmw.cn/gen-z-consumption", author: "光明日报", publishedAt: new Date(now - 32 * 3600000), topics: ["Z世代", "消费趋势", "AI消费"], category: "财经", sentiment: "neutral", importance: 68, coverageStatus: "partially_covered", gapAnalysis: "缺少年轻消费者访谈视角" },
          { title: "古籍数字化保护工程取得突破", summary: "国家图书馆完成百万页古籍数字化处理", sourceUrl: "https://gmw.cn/ancient-books-digital", author: "光明网文化频道", publishedAt: new Date(now - 70 * 3600000), topics: ["古籍保护", "数字化"], category: "社会", sentiment: "positive", importance: 45, coverageStatus: "covered" },
        ],
      },
      {
        platformName: "中国新闻网",
        items: [
          { title: "OpenAI推出企业版Agent平台", summary: "OpenAI正式发布面向企业客户的AI Agent开发平台", sourceUrl: "https://chinanews.com.cn/openai-agent-2026", author: "中新网科技频道", publishedAt: new Date(now - 3 * 3600000), topics: ["OpenAI", "AI Agent", "企业服务"], category: "科技", sentiment: "neutral", importance: 82, coverageStatus: "missed", gapAnalysis: "国际AI动态跟进不及时" },
          { title: "海底捞推出AI智能服务员", summary: "海底捞在全国50家门店试点AI智能服务机器人", sourceUrl: "https://chinanews.com.cn/haidilao-ai-2026", author: "中新网财经", publishedAt: new Date(now - 14 * 3600000), topics: ["海底捞", "AI服务", "餐饮科技"], category: "商业", sentiment: "positive", importance: 65, coverageStatus: "missed", gapAnalysis: "商业AI应用案例关注不足" },
          { title: "跨境电商新政策解读", summary: "商务部发布跨境电商综合试验区扩容方案", sourceUrl: "https://chinanews.com.cn/cross-border-2026", author: "中新社经济部", publishedAt: new Date(now - 28 * 3600000), topics: ["跨境电商", "商务政策"], category: "经济", sentiment: "positive", importance: 63, coverageStatus: "covered" },
          { title: "直播带货监管新规生效", summary: "市场监管总局发布的直播带货管理办法正式生效实施", sourceUrl: "https://chinanews.com.cn/live-commerce-2026", author: "中新网", publishedAt: new Date(now - 20 * 3600000), topics: ["直播带货", "监管", "电商"], category: "商业", sentiment: "neutral", importance: 70, coverageStatus: "partially_covered", gapAnalysis: "监管细则解读不够深入" },
          { title: "中东局势对能源市场影响分析", summary: "中东局势持续紧张，国际油价波动加剧", sourceUrl: "https://chinanews.com.cn/middle-east-energy", author: "中新社国际部", publishedAt: new Date(now - 45 * 3600000), topics: ["中东局势", "能源市场", "油价"], category: "经济", sentiment: "negative", importance: 72, coverageStatus: "covered" },
        ],
      },
      {
        platformName: "澎湃新闻",
        items: [
          { title: "两会数字经济前瞻：代表委员提案盘点", summary: "梳理2026年全国两会关于数字经济的十大提案", sourceUrl: "https://thepaper.cn/digital-economy-proposals", author: "澎湃新闻", publishedAt: new Date(now - 7 * 3600000), topics: ["两会", "数字经济", "提案"], category: "政策", sentiment: "neutral", importance: 84, coverageStatus: "partially_covered", gapAnalysis: "缺少代表委员独家观点引用" },
          { title: "上海AI产业集群效应初显", summary: "上海人工智能产业规模突破5000亿元，集群效应初步形成", sourceUrl: "https://thepaper.cn/sh-ai-cluster-2026", author: "澎湃新闻科技版", publishedAt: new Date(now - 16 * 3600000), topics: ["上海", "AI产业", "产业集群"], category: "经济", sentiment: "positive", importance: 74, coverageStatus: "covered" },
          { title: "某地自动驾驶事故调查报告出炉", summary: "交通部门发布自动驾驶测试事故调查报告，提出整改建议", sourceUrl: "https://thepaper.cn/autonomous-driving-accident", author: "澎湃新闻", publishedAt: new Date(now - 11 * 3600000), topics: ["自动驾驶", "交通安全", "事故调查"], category: "社会", sentiment: "negative", importance: 91, coverageStatus: "covered" },
          { title: "长租公寓市场洗牌加速", summary: "头部长租公寓企业市场份额进一步集中", sourceUrl: "https://thepaper.cn/rental-market-2026", author: "澎湃新闻", publishedAt: new Date(now - 38 * 3600000), topics: ["长租公寓", "房地产", "市场格局"], category: "经济", sentiment: "neutral", importance: 50, coverageStatus: "covered" },
          { title: "全球芯片出口管制新动态", summary: "美国商务部更新芯片出口管制清单，多家中企受影响", sourceUrl: "https://thepaper.cn/chip-export-control", author: "澎湃新闻国际部", publishedAt: new Date(now - 9 * 3600000), topics: ["芯片管制", "中美科技", "出口限制"], category: "科技", sentiment: "negative", importance: 93, coverageStatus: "missed", gapAnalysis: "重大国际科技动态未及时覆盖" },
        ],
      },
      {
        platformName: "红星新闻",
        items: [
          { title: "成都AI产业园落地首批入驻企业", summary: "成都高新区AI产业园迎来首批20家AI企业入驻", sourceUrl: "https://cdsb.com/chengdu-ai-park-2026", author: "红星新闻", publishedAt: new Date(now - 22 * 3600000), topics: ["成都", "AI产业园", "西部发展"], category: "经济", sentiment: "positive", importance: 58, coverageStatus: "covered" },
          { title: "四川推进数字乡村建设", summary: "四川省发布数字乡村建设三年行动方案", sourceUrl: "https://cdsb.com/digital-village-2026", author: "红星新闻", publishedAt: new Date(now - 35 * 3600000), topics: ["数字乡村", "四川", "乡村振兴"], category: "政策", sentiment: "positive", importance: 52, coverageStatus: "covered" },
          { title: "西南地区新能源汽车消费报告", summary: "西南五省新能源汽车消费报告显示渗透率首次超过40%", sourceUrl: "https://cdsb.com/sw-nev-2026", author: "红星新闻财经版", publishedAt: new Date(now - 50 * 3600000), topics: ["新能源汽车", "西南市场", "消费数据"], category: "经济", sentiment: "positive", importance: 55, coverageStatus: "covered" },
          { title: "网红经济泡沫：MCN机构大洗牌", summary: "多家MCN机构面临资金链断裂，行业进入深度调整期", sourceUrl: "https://cdsb.com/mcn-crisis-2026", author: "红星新闻", publishedAt: new Date(now - 26 * 3600000), topics: ["MCN", "网红经济", "行业洗牌"], category: "商业", sentiment: "negative", importance: 67, coverageStatus: "partially_covered", gapAnalysis: "缺少MCN从业者深度访谈" },
          { title: "川渝地区数据中心建设提速", summary: "成渝地区双城经济圈数据中心集群建设进入快车道", sourceUrl: "https://cdsb.com/datacenter-2026", author: "红星新闻", publishedAt: new Date(now - 65 * 3600000), topics: ["数据中心", "成渝", "新基建"], category: "科技", sentiment: "positive", importance: 60, coverageStatus: "covered" },
        ],
      },
    ];

    let contentInserted = 0;
    for (const platformData of contentData) {
      const platformId = platformIdMap.get(platformData.platformName);
      if (!platformId) {
        console.log(`   Platform "${platformData.platformName}" not found in map, skipping`);
        continue;
      }
      for (const item of platformData.items) {
        await db.insert(schema.platformContent).values({
          organizationId: org.id,
          platformId,
          title: item.title,
          summary: item.summary,
          sourceUrl: item.sourceUrl,
          author: item.author,
          publishedAt: item.publishedAt,
          topics: item.topics,
          category: item.category,
          sentiment: item.sentiment,
          importance: item.importance,
          contentHash: `hash_${Date.now()}_${contentInserted}`,
          coverageStatus: item.coverageStatus,
          gapAnalysis: item.gapAnalysis,
          crawledAt: new Date(item.publishedAt.getTime() + 30 * 60000),
          analyzedAt: new Date(item.publishedAt.getTime() + 60 * 60000),
        });
        contentInserted++;
      }
      await db.update(schema.monitoredPlatforms).set({ totalContentCount: 5 }).where(eq(schema.monitoredPlatforms.id, platformId));
      console.log(`   ${platformData.platformName}: 5 content items`);
    }
    console.log(`   Total content: ${contentInserted}`);
  }
  console.log();

  // -----------------------------------------------------------------------
  // Benchmark Analyses (3 rows)
  // -----------------------------------------------------------------------
  console.log("📊 Seeding benchmark analyses...");

  const [existingAnalyses] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.benchmarkAnalyses).where(eq(schema.benchmarkAnalyses.organizationId, org.id));
  if (existingAnalyses.count > 0) {
    console.log(`   Skipping (${existingAnalyses.count} already exist)`);
  } else {
    const analysesNow = Date.now();
    const analysesData = [
      {
        topicTitle: "AI手机大战：三巨头旗舰同日发布",
        category: "科技",
        mediaScores: [
          { media: "我方（Vibe Media）", isUs: true, scores: [{ dimension: "叙事角度", score: 7 }, { dimension: "视觉品质", score: 8 }, { dimension: "互动策略", score: 6 }, { dimension: "时效性", score: 9 }], total: 30, publishTime: "09:15" },
          { media: "36氪", isUs: false, scores: [{ dimension: "叙事角度", score: 9 }, { dimension: "视觉品质", score: 7 }, { dimension: "互动策略", score: 8 }, { dimension: "时效性", score: 8 }], total: 32, publishTime: "08:30" },
          { media: "虎嗅", isUs: false, scores: [{ dimension: "叙事角度", score: 8 }, { dimension: "视觉品质", score: 6 }, { dimension: "互动策略", score: 7 }, { dimension: "时效性", score: 7 }], total: 28, publishTime: "09:45" },
          { media: "澎湃新闻", isUs: false, scores: [{ dimension: "叙事角度", score: 7 }, { dimension: "视觉品质", score: 8 }, { dimension: "互动策略", score: 5 }, { dimension: "时效性", score: 9 }], total: 29, publishTime: "08:00" },
        ],
        radarData: [{ dimension: "叙事角度", us: 7, best: 9 }, { dimension: "视觉品质", us: 8, best: 8 }, { dimension: "互动策略", us: 6, best: 8 }, { dimension: "时效性", us: 9, best: 9 }],
        improvements: ["叙事角度：增加供应链视角的深度分析，参考36氪的多维度拆解方式", "互动策略：添加投票互动和评论引导，提升用户参与度", "标题优化：使用更具冲突性的标题结构"],
      },
      {
        topicTitle: "新能源汽车降价潮",
        category: "汽车",
        mediaScores: [
          { media: "我方（Vibe Media）", isUs: true, scores: [{ dimension: "叙事角度", score: 8 }, { dimension: "视觉品质", score: 7 }, { dimension: "互动策略", score: 7 }, { dimension: "时效性", score: 6 }], total: 28, publishTime: "10:30" },
          { media: "第一财经", isUs: false, scores: [{ dimension: "叙事角度", score: 9 }, { dimension: "视觉品质", score: 9 }, { dimension: "互动策略", score: 6 }, { dimension: "时效性", score: 8 }], total: 32, publishTime: "08:00" },
          { media: "财新", isUs: false, scores: [{ dimension: "叙事角度", score: 9 }, { dimension: "视觉品质", score: 7 }, { dimension: "互动策略", score: 5 }, { dimension: "时效性", score: 7 }], total: 28, publishTime: "09:00" },
        ],
        radarData: [{ dimension: "叙事角度", us: 8, best: 9 }, { dimension: "视觉品质", us: 7, best: 9 }, { dimension: "互动策略", us: 7, best: 7 }, { dimension: "时效性", us: 6, best: 8 }],
        improvements: ["时效性：需提前预设模板，降价消息出来后15分钟内发布", "视觉品质：增加数据可视化图表，参考第一财经的交互式价格对比"],
      },
      {
        topicTitle: "两会数字经济前瞻",
        category: "政策",
        mediaScores: [
          { media: "我方（Vibe Media）", isUs: true, scores: [{ dimension: "叙事角度", score: 6 }, { dimension: "视觉品质", score: 7 }, { dimension: "互动策略", score: 8 }, { dimension: "时效性", score: 8 }], total: 29, publishTime: "07:30" },
          { media: "澎湃新闻", isUs: false, scores: [{ dimension: "叙事角度", score: 9 }, { dimension: "视觉品质", score: 8 }, { dimension: "互动策略", score: 7 }, { dimension: "时效性", score: 9 }], total: 33, publishTime: "06:00" },
        ],
        radarData: [{ dimension: "叙事角度", us: 6, best: 9 }, { dimension: "视觉品质", us: 7, best: 8 }, { dimension: "互动策略", us: 8, best: 8 }, { dimension: "时效性", us: 8, best: 9 }],
        improvements: ["叙事角度：需增加代表委员直接引用和独家观点", "时效性：建议提前24小时准备预测稿件"],
      },
    ];

    for (const analysis of analysesData) {
      await db.insert(schema.benchmarkAnalyses).values({
        organizationId: org.id,
        ...analysis,
        analyzedAt: new Date(analysesNow - Math.floor(Math.random() * 3) * 24 * 3600000),
      });
      console.log(`   Analysis: ${analysis.topicTitle}`);
    }
  }
  console.log();

  // -----------------------------------------------------------------------
  // Missed Topics (8 rows)
  // -----------------------------------------------------------------------
  console.log("🔍 Seeding missed topics...");

  const [existingMissed] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.missedTopics).where(eq(schema.missedTopics.organizationId, org.id));
  if (existingMissed.count > 0) {
    console.log(`   Skipping (${existingMissed.count} already exist)`);
  } else {
    const today = new Date();
    const missedTopicsData = [
      { title: "科技部发布AI安全白皮书", priority: "high" as const, competitors: ["财新", "36氪", "澎湃"], heatScore: 78, category: "政策", type: "breaking" as const, status: "missed" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 20) },
      { title: "字节跳动内部大模型曝光", priority: "high" as const, competitors: ["虎嗅", "36氪"], heatScore: 85, category: "科技", type: "trending" as const, status: "tracking" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30) },
      { title: "海底捞推出AI服务员", priority: "medium" as const, competitors: ["第一财经"], heatScore: 62, category: "商业", type: "trending" as const, status: "missed" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0) },
      { title: "某地自动驾驶事故引发讨论", priority: "high" as const, competitors: ["澎湃", "财新", "第一财经"], heatScore: 91, category: "社会", type: "breaking" as const, status: "resolved" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 15) },
      { title: "OpenAI推出企业版Agent平台", priority: "medium" as const, competitors: ["36氪"], heatScore: 65, category: "科技", type: "analysis" as const, status: "missed" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30) },
      { title: "直播带货新监管规则生效", priority: "medium" as const, competitors: ["澎湃"], heatScore: 58, category: "商业", type: "breaking" as const, status: "tracking" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0) },
      { title: "Z世代消费趋势报告发布", priority: "low" as const, competitors: ["第一财经", "虎嗅"], heatScore: 45, category: "财经", type: "analysis" as const, status: "missed" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0) },
      { title: "全球芯片出口管制新动态", priority: "high" as const, competitors: ["财新", "澎湃", "36氪", "第一财经"], heatScore: 88, category: "科技", type: "breaking" as const, status: "tracking" as const, discoveredAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 45) },
    ];

    for (const topic of missedTopicsData) {
      await db.insert(schema.missedTopics).values({
        organizationId: org.id,
        ...topic,
      });
      console.log(`   Missed topic: ${topic.title}`);
    }
  }
  console.log();

  // -----------------------------------------------------------------------
  // Weekly Report (1 row)
  // -----------------------------------------------------------------------
  console.log("📋 Seeding weekly report...");

  const [existingReports] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.weeklyReports).where(eq(schema.weeklyReports.organizationId, org.id));
  if (existingReports.count > 0) {
    console.log(`   Skipping (${existingReports.count} already exist)`);
  } else {
    await db.insert(schema.weeklyReports).values({
      organizationId: org.id,
      period: "2026-03-15 ~ 2026-03-21",
      overallScore: 76,
      missedRate: 2.3,
      responseSpeed: "12分钟",
      coverageRate: 94.5,
      trends: [
        { week: "W1", score: 68, missedRate: 8.5 },
        { week: "W2", score: 71, missedRate: 6.2 },
        { week: "W3", score: 73, missedRate: 4.1 },
        { week: "W4", score: 76, missedRate: 2.3 },
      ],
      gapList: [
        { area: "政策类报道", gap: "深度不足", suggestion: "增加专家连线和政策解读模板" },
        { area: "突发事件", gap: "响应慢15分钟", suggestion: "启用预设模板+自动触发机制" },
        { area: "财经分析", gap: "数据可视化弱", suggestion: "引入自动图表生成工具" },
      ],
    });
    console.log("   Weekly report seeded");
  }
  console.log();

  // -----------------------------------------------------------------------
  // Benchmark Alerts (sample data)
  // -----------------------------------------------------------------------
  console.log("🔔 Seeding benchmark alerts...");

  const sampleAlerts = [
    {
      title: "漏题预警：科技部发布AI安全白皮书",
      description: "科技部正式发布《人工智能安全白皮书》，人民网、新华网、光明网已发布深度报道，我方尚未覆盖。",
      priority: "urgent" as const,
      type: "missed_topic" as const,
      relatedPlatforms: ["人民网", "新华网", "光明网"],
      relatedTopics: ["AI安全", "科技政策", "人工智能"],
      analysisData: { heatScore: 95, competitorCount: 3, suggestedAngle: "可从行业影响角度切入", suggestedAction: "建议立即安排选题" },
    },
    {
      title: "趋势预警：新能源汽车出口量创新高",
      description: "多家媒体报道新能源汽车出口数据，呈现上升趋势，可考虑跟进报道。",
      priority: "high" as const,
      type: "trend_alert" as const,
      relatedPlatforms: ["澎湃新闻", "中国新闻网"],
      relatedTopics: ["新能源", "汽车出口", "制造业"],
      analysisData: { heatScore: 78, competitorCount: 2, suggestedAction: "建议安排数据分析报道" },
    },
    {
      title: "差距预警：数字经济发展报告解读不足",
      description: "竞品对数字经济发展报告进行了多角度深度解读，我方仅做了基础转载。",
      priority: "medium" as const,
      type: "gap_warning" as const,
      relatedPlatforms: ["人民网"],
      relatedTopics: ["数字经济", "产业报告"],
      analysisData: { heatScore: 62, coverageGap: "缺少独家解读角度", suggestedAction: "建议补充深度评论" },
    },
    {
      title: "竞品亮点：澎湃新闻推出AI互动图表",
      description: "澎湃新闻在两会报道中使用AI生成的互动数据图表，阅读量突破500万。",
      priority: "medium" as const,
      type: "competitor_highlight" as const,
      status: "acknowledged" as const,
      relatedPlatforms: ["澎湃新闻"],
      relatedTopics: ["数据可视化", "AI内容", "两会报道"],
      analysisData: { heatScore: 72, competitorCount: 1, suggestedAngle: "可借鉴互动图表形式", suggestedAction: "评估引入AI图表生成能力" },
    },
    {
      title: "趋势预警：AI Agent赛道融资潮",
      description: "近一周内3家AI Agent初创公司获得超亿元融资，行业热度快速上升。",
      priority: "low" as const,
      type: "trend_alert" as const,
      status: "new" as const,
      relatedPlatforms: ["36氪", "虎嗅"],
      relatedTopics: ["AI Agent", "创投", "人工智能"],
      analysisData: { heatScore: 55, competitorCount: 2, suggestedAction: "建议关注并储备选题" },
    },
    {
      title: "漏题预警：国务院AI产业新政策",
      description: "国务院常务会议通过AI产业高质量发展措施，新华网、人民网已全文报道，我方尚未跟进。",
      priority: "urgent" as const,
      type: "missed_topic" as const,
      status: "new" as const,
      relatedPlatforms: ["新华网", "人民网"],
      relatedTopics: ["AI产业", "国务院政策", "产业发展"],
      analysisData: { heatScore: 98, competitorCount: 2, suggestedAngle: "从产业链影响角度深度解读", suggestedAction: "建议立即启动选题，1小时内发布", estimatedUrgencyHours: 1 },
    },
  ];

  for (const alert of sampleAlerts) {
    await db.insert(schema.benchmarkAlerts).values({
      organizationId: org.id,
      ...alert,
    });
    console.log(`   Alert: ${alert.title.slice(0, 30)}...`);
  }
  console.log();

  // ── RBAC: Seed system roles and assign to existing users ──
  console.log("Seeding RBAC roles...");
  const { DEFAULT_ROLES, ALL_PERMISSIONS } = await import("../lib/rbac");

  const roleMap = new Map<string, string>(); // slug -> role id
  for (const [slug, def] of Object.entries(DEFAULT_ROLES)) {
    const existing = await db.query.roles.findFirst({
      where: (r, { eq, and, isNull }) =>
        and(isNull(r.organizationId), eq(r.slug, slug)),
    });
    if (existing) {
      roleMap.set(slug, existing.id);
      console.log(`   Role exists: ${def.name}`);
    } else {
      const [created] = await db
        .insert(schema.roles)
        .values({
          organizationId: null,
          name: def.name,
          slug,
          description: def.description,
          isSystem: true,
          permissions: [...def.permissions],
        })
        .returning();
      roleMap.set(slug, created.id);
      console.log(`   Created role: ${def.name}`);
    }
  }

  // Assign roles to existing users based on their legacy role field
  const allUsers = await db.query.userProfiles.findMany({
    where: (p, { eq }) => eq(p.organizationId, org.id),
  });
  for (const user of allUsers) {
    const roleSlug = user.role || "editor";
    const roleId = roleMap.get(roleSlug) || roleMap.get("editor")!;
    await db
      .insert(schema.userRoles)
      .values({
        userId: user.id,
        roleId,
        organizationId: org.id,
      })
      .onConflictDoNothing();
    console.log(`   Assigned ${roleSlug} to ${user.displayName}`);
  }

  // Mark first admin as super admin
  const firstAdmin = allUsers.find((u) => u.role === "admin");
  if (firstAdmin) {
    await db
      .update(schema.userProfiles)
      .set({ isSuperAdmin: true })
      .where(eq(schema.userProfiles.id, firstAdmin.id));
    console.log(`   Marked ${firstAdmin.displayName} as super admin`);
  }
  console.log();

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
