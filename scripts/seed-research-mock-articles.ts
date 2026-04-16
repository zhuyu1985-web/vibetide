// scripts/seed-research-mock-articles.ts
// Seed ~144 mock news articles into research_news_articles
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { db } = await import("@/db");
  const { newsArticles } = await import("@/db/schema/research/news-articles");
  const { mediaOutlets } = await import("@/db/schema/research/media-outlets");
  const { cqDistricts } = await import("@/db/schema/research/cq-districts");
  const { organizations } = await import("@/db/schema/users");
  const { createHash } = await import("node:crypto");
  const { eq } = await import("drizzle-orm");

  // Get org
  const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (!org) throw new Error("No org found");

  // Get outlets and districts
  const outlets = await db.select().from(mediaOutlets).where(eq(mediaOutlets.organizationId, org.id));
  const districts = await db.select().from(cqDistricts);

  if (outlets.length === 0) {
    console.error("No media outlets found. Run db:seed:research first.");
    process.exit(1);
  }

  // 16 ecology themes × 3 base titles each
  const THEMES = [
    { topic: "美丽中国", titles: [
      "重庆市全力推进美丽中国先行区建设",
      "美丽中国建设多维度评估报告发布",
      "生态宜居示范区创建工作取得阶段性成果",
    ]},
    { topic: "综合治理", titles: [
      "重庆市生态环境综合治理成效显著",
      "系统治理助力长江上游生态屏障建设",
      "环境治理新模式在渝推广",
    ]},
    { topic: "绿色发展", titles: [
      "绿色低碳发展指数报告发布",
      "重庆绿色转型之路越走越宽",
      "零碳蓝碳示范项目在沿江区县启动",
    ]},
    { topic: "双碳", titles: [
      "碳达峰碳中和行动方案深入实施",
      "降污减碳协同推进取得新突破",
      "碳交易市场活跃度提升",
    ]},
    { topic: "和谐共生", titles: [
      "地球生命共同体理念深入人心",
      "绿色丝绸之路建设成果丰硕",
      "人与自然和谐共生的重庆实践",
    ]},
    { topic: "长江生态", titles: [
      "长江经济带生态保护修复成效显著",
      "长江大保护五年行动回顾",
      "长江重庆段水质持续改善",
    ]},
    { topic: "绿水青山", titles: [
      "践行两山理念 打造绿色发展高地",
      "绿水青山就是金山银山的生动实践",
      "重庆山水城市建设走在全国前列",
    ]},
    { topic: "制度建设", titles: [
      "生态文明制度体系不断完善",
      "生态文明体制改革取得实质性进展",
      "生态文明建设考核评价体系优化",
    ]},
    { topic: "资源节约", titles: [
      "资源节约集约利用水平再上新台阶",
      "资源可循环利用体系加快构建",
      "节水型社会建设经验推广",
    ]},
    { topic: "污染防治攻坚战", titles: [
      "蓝天保卫战成效显著空气质量达标",
      "碧水保卫战持续发力水环境改善",
      "净土保卫战深入推进土壤污染防治",
    ]},
    { topic: "清洁能源", titles: [
      "能源消费革命助力绿色发展",
      "新型能源体系建设加速推进",
      "无废城市建设试点取得积极进展",
    ]},
    { topic: "国家公园", titles: [
      "国家森林公园生态保护成效评估报告",
      "重庆新增两处国家级自然保护区",
      "国家公园体制建设稳步推进",
    ]},
    { topic: "环保督察", titles: [
      "中央生态环境保护督察反馈问题整改完成",
      "环保督察推动解决群众身边环境问题",
      "重庆市积极配合中央环保督察工作",
    ]},
    { topic: "生物多样性", titles: [
      "生物多样性保护取得历史性成就",
      "重庆发现多种珍稀濒危物种新记录",
      "生物多样性保护纳入城市规划",
    ]},
    { topic: "生态红线", titles: [
      "生态保护红线划定工作全面完成",
      "生态红线区域监管更加严格",
      "红线内生态修复项目有序推进",
    ]},
    { topic: "低碳经济", titles: [
      "绿色生活方式倡导取得新成效",
      "低碳消费理念日益深入市民生活",
      "低碳经济发展路径探索与实践",
    ]},
  ];

  const SUFFIXES = ["", "（深度报道）", "（评论员文章）"];
  const CHANNELS: Array<"tavily" | "whitelist_crawl" | "manual_url"> = [
    "tavily", "whitelist_crawl", "manual_url",
  ];

  type ArticleRow = {
    url: string;
    urlHash: string;
    title: string;
    content: string;
    publishedAt: Date;
    outletId: string;
    outletTierSnapshot: "central" | "provincial_municipal" | "industry" | "district_media";
    districtIdSnapshot: string | null;
    sourceChannel: "tavily" | "whitelist_crawl" | "manual_url";
  };

  const articles: ArticleRow[] = [];

  let idx = 0;
  for (const theme of THEMES) {
    for (const baseTitle of theme.titles) {
      for (let v = 0; v < 3; v++) {
        idx++;
        const outlet = outlets[idx % outlets.length];
        const district = outlet.districtId
          ? districts.find((d) => d.id === outlet.districtId)
          : districts[idx % districts.length];

        // Distribute dates across 2025
        const month = (idx % 12) + 1;
        const day = (idx % 28) + 1;
        const dateStr = `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const publishedAt = new Date(dateStr + "T08:00:00Z");

        const title = `${baseTitle}${SUFFIXES[v]}`;
        const url = `https://mock-news.example.com/${idx}/${encodeURIComponent(theme.topic)}`;
        const urlHash = createHash("sha256").update(url).digest("hex");
        const content =
          `${title}。${theme.topic}是生态文明建设的重要组成部分。` +
          `${outlet.name}记者从相关部门获悉，2025年以来，重庆市${district?.name ?? "各区县"}` +
          `在${theme.topic}领域取得了显著进展。相关负责人表示，将继续深入推进${theme.topic}工作，` +
          `为建设美丽重庆贡献力量。这是第${idx}篇模拟报道。`;

        articles.push({
          url,
          urlHash,
          title,
          content,
          publishedAt,
          outletId: outlet.id,
          outletTierSnapshot: outlet.tier,
          districtIdSnapshot: district?.id ?? null,
          sourceChannel: CHANNELS[idx % 3],
        });
      }
    }
  }

  console.log(`Inserting ${articles.length} mock articles...`);

  let inserted = 0;
  for (const a of articles) {
    try {
      const [row] = await db
        .insert(newsArticles)
        .values(a)
        .onConflictDoNothing()
        .returning({ id: newsArticles.id });
      if (row) inserted++;
    } catch (e) {
      console.warn(`Skip: ${(e as Error).message}`);
    }
  }

  console.log(`Done. Inserted ${inserted}/${articles.length} mock articles.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
