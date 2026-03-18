import type { EmployeeId } from "@/lib/constants";

export interface SportEvent {
  id: string;
  name: string;
  teams: { name: string; score: number; logo: string }[];
  status: "live" | "upcoming" | "finished";
  time: string;
  period: string;
  highlights: {
    time: string;
    type: "goal" | "slam_dunk" | "save" | "foul" | "highlight";
    description: string;
    autoClipped: boolean;
  }[];
  autoOutputs: {
    id: string;
    title: string;
    type: "clip" | "summary" | "graphic";
    status: "done" | "processing" | "pending";
    progress: number;
    duration?: string;
  }[];
  stats: { produced: number; published: number; totalViews: number };
}

export interface ConferenceEvent {
  id: string;
  name: string;
  speaker: string;
  speakerTitle: string;
  status: "live" | "upcoming" | "finished";
  time: string;
  transcription: string[];
  goldenQuotes: string[];
  outputs: {
    id: string;
    title: string;
    type: "flash" | "summary" | "quote_card";
    status: "done" | "processing";
  }[];
  stats: { transcribedWords: number; quotesExtracted: number; outputsGenerated: number };
}

export interface FestivalEvent {
  id: string;
  name: string;
  date: string;
  phases: {
    name: string;
    status: "completed" | "active" | "pending";
    progress: number;
    outputs: string[];
  }[];
}

export interface ExhibitionEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  booths: {
    company: string;
    visited: boolean;
    reports: number;
    keyProducts: string[];
  }[];
  autoProducts: {
    company: string;
    product: string;
    summary: string;
  }[];
}

export const sportEvent: SportEvent = {
  id: "se-1",
  name: "CBA总决赛 G5",
  teams: [
    { name: "广东队", score: 98, logo: "粤" },
    { name: "辽宁队", score: 95, logo: "辽" },
  ],
  status: "live",
  time: "第四节 02:38",
  period: "Q4",
  highlights: [
    { time: "Q1 05:22", type: "slam_dunk", description: "易建联暴扣得手！全场沸腾", autoClipped: true },
    { time: "Q1 08:15", type: "goal", description: "郭艾伦三分命中，辽宁反超", autoClipped: true },
    { time: "Q2 03:40", type: "highlight", description: "广东队打出12-0攻击波", autoClipped: true },
    { time: "Q2 10:00", type: "save", description: "精彩封盖！周琦大帽拒绝上篮", autoClipped: true },
    { time: "Q3 06:30", type: "slam_dunk", description: "赵继伟助攻反击暴扣", autoClipped: true },
    { time: "Q3 11:45", type: "goal", description: "三分绝杀！比赛进入白热化", autoClipped: false },
    { time: "Q4 01:15", type: "highlight", description: "检测到高光时刻！关键球处理", autoClipped: true },
  ],
  autoOutputs: [
    { id: "ao-1", title: "上半场精彩集锦", type: "clip", status: "done", progress: 100, duration: "02:30" },
    { id: "ao-2", title: "第三节高光时刻", type: "clip", status: "done", progress: 100, duration: "01:45" },
    { id: "ao-3", title: "实时比分图卡", type: "graphic", status: "done", progress: 100 },
    { id: "ao-4", title: "第四节精彩剪辑", type: "clip", status: "processing", progress: 45, duration: "进行中" },
    { id: "ao-5", title: "全场比赛总结", type: "summary", status: "pending", progress: 0 },
  ],
  stats: { produced: 8, published: 5, totalViews: 128000 },
};

export const conferenceEvent: ConferenceEvent = {
  id: "ce-1",
  name: "2026中国数字经济峰会",
  speaker: "李教授",
  speakerTitle: "中国科学院院士",
  status: "live",
  time: "14:30 - 进行中",
  transcription: [
    "今天我想谈谈人工智能在数字经济中的角色转变...",
    "过去三年，AI技术从工具层面上升到了基础设施层面...",
    "我们观察到三个重要趋势：第一，端侧智能的快速普及...",
    "第二，大模型正在从通用走向行业专用...",
    "第三，AI Agent正在改变生产力的组织方式...",
    "以媒体行业为例，AI已经能够自动完成从热点监控到内容生产的全流程...",
  ],
  goldenQuotes: [
    "AI不是替代人类，而是让每个人都拥有一个AI团队",
    "未来三年，90%的内容生产将由AI辅助完成",
    "端侧智能将成为下一个万亿级市场",
  ],
  outputs: [
    { id: "co-1", title: "【快讯】院士：AI让每个人都拥有AI团队", type: "flash", status: "done" },
    { id: "co-2", title: "峰会上半场要点摘要", type: "summary", status: "done" },
    { id: "co-3", title: "金句卡片：端侧智能万亿市场", type: "quote_card", status: "done" },
    { id: "co-4", title: "实时演讲要点追踪", type: "summary", status: "processing" },
  ],
  stats: { transcribedWords: 8500, quotesExtracted: 3, outputsGenerated: 4 },
};

export const festivalEvent: FestivalEvent = {
  id: "fe-1",
  name: "元宵节特别策划",
  date: "2026-03-05",
  phases: [
    {
      name: "预制内容",
      status: "completed",
      progress: 100,
      outputs: [
        "元宵节习俗科普长图",
        "全国灯会盘点H5",
        "元宵节祝福视频模板×5",
        "历史上的今天：元宵节故事",
      ],
    },
    {
      name: "实时补充",
      status: "active",
      progress: 60,
      outputs: [
        "各地灯会实况图集（持续更新）",
        "猜灯谜互动H5（已上线）",
      ],
    },
    {
      name: "汇总盘点",
      status: "pending",
      progress: 0,
      outputs: [],
    },
  ],
};

export const exhibitionEvent: ExhibitionEvent = {
  id: "ee-1",
  name: "2026 MWC世界移动通信大会",
  date: "2026-03-03 ~ 03-06",
  location: "巴塞罗那",
  booths: [
    { company: "华为", visited: true, reports: 3, keyProducts: ["Mate 70 Pro", "6G原型机", "AI算力卡"] },
    { company: "高通", visited: true, reports: 2, keyProducts: ["骁龙8 Gen4", "AI PC芯片"] },
    { company: "三星", visited: true, reports: 2, keyProducts: ["Galaxy S26", "折叠屏新品"] },
    { company: "小米", visited: false, reports: 0, keyProducts: ["SU7 Ultra", "小米15 Pro"] },
    { company: "联发科", visited: false, reports: 0, keyProducts: ["天玑9400", "卫星通信芯片"] },
    { company: "诺基亚", visited: true, reports: 1, keyProducts: ["5G基站", "专网方案"] },
  ],
  autoProducts: [
    { company: "华为", product: "6G原型机", summary: "华为展示全球首款6G通信原型机，下行速率达到100Gbps，支持全息通信演示。" },
    { company: "高通", product: "AI PC芯片", summary: "骁龙X Elite 2代发布，NPU算力提升至75TOPS，支持端侧运行百亿参数大模型。" },
    { company: "三星", product: "折叠屏新品", summary: "Galaxy Z Fold 7采用全新铰链设计，折痕几乎不可见，电池容量提升30%。" },
  ],
};
