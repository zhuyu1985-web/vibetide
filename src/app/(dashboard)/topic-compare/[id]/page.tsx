import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { topicCompareArticles } from "@/data/benchmarking-data";
import type { TopicCompareDetail, NetworkReport, CompetitorGroup } from "@/lib/types";
import { TopicDetailClient } from "./topic-detail-client";

export const dynamic = "force-dynamic";

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let orgId: string | null = null;
  try {
    orgId = await getCurrentUserOrg();
  } catch {
    // continue with mock data
  }
  void orgId;

  const article = topicCompareArticles.find((a) => a.id === id);
  if (!article) notFound();

  const detail: TopicCompareDetail = {
    article,
    stats: {
      totalReports: 47,
      centralCount: 12,
      provincialCount: 18,
      otherCount: 17,
      earliestTime: "2026-04-17T06:30:00Z",
      latestTime: "2026-04-17T14:20:00Z",
      trendDelta: 12.5,
    },
    aiSummary: {
      centralMediaReport:
        "央级媒体对本话题的报道主要集中在产业政策和国际竞争力两个维度。人民日报侧重从产业链安全角度分析AI手机对国产芯片的带动效应，强调自主可控的战略意义；新华社则从消费者权益视角切入，通过实地走访多城市卖场，呈现了价格战对普通消费者购机决策的影响；央视新闻从国际横向对比角度，分析中美AI手机技术差距及其背后的产业生态差异。整体来看，央媒报道注重宏观视角和政策导向，报道深度较强。",
      otherMediaReport:
        "省级及其他媒体的报道更偏向产品评测和市场分析。澎湃新闻数码组进行了三款旗舰机的全方位性能横评，数据翔实且图表丰富；第一财经从供应链成本角度拆解了AI手机的BOM成本结构，为行业分析提供了独特视角。自媒体方面，多个科技博主进行了开箱评测和上手体验分享，在社交媒体上引发较高互动。",
      highlights:
        "1. 人民日报首次将AI手机与国家芯片战略进行深度关联分析\n2. 新华社采用了大规模消费者走访调研方式，数据来源扎实\n3. 央视新闻的中美对比视角提供了国际化分析框架\n4. 澎湃的横评测试方法论严谨，覆盖了续航、AI功能响应速度等关键指标",
      overallSummary:
        "本话题全网报道共47篇，覆盖央级、省级、市级及自媒体多个层级。整体报道趋势呈现多角度、多层次的特点。央级媒体聚焦政策与战略层面，省级媒体侧重产品与市场分析，形成了互补的报道格局。我方报道在时效性和互动策略上表现良好，但在深度分析和独家视角方面仍有提升空间，建议参考人民日报的产业链分析框架和新华社的实地调研方法。",
      sourceArticles: [],
      generatedAt: "2026-04-17T12:00:00Z",
    },
    lastAnalyzedAt: "2026-04-17T12:00:00Z",
  };

  const reports: NetworkReport[] = [
    {
      id: "nr-1",
      title: "AI手机产业链对国产芯片的推动作用",
      sourceOutlet: "人民日报",
      mediaLevel: "central",
      publishedAt: "2026-04-17T08:00:00Z",
      author: "科技部记者",
      summary: "人民日报从产业政策角度分析AI手机产业链对国产芯片的推动作用",
      sourceUrl: "#",
      contentType: "text",
      aiInterpretation: null,
    },
    {
      id: "nr-2",
      title: "AI手机价格战对消费者的实际影响调查",
      sourceOutlet: "新华社",
      mediaLevel: "central",
      publishedAt: "2026-04-17T07:30:00Z",
      author: "新华社记者",
      summary: "新华社从消费者权益视角调查走访多个城市的手机卖场",
      sourceUrl: "#",
      contentType: "text",
      aiInterpretation: null,
    },
    {
      id: "nr-3",
      title: "中美AI手机技术差距深度对比",
      sourceOutlet: "央视新闻",
      mediaLevel: "central",
      publishedAt: "2026-04-17T09:00:00Z",
      author: "央视科技组",
      summary: "央视新闻从国际竞争力角度对比中美AI手机技术水平",
      sourceUrl: "#",
      contentType: "video",
      aiInterpretation: null,
    },
    {
      id: "nr-4",
      title: "三大品牌AI手机性能横评：谁才是真旗舰？",
      sourceOutlet: "澎湃新闻",
      mediaLevel: "provincial",
      publishedAt: "2026-04-17T10:00:00Z",
      author: "数码编辑部",
      summary: "澎湃新闻数码组拿到三款新机进行全方位性能横评",
      sourceUrl: "#",
      contentType: "text",
      aiInterpretation: null,
    },
  ];

  const competitorGroups: CompetitorGroup[] = [
    {
      level: "central",
      levelLabel: "央级媒体",
      levelColor:
        "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/30",
      outlets: [
        {
          outletName: "人民日报",
          articles: [
            {
              title: "AI手机产业链对国产芯片的推动作用",
              subject: "产业政策",
              publishedAt: "04-17 08:00",
              channel: "微信公众号",
              sourceUrl: "#",
            },
          ],
        },
        {
          outletName: "新华社",
          articles: [
            {
              title: "AI手机价格战对消费者的实际影响调查",
              subject: "消费者权益",
              publishedAt: "04-17 07:30",
              channel: "APP",
              sourceUrl: "#",
            },
          ],
        },
        {
          outletName: "央视新闻",
          articles: [
            {
              title: "中美AI手机技术差距深度对比",
              subject: "国际竞争力",
              publishedAt: "04-17 09:00",
              channel: "央视频",
              sourceUrl: "#",
            },
          ],
        },
      ],
    },
    {
      level: "provincial",
      levelLabel: "省级媒体",
      levelColor:
        "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30",
      outlets: [
        {
          outletName: "澎湃新闻",
          articles: [
            {
              title: "三大品牌AI手机性能横评",
              subject: "产品评测",
              publishedAt: "04-17 10:00",
              channel: "APP",
              sourceUrl: "#",
            },
          ],
        },
        {
          outletName: "第一财经",
          articles: [
            {
              title: "AI手机供应链成本结构拆解",
              subject: "供应链分析",
              publishedAt: "04-17 09:30",
              channel: "网站",
              sourceUrl: "#",
            },
          ],
        },
      ],
    },
  ];

  return (
    <TopicDetailClient
      detail={detail}
      reports={reports}
      competitorGroups={competitorGroups}
    />
  );
}
