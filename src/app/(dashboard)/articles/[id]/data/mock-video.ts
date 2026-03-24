import type { TranscriptSegment, VideoChapter } from "../types";

export const MOCK_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export const MOCK_CHAPTERS: VideoChapter[] = [
  { title: "导语开场", startTime: 0, endTime: 90 },
  { title: "政策核心内容", startTime: 90, endTime: 225 },
  { title: "专家采访：李明院士", startTime: 225, endTime: 360 },
  { title: "行业反应与市场影响", startTime: 360, endTime: 480 },
  { title: "总结展望", startTime: 480, endTime: 570 },
];

export const MOCK_TRANSCRIPT: TranscriptSegment[] = [
  {
    id: "t1",
    speaker: "主持人",
    startTime: 0,
    endTime: 15,
    text: "各位观众大家好，欢迎收看今天的新闻特别报道。",
  },
  {
    id: "t2",
    speaker: "主持人",
    startTime: 15,
    endTime: 35,
    text: "今天我们关注的是国务院刚刚发布的一项重要政策——关于加快新能源产业高质量发展的指导意见。",
  },
  {
    id: "t3",
    speaker: "主持人",
    startTime: 35,
    endTime: 55,
    text: "这份文件对我国新能源产业未来五年的发展方向作出了全面部署。",
  },
  {
    id: "t4",
    speaker: "记者 张三",
    startTime: 60,
    endTime: 85,
    text: "据了解，《意见》明确提出到2030年新能源消费比重达到25%以上，非化石能源发电装机占比超过50%。",
  },
  {
    id: "t5",
    speaker: "记者 张三",
    startTime: 85,
    endTime: 110,
    text: "这标志着中国在双碳目标下，进一步加速能源结构转型步伐。",
  },
  {
    id: "t6",
    speaker: "记者 张三",
    startTime: 115,
    endTime: 140,
    text: "政策主要涵盖三大领域：光伏风电财政支持、储能技术攻关、以及新能源汽车充电网络建设。",
  },
  {
    id: "t7",
    speaker: "李明 院士",
    startTime: 230,
    endTime: 260,
    text: "新能源产业已经进入从量到质的关键转型期。这份指导意见的出台，是对整个行业信心的极大提振。",
  },
  {
    id: "t8",
    speaker: "李明 院士",
    startTime: 260,
    endTime: 290,
    text: "特别是储能技术被列为国家重点科技攻关方向，这将从根本上解决新能源消纳的瓶颈问题。",
  },
  {
    id: "t9",
    speaker: "李明 院士",
    startTime: 295,
    endTime: 325,
    text: "我预计未来三到五年，储能成本将下降40%以上，届时新能源发电的经济性将全面超越传统能源。",
  },
  {
    id: "t10",
    speaker: "主持人",
    startTime: 365,
    endTime: 390,
    text: "政策公布后，资本市场反应积极。新能源板块整体上涨3.2%，其中储能概念股涨幅最为突出。",
  },
  {
    id: "t11",
    speaker: "主持人",
    startTime: 395,
    endTime: 420,
    text: "多家券商发布研报表示，本次政策力度超预期，行业长期逻辑进一步强化。",
  },
  {
    id: "t12",
    speaker: "主持人",
    startTime: 485,
    endTime: 520,
    text: "总的来看，这份指导意见为我国新能源产业描绘了清晰的发展蓝图。",
  },
  {
    id: "t13",
    speaker: "主持人",
    startTime: 520,
    endTime: 560,
    text: "从政策支持到技术突破，从产业布局到市场响应，新能源产业正在迎来新一轮高质量发展的黄金期。感谢收看。",
  },
];
