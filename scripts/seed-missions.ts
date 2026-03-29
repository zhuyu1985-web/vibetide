import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";

import { config } from "dotenv";
config({ path: ".env.local" });
config();

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  connect_timeout: 15,
  idle_timeout: 10,
});
const db = drizzle(client, { schema });

async function seedMissions() {
  console.log("Seeding missions...\n");

  // 1. Find the organization
  const org = await db.query.organizations.findFirst();
  if (!org) {
    console.error("No organization found! Run full seed first.");
    process.exit(1);
  }
  console.log(`Org: ${org.name} (${org.id})`);

  // 2. Delete old missions to reseed fresh demo data
  const existingMissions = await db
    .select({ id: schema.missions.id })
    .from(schema.missions)
    .where(eq(schema.missions.organizationId, org.id));

  if (existingMissions.length > 0) {
    console.log(`Deleting ${existingMissions.length} existing missions...`);
    for (const m of existingMissions) {
      await db.delete(schema.missionMessages).where(eq(schema.missionMessages.missionId, m.id));
      await db.delete(schema.missionTasks).where(eq(schema.missionTasks.missionId, m.id));
      await db.delete(schema.missions).where(eq(schema.missions.id, m.id));
    }
  }

  // 3. Load employees by slug
  const empRows = await db
    .select({ id: schema.aiEmployees.id, slug: schema.aiEmployees.slug })
    .from(schema.aiEmployees)
    .where(eq(schema.aiEmployees.organizationId, org.id));

  const empMap = new Map(empRows.map((e) => [e.slug, e.id]));
  console.log(`Found ${empMap.size} employees`);

  const leaderId = empMap.get("leader");
  if (!leaderId) {
    console.error("Leader employee not found!");
    process.exit(1);
  }

  // 4. Define mission data
  const missionsData = [
    {
      title: "两会热点深度追踪与系列报道",
      scenario: "deep_report",
      userInstruction: "围绕今年两会核心议题，完成3篇深度报道：经济政策走向、科技创新布局、民生保障新举措。",
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
      createdAt: new Date(Date.now() - 3 * 86400000),
      startedAt: new Date(Date.now() - 3 * 86400000),
      completedAt: new Date(Date.now() - 86400000),
    },
    {
      title: "AI手机大战：三大厂商旗舰对比评测",
      scenario: "breaking_news",
      userInstruction: "针对近期华为、苹果、三星三大厂商AI手机新品，快速产出对比评测稿件。",
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
      createdAt: new Date(Date.now() - 2 * 3600000),
      startedAt: new Date(Date.now() - 2 * 3600000),
      completedAt: null,
    },
    {
      title: "春季新能源车企销量数据报道",
      scenario: "data_journalism",
      userInstruction: "基于3月新能源汽车销量数据，制作数据新闻报道，包含可视化图表。",
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
      createdAt: new Date(Date.now() - 5 * 3600000),
      startedAt: new Date(Date.now() - 5 * 3600000),
      completedAt: null,
    },
    {
      title: "短视频系列：AI改变生活的10个瞬间",
      scenario: "video_content",
      userInstruction: "策划并制作一组10集短视频系列，展示AI技术在日常生活中的实际应用场景。",
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
      createdAt: new Date(Date.now() - 8 * 3600000),
      startedAt: new Date(Date.now() - 7 * 3600000),
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
      createdAt: new Date(Date.now() - 5 * 86400000),
      startedAt: new Date(Date.now() - 5 * 86400000),
      completedAt: new Date(Date.now() - 4 * 86400000),
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
      createdAt: new Date(Date.now() - 2 * 86400000),
      startedAt: new Date(Date.now() - 2 * 86400000),
      completedAt: new Date(Date.now() - 2 * 86400000 + 25 * 60000),
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
      createdAt: new Date(Date.now() - 86400000),
      startedAt: new Date(Date.now() - 86400000),
      completedAt: null,
    },
  ];

  // 5. Insert missions with tasks and messages
  for (const mData of missionsData) {
    const teamMemberIds = mData.teamSlugs
      .map((slug) => empMap.get(slug))
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
    for (let i = 0; i < mData.tasks.length; i++) {
      const t = mData.tasks[i];
      const assigneeId = empMap.get(t.assignee);
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
    for (let i = 0; i < mData.messages.length; i++) {
      const msg = mData.messages[i];
      const fromId = empMap.get(msg.from);
      if (!fromId) continue;
      await db.insert(schema.missionMessages).values({
        missionId: mission.id,
        fromEmployeeId: fromId,
        messageType: msg.type,
        content: msg.content,
        channel: "broadcast",
        createdAt: new Date(mData.createdAt.getTime() + (i + 1) * 15 * 60000),
      });
    }

    console.log(`  ✓ ${mData.title} (${mData.status})`);
  }

  console.log(`\nDone! ${missionsData.length} missions seeded.`);
  await client.end();
}

seedMissions().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
