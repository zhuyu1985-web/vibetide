// Demo 数据：以 3 个核心话题铺一套完整的 my_posts + benchmark_posts + topic_matches。
// 用法：npx tsx scripts/seed-topic-compare-demo.ts <orgId>

import crypto from "node:crypto";
import { db } from "@/db";
import {
  myAccounts,
  myPosts,
  myPostDistributions,
  benchmarkAccounts,
  benchmarkPosts,
  topicMatches,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

function fp(title: string): string {
  const normalized = title
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，。、：；！？（）【】《》""''—\-,.!?()\[\]<>:"]/g, "")
    .slice(0, 40);
  return crypto.createHash("md5").update(normalized).digest("hex").slice(0, 16);
}

// ============================================================================
// 3 个话题样板
// ============================================================================

interface TopicSeed {
  topicName: string;
  publishedAt: string;
  myVersion: {
    title: string;
    body: string;
    summary: string;
    distributions: Array<{
      myAccountHandle: string;
      publishedUrl: string;
      views: number;
      likes: number;
      shares: number;
      comments: number;
    }>;
  };
  benchmarkVersions: Array<{
    accountHandle: string;
    platform: string;
    title: string;
    summary: string;
    body: string;
    sourceUrl: string;
    views: number;
    likes: number;
    shares: number;
    comments: number;
  }>;
}

const TOPIC_SEEDS: TopicSeed[] = [
  {
    topicName: "国铁静音车厢拓展服务",
    publishedAt: "2026-01-17T10:00:00Z",
    myVersion: {
      title: "北京时间 | 国铁静音车厢服务扩至8000列，2月1日起执行",
      summary: "2月1日起全国8000列动车组提供静音车厢服务，购票界面带'静'字标识可选择。",
      body:
        "本台讯 2026 年 1 月 17 日，国铁集团宣布静音车厢服务扩容到 8000 列，覆盖除动卧外的 D/G 字头动力分散动车组。购票页面用'静'字标识，旅客可主动选择。" +
        "静音约定包括五条：保持安静、电子设备静音、接打电话离开车厢、使用耳机、照看好孩子。执行时间自 2 月 1 日起。" +
        "工作人员将以友好提醒、引导方式促进旅客遵守，对违规行为不作强制处罚。",
      distributions: [
        { myAccountHandle: "btime_app", publishedUrl: "https://www.btime.com/news/jt-jingyin-chexiang", views: 18420, likes: 234, shares: 86, comments: 52 },
        { myAccountHandle: "btv_weishi", publishedUrl: "https://www.douyin.com/video/btv/jingyin", views: 52300, likes: 1820, shares: 460, comments: 208 },
        { myAccountHandle: "btime_weibo", publishedUrl: "https://weibo.com/btime/jingyin", views: 31200, likes: 620, shares: 180, comments: 94 },
      ],
    },
    benchmarkVersions: [
      {
        accountHandle: "xinhua", platform: "douyin",
        title: "新华社 | 全国8000余列动车组静音车厢2月1日起服务",
        summary: "国铁集团 2 月 1 日起在全国 8000 余列动车组推出静音车厢服务，购票界面可选择。",
        body: "新华社北京 1 月 17 日电 记者从中国国家铁路集团获悉，2 月 1 日起全国 8000 余列 D/G 字头动车组将开展静音车厢服务。静音车厢为旅客提供相对安静的旅行环境，满足差异化出行需求。购买车票时，12306 系统将在对应席位旁展示'静'字图标供选择。铁路部门将通过静音约定和友好提醒方式引导旅客共同维护车厢秩序。",
        sourceUrl: "https://www.xinhuanet.com/politics/2026-01/17/c_jingyin.htm",
        views: 1820000, likes: 38900, shares: 12400, comments: 6280,
      },
      {
        accountHandle: "rmrb", platform: "douyin",
        title: "人民日报 | 铁路部门推进静音车厢常态化，旅客点赞'安静之选'",
        summary: "人民日报解读静音车厢背后的公共服务升级逻辑，采访多位旅客反馈。",
        body: "人民日报 1 月 17 日讯 中国国家铁路集团 17 日宣布，2 月 1 日起在超过 8000 列动车组推出静音车厢服务，这是铁路服务从'普惠型'向'精细化'升级的重要标志。多位商务旅客表示，静音车厢解决了出差途中'既要工作又怕被打扰'的痛点。铁路部门相关负责人介绍，服务推出以来收到大量正面反馈，文明共建成为关键词。",
        sourceUrl: "https://www.peopledaily.cn/jiaotong/2026-01/17/jingyin.htm",
        views: 1450000, likes: 32200, shares: 9800, comments: 5100,
      },
      {
        accountHandle: "cctvnews", platform: "douyin",
        title: "央视新闻 | 静音车厢'上新'：8000列动车组 2 月 1 日起同步执行",
        summary: "央视新闻报道静音车厢服务时间、规则、使用方式。",
        body: "中国国家铁路集团 1 月 17 日发布，2 月 1 日起全国 8000 余列动车组将提供静音车厢服务。购票时系统会在车次界面标注'静'字图标。静音约定涵盖电子设备静音、低声交谈、使用耳机等五条。工作人员将引导提醒，不做强制处罚。",
        sourceUrl: "https://news.cctv.com/2026/01/17/jingyin.html",
        views: 1620000, likes: 28400, shares: 8600, comments: 4820,
      },
      {
        accountHandle: "thepaper_dy", platform: "douyin",
        title: "澎湃新闻 | 静音车厢被点赞，但这些细节引发争议",
        summary: "澎湃新闻聚焦实操层面争议：儿童哭闹怎么办？违规屡教不改怎么办？",
        body: "澎湃新闻 1 月 17 日讯 国铁集团宣布静音车厢扩容至 8000 列后，网友讨论最多的不是数字，而是'带娃旅客怎么办''违规屡教不改是否会调换车厢'等实操问题。记者采访铁路客服，对方表示将以柔性提醒为主，不强制处罚。但部分法律人士建议应建立正式的服务流程，避免执行争议。",
        sourceUrl: "https://www.thepaper.cn/newsDetail_forward_jingyin",
        views: 820000, likes: 14200, shares: 4100, comments: 3680,
      },
      {
        accountHandle: "xiaoqiang_kuaiping", platform: "douyin",
        title: "小强快评 | 8000 列静音车厢，为什么说这是公共文明的胜利",
        summary: "自媒体观点：从静音车厢看中国公共空间文明演进。",
        body: "从 2020 年的少数试点到 2026 年的 8000 列全面推广，静音车厢走过了 6 年。我认为它最大的价值不是服务本身，而是让'规则共识'在公共空间落地。对比西方的'Quiet Car'，中国版更强调'约定'而非'强制'，这种柔性治理值得关注。",
        sourceUrl: "https://www.douyin.com/video/xqkp/jingyin",
        views: 620000, likes: 21800, shares: 6200, comments: 4120,
      },
      {
        accountHandle: "cmg_guancha", platform: "wechat",
        title: "CMG 观察 | 从静音车厢看公共服务精细化",
        summary: "CMG 观察文章：静音车厢折射出的公共服务升级趋势。",
        body: "过去五年，中国的公共服务在精细化方向上步伐明显加快。静音车厢只是一个切面——它背后是'差异化需求识别、约定共识机制、柔性执行能力'三个要素的完善。这三者缺一不可。",
        sourceUrl: "https://mp.weixin.qq.com/s/cmg-jingyin",
        views: 320000, likes: 4200, shares: 1800, comments: 980,
      },
    ],
  },
  {
    topicName: "OpenAI GPT-5 发布",
    publishedAt: "2026-03-12T22:00:00Z",
    myVersion: {
      title: "北京时间 | GPT-5 正式发布：多模态、推理、Agent 三大能力全面升级",
      summary: "OpenAI 发布 GPT-5，支持更长上下文、更强推理、原生多模态。",
      body:
        "当地时间 3 月 12 日，OpenAI 正式发布 GPT-5。相比 GPT-4，GPT-5 在推理能力、多模态（图文音频）、Agent 能力三方面有显著提升。" +
        "模型支持 100 万 token 上下文窗口；新增'长链推理'模式，可持续思考数分钟解决复杂问题；Agent 能力允许自主完成多步骤任务。" +
        "OpenAI 同步开放 API，定价为 GPT-4 的 75%。国内厂商反应强烈，多家大模型公司表示将加快技术跟进。",
      distributions: [
        { myAccountHandle: "btime_app", publishedUrl: "https://www.btime.com/news/gpt5", views: 45200, likes: 820, shares: 320, comments: 186 },
        { myAccountHandle: "BRTV_news", publishedUrl: "https://www.douyin.com/video/brtv/gpt5", views: 186000, likes: 5820, shares: 1840, comments: 920 },
      ],
    },
    benchmarkVersions: [
      {
        accountHandle: "xinhua", platform: "douyin",
        title: "新华社 | OpenAI 发布 GPT-5，AI 竞赛进入新阶段",
        summary: "新华社报道 GPT-5 发布及其对国际 AI 格局的影响。",
        body: "新华社华盛顿 3 月 12 日电 OpenAI 于当地时间 12 日正式发布新一代大模型 GPT-5。该模型在推理、多模态与 Agent 能力上均有显著突破，标志着全球 AI 竞赛进入新阶段。业内专家认为，GPT-5 的发布将对芯片、数据中心、应用生态产生连锁反应。",
        sourceUrl: "https://www.xinhuanet.com/world/gpt5-release",
        views: 2820000, likes: 58200, shares: 18400, comments: 12800,
      },
      {
        accountHandle: "36kr.com", platform: "website",
        title: "36氪深度 | GPT-5 的 10 个技术要点与中国 AI 厂商的应对策略",
        summary: "36氪深度分析 GPT-5 技术细节及国内厂商动向。",
        body: "GPT-5 的发布引发行业震动。本文从架构、训练、推理、安全、开源策略 10 个维度梳理其技术亮点，并对比百度文心、阿里通义、字节豆包等国内大模型的当前进展。结论：差距从'代际'缩小为'半代'，但 Agent 能力仍是短板。",
        sourceUrl: "https://36kr.com/p/gpt5-analysis",
        views: 420000, likes: 12200, shares: 3820, comments: 1680,
      },
      {
        accountHandle: "caixin.com", platform: "website",
        title: "财新 | GPT-5 定价策略意在加速生态扩张",
        summary: "财新分析 GPT-5 定价降 25% 的商业逻辑。",
        body: "财新 3 月 13 日讯 OpenAI 将 GPT-5 API 定价定为 GPT-4 的 75%，行业观察人士认为此举意在加速开发者生态扩张，挤压竞争对手空间。过去 6 个月，Anthropic Claude、Google Gemini 都在积极抢占企业市场，OpenAI 通过降价与能力升级双管齐下。",
        sourceUrl: "https://www.caixin.com/2026-03-13/gpt5-pricing.html",
        views: 320000, likes: 8200, shares: 2400, comments: 1120,
      },
      {
        accountHandle: "zhinan_caijing", platform: "douyin",
        title: "直男财经 | GPT-5 最该看的不是参数，是这一条",
        summary: "自媒体观点：GPT-5 真正的杀手级能力是长链推理。",
        body: "GPT-5 参数量、上下文窗口都不是重点，真正的杀手锏是'长链推理'——让模型可以连续思考数分钟解决一个问题。这对金融、法律、科研场景意义重大。中国厂商要追的是这条，不是参数规模。",
        sourceUrl: "https://www.douyin.com/video/zcj/gpt5",
        views: 820000, likes: 28200, shares: 8600, comments: 4820,
      },
    ],
  },
  {
    topicName: "两会养老金改革新政",
    publishedAt: "2026-03-05T14:30:00Z",
    myVersion: {
      title: "北京时间 | 两会聚焦养老金并轨，企业职工与机关事业单位待遇拉近",
      summary: "2026 年两会养老金改革：企业职工与机关事业单位待遇差距将进一步缩小。",
      body:
        "2026 年全国两会 3 月 5 日审议养老金改革方案。方案核心是进一步并轨企业职工与机关事业单位养老金，建立统一的基本养老保险待遇计算公式。" +
        "方案亮点：1）待遇计发月数调整，延迟退休进入实施阶段；2）个人账户做实，可跨省转移；3）新设'补充养老金'账户，个人自愿投保。" +
        "国务院相关部门表示，改革分三年实施，2028 年完成全部并轨。",
      distributions: [
        { myAccountHandle: "btime_app", publishedUrl: "https://www.btime.com/news/pension-reform", views: 38200, likes: 512, shares: 186, comments: 142 },
        { myAccountHandle: "btv_weishi", publishedUrl: "https://www.douyin.com/video/btv/pension", views: 98200, likes: 2820, shares: 920, comments: 486 },
        { myAccountHandle: "btime_weibo", publishedUrl: "https://weibo.com/btime/pension", views: 52400, likes: 1240, shares: 420, comments: 268 },
      ],
    },
    benchmarkVersions: [
      {
        accountHandle: "xinhua", platform: "douyin",
        title: "新华社 | 两会权威发布：养老金改革三年并轨路线图",
        summary: "新华社独家发布养老金改革详细时间表。",
        body: "新华社北京 3 月 5 日电 全国两会 5 日审议通过养老金改革方案，将用 3 年时间完成企业职工与机关事业单位养老金并轨。这是自 2015 年启动改革以来最关键的一步。方案公布后，多位人大代表表示支持，认为这是社会公平的重要进步。",
        sourceUrl: "https://www.xinhuanet.com/2026lianghui/pension",
        views: 3120000, likes: 62200, shares: 21400, comments: 18600,
      },
      {
        accountHandle: "rmrb", platform: "douyin",
        title: "人民日报 | 养老金并轨：公平与可持续的双重考量",
        summary: "人民日报解读养老金并轨的双重目标。",
        body: "人民日报 3 月 5 日讯 今年两会审议的养老金改革方案，既追求待遇公平，也兼顾基金可持续。改革通过'统账结合 + 补充养老金'的结构，既保留激励，也做强兜底。多位社保专家认为，这是对上一轮改革的系统性升级。",
        sourceUrl: "https://www.peopledaily.cn/lianghui/pension-reform",
        views: 1820000, likes: 38200, shares: 12800, comments: 8420,
      },
      {
        accountHandle: "yicai.com", platform: "website",
        title: "第一财经 | 养老金改革 3 张图看懂：待遇如何变、账户如何并",
        summary: "第一财经用图表拆解养老金改革方案。",
        body: "本报记者整理了养老金改革的 3 张核心图表：1）待遇计发月数新表；2）个人账户跨省转移流程；3）补充养老金投资收益测算。方案落地后，50 岁群体影响最大，建议尽早规划个人账户。",
        sourceUrl: "https://www.yicai.com/news/pension-reform-chart.html",
        views: 620000, likes: 14200, shares: 4820, comments: 2680,
      },
      {
        accountHandle: "bjd.com.cn", platform: "website",
        title: "北京日报 | 北京代表热议养老金：企事业单位拉平如何兜底",
        summary: "北京日报关注北京代表团的两会发言与分组讨论。",
        body: "北京日报 3 月 6 日讯 在昨天的北京代表团分组讨论中，养老金改革成为热议话题。多位代表就'机关事业单位养老金下调如何过渡''北京市补充养老金投资如何保本'等议题展开讨论。北京市人社局相关负责人表示，将配套推出地方过渡政策。",
        sourceUrl: "https://www.bjd.com.cn/2026/pension.html",
        views: 182000, likes: 3820, shares: 1240, comments: 680,
      },
    ],
  },
];

// ============================================================================
// Main
// ============================================================================

async function main() {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error("Usage: npx tsx scripts/seed-topic-compare-demo.ts <orgId>");
    process.exit(1);
  }

  let myPostsCreated = 0;
  let distsCreated = 0;
  let benchmarkPostsCreated = 0;

  for (const seed of TOPIC_SEEDS) {
    console.log(`\n📝 话题：${seed.topicName}`);
    const publishedAt = new Date(seed.publishedAt);

    // 1. 创建 my_post
    const myFp = fp(seed.myVersion.title);
    const [existingMyPost] = await db
      .select({ id: myPosts.id })
      .from(myPosts)
      .where(and(eq(myPosts.organizationId, orgId), eq(myPosts.contentFingerprint, myFp)))
      .limit(1);

    let myPostId: string;
    if (existingMyPost) {
      myPostId = existingMyPost.id;
      console.log(`   (跳过 my_post，已存在)`);
    } else {
      const totalViews = seed.myVersion.distributions.reduce((s, d) => s + d.views, 0);
      const totalLikes = seed.myVersion.distributions.reduce((s, d) => s + d.likes, 0);
      const totalShares = seed.myVersion.distributions.reduce((s, d) => s + d.shares, 0);
      const totalComments = seed.myVersion.distributions.reduce((s, d) => s + d.comments, 0);

      const [row] = await db
        .insert(myPosts)
        .values({
          organizationId: orgId,
          title: seed.myVersion.title,
          summary: seed.myVersion.summary,
          body: seed.myVersion.body,
          topic: seed.topicName,
          contentFingerprint: myFp,
          publishedAt,
          totalViews,
          totalLikes,
          totalShares,
          totalComments,
          statsAggregatedAt: new Date(),
        })
        .returning({ id: myPosts.id });
      myPostId = row.id;
      myPostsCreated++;
    }

    // 2. 写 distributions
    for (const dist of seed.myVersion.distributions) {
      const [acc] = await db
        .select({ id: myAccounts.id })
        .from(myAccounts)
        .where(and(eq(myAccounts.organizationId, orgId), eq(myAccounts.handle, dist.myAccountHandle)))
        .limit(1);
      if (!acc) {
        console.log(`   ⚠️  未找到 my_account handle=${dist.myAccountHandle}，跳过 distribution`);
        continue;
      }
      await db
        .insert(myPostDistributions)
        .values({
          myPostId,
          myAccountId: acc.id,
          publishedUrl: dist.publishedUrl,
          publishedAt,
          views: dist.views,
          likes: dist.likes,
          shares: dist.shares,
          comments: dist.comments,
        })
        .onConflictDoUpdate({
          target: [myPostDistributions.myPostId, myPostDistributions.myAccountId],
          set: {
            publishedUrl: dist.publishedUrl,
            views: dist.views,
            likes: dist.likes,
            shares: dist.shares,
            comments: dist.comments,
            collectedAt: new Date(),
          },
        });
      distsCreated++;
    }

    // 3. 写 benchmark_posts
    const benchmarkPostIds: string[] = [];
    for (const bv of seed.benchmarkVersions) {
      const [acc] = await db
        .select({ id: benchmarkAccounts.id })
        .from(benchmarkAccounts)
        .where(
          and(
            eq(benchmarkAccounts.handle, bv.accountHandle),
            eq(benchmarkAccounts.platform, bv.platform as never)
          )
        )
        .limit(1);
      if (!acc) {
        console.log(`   ⚠️  未找到 benchmark_account handle=${bv.accountHandle} platform=${bv.platform}`);
        continue;
      }
      const bvFp = fp(bv.title);
      const [existingBench] = await db
        .select({ id: benchmarkPosts.id })
        .from(benchmarkPosts)
        .where(
          and(
            eq(benchmarkPosts.benchmarkAccountId, acc.id),
            eq(benchmarkPosts.contentFingerprint, bvFp)
          )
        )
        .limit(1);

      let bpId: string;
      if (existingBench) {
        bpId = existingBench.id;
      } else {
        const [row] = await db
          .insert(benchmarkPosts)
          .values({
            benchmarkAccountId: acc.id,
            title: bv.title,
            summary: bv.summary,
            body: bv.body,
            topic: seed.topicName,
            contentFingerprint: bvFp,
            sourceUrl: bv.sourceUrl,
            publishedAt: new Date(publishedAt.getTime() - Math.floor(Math.random() * 6) * 3600 * 1000),
            views: bv.views,
            likes: bv.likes,
            shares: bv.shares,
            comments: bv.comments,
          })
          .returning({ id: benchmarkPosts.id });
        bpId = row.id;
        benchmarkPostsCreated++;
      }
      benchmarkPostIds.push(bpId);
    }

    // 4. 写 topic_matches（写死预计算的"同题关系"，不需要实际跑 LLM）
    if (benchmarkPostIds.length > 0) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000); // 7 天
      await db
        .insert(topicMatches)
        .values({
          organizationId: orgId,
          myPostId,
          benchmarkPostIds,
          matchCount: benchmarkPostIds.length,
          similarityScore: 0.88,
          matchedBy: "manual",
          matchedReasons: benchmarkPostIds.map((id) => ({
            benchmarkPostId: id,
            similarityScore: 0.85 + Math.random() * 0.1,
            reason: "demo seed：同一事件报道",
          })),
          aiAnalysis: { overallTopic: seed.topicName },
          aiAnalysisSource: "manual_seed",
          aiAnalysisAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: topicMatches.myPostId,
          set: {
            benchmarkPostIds,
            matchCount: benchmarkPostIds.length,
            updatedAt: now,
          },
        });
    }

    // 5. 更新账号 post_count
    await db.execute(
      `UPDATE my_accounts SET post_count = (SELECT count(*) FROM my_post_distributions WHERE my_account_id = my_accounts.id) WHERE organization_id = '${orgId}'` as never
    );
    await db.execute(
      `UPDATE benchmark_accounts SET post_count = (SELECT count(*) FROM benchmark_posts WHERE benchmark_account_id = benchmark_accounts.id)` as never
    );
  }

  console.log(`\n✅ Demo seed 完成：`);
  console.log(`   my_posts: +${myPostsCreated}`);
  console.log(`   distributions: +${distsCreated}`);
  console.log(`   benchmark_posts: +${benchmarkPostsCreated}`);
  console.log(`   topic_matches: 已铺 ${TOPIC_SEEDS.length} 组`);
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-topic-compare-demo fatal:", err);
  process.exit(1);
});
