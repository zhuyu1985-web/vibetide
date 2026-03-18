import type { CreationTask } from "@/lib/types";

export const creationTasks: CreationTask[] = [
  {
    id: "ct1",
    title: "AI手机大战：消费者的三重抉择",
    mediaType: "article",
    status: "reviewing",
    assignee: "xiaowen",
    content: {
      headline: "AI手机大战：消费者的三重抉择",
      body: `2026年2月，智能手机行业迎来了一场前所未有的AI技术竞赛。华为、苹果、三星三大巨头在同一天发布了各自的AI手机战略，将手机行业推入了一个全新的竞争维度。

## 华为：端侧大模型，隐私为先

华为最新发布的Mate 70系列搭载了自研的盘古端侧大模型，这是业界首个完全在手机端运行的百亿参数大模型。华为消费者业务CEO在发布会上强调："你的数据永远不会离开你的手机。"

这一策略直击当前用户对AI应用最大的顾虑——数据隐私。盘古端侧模型支持离线运行，即使在没有网络的情况下，也能提供完整的AI助手功能，包括智能文档处理、实时翻译和个性化推荐。

## 苹果：生态协同，无缝体验

苹果则选择了一条不同的路径。新一代Apple Intelligence不再局限于iPhone，而是打通了Mac、iPad、Apple Watch和Vision Pro的全线产品。

"AI不应该是一个独立的功能，它应该融入你生活的每一个场景，"苹果CEO在主题演讲中这样描述。通过iCloud端到端加密和设备间联邦学习，苹果实现了跨设备的AI体验一致性，同时保证了数据安全。

## 三星：开放灵活，合作共赢

三星Galaxy S26系列则走了开放路线。Galaxy AI 2.0支持接入多个第三方AI服务，用户可以自由选择使用Google Gemini、Claude或本地AI模型。

这种"AI超市"模式给了用户最大的选择权，也为三星建立了独特的竞争优势：无论哪个AI模型最终胜出，三星用户都不会被锁定。

## 消费者的抉择

对于普通消费者而言，选择变得既简单又复杂：
- 看重隐私安全→华为
- 深度果粉生态→苹果
- 追求灵活开放→三星

但归根结底，AI手机的竞争才刚刚开始。真正的赢家将是能够让AI真正融入用户日常生活、解决实际痛点的那一方。`,
      imageNotes: [
        "配图1：三品牌AI手机对比信息图",
        "配图2：端侧大模型 vs 云端模型架构对比",
        "配图3：用户调研数据可视化",
      ],
    },
    advisorNotes: [
      "老陈建议：标题可以更接地气，考虑「三大手机巨头AI混战，普通人到底买哪个？」",
      "学姐建议：增加价格对比段落，读者最关心性价比",
    ],
    createdAt: "2026-02-26T09:00:00Z",
    wordCount: 2800,
  },
  {
    id: "ct2",
    title: "新能源汽车降价潮深度分析",
    mediaType: "article",
    status: "drafting",
    assignee: "xiaowen",
    content: {
      headline: "新能源降价潮：是抄底良机还是行业寒冬？",
      body: `春节刚过，新能源汽车市场就投下了一枚重磅炸弹。2月24日至26日，短短三天内，已有超过15个品牌宣布不同幅度的价格调整。

## 降价概览

| 品牌 | 车型 | 降幅 |
|------|------|------|
| 特斯拉 | Model 3/Y | 1.5-2.8万 |
| 比亚迪 | 汉/唐 | 1-3万 |
| 蔚来 | ET5/ES6 | 2-5万（权益调整） |
| 小鹏 | G6/P7 | 1.5-2万 |

（撰写中...）`,
      imageNotes: ["配图1：各品牌降价幅度对比图表", "配图2：新能源汽车月销量趋势"],
    },
    createdAt: "2026-02-26T09:30:00Z",
    wordCount: 1200,
  },
  {
    id: "ct3",
    title: "AI手机大战60秒速览",
    mediaType: "video",
    status: "reviewing",
    assignee: "xiaojian",
    content: {
      headline: "60秒看懂AI手机大战",
      body: "【开场】三大手机巨头同日发布AI战略，手机行业变天了！\n【华为段】华为：我们的AI不上云，你的隐私我来守...\n【苹果段】苹果：一个AI，所有设备无缝衔接...\n【三星段】三星：想用谁的AI你说了算...\n【结尾】你会选哪家？评论区告诉我",
    },
    createdAt: "2026-02-26T11:30:00Z",
    wordCount: 350,
  },
  {
    id: "ct4",
    title: "两会数字经济前瞻快讯",
    mediaType: "article",
    status: "drafting",
    assignee: "xiaowen",
    content: {
      headline: "两会前瞻：数字经济五大看点",
      body: "（排期中，预计11:00开始撰写）",
    },
    createdAt: "2026-02-26T10:00:00Z",
    wordCount: 0,
  },
];
