import type { EmployeeId } from "@/lib/constants";

export interface CreationGoal {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed";
  createdAt: string;
}

export interface SuperCreationTask {
  id: string;
  title: string;
  mediaType: "article" | "video" | "audio" | "h5";
  status: "queued" | "drafting" | "reviewing" | "approved" | "published";
  assignee: EmployeeId;
  progress: number;
  aiResponsible: string;
  wordCount: number;
  content: {
    headline: string;
    body: string;
    imageNotes?: string[];
  };
  advisorNotes?: string[];
}

export interface ChatMessage {
  id: string;
  role: "editor" | "ai";
  employeeId?: EmployeeId;
  name: string;
  content: string;
  timestamp: string;
}

export const activeGoal: CreationGoal = {
  id: "goal-1",
  title: "AI手机大战全方位报道",
  description: "围绕三巨头AI旗舰手机发布，产出图文深度报道、短视频速览、H5互动页等全媒体内容",
  status: "active",
  createdAt: "08:30",
};

export const superCreationTasks: SuperCreationTask[] = [
  {
    id: "sct-1",
    title: "AI手机大战深度评测",
    mediaType: "article",
    status: "reviewing",
    assignee: "xiaowen",
    progress: 85,
    aiResponsible: "小文",
    wordCount: 2800,
    content: {
      headline: "三巨头AI手机大战：谁才是真正的AI旗舰？",
      body: "2026年3月，华为、小米、OPPO三大品牌不约而同在同一天发布了各自的AI旗舰手机。这场AI手机大战不仅是硬件的较量，更是AI生态的全面竞争...\n\n## 芯片对决\n\n华为麒麟9100搭载自研NPU，AI算力达到45TOPS...\n\n## AI功能对比\n\n三款手机都搭载了端侧大模型，但各有侧重：\n- 华为：智能体生态最完善\n- 小米：性价比最高\n- OPPO：影像AI提升最大",
      imageNotes: [
        "三款手机正面对比图",
        "芯片跑分对比柱状图",
        "AI功能特性雷达图",
      ],
    },
    advisorNotes: [
      "微信端建议突出深度对比，篇幅可以稍长",
      "注意避免过度偏向某品牌，保持客观中立",
    ],
  },
  {
    id: "sct-2",
    title: "新能源降价潮全景分析",
    mediaType: "article",
    status: "drafting",
    assignee: "xiaowen",
    progress: 45,
    aiResponsible: "小文",
    wordCount: 1200,
    content: {
      headline: "新能源汽车降价潮：消费者等等党的胜利？",
      body: "特斯拉率先开启降价，比亚迪、蔚来紧随其后...\n\n正在撰写中...",
      imageNotes: ["降价对比信息图"],
    },
  },
  {
    id: "sct-3",
    title: "60秒看懂AI手机大战",
    mediaType: "video",
    status: "reviewing",
    assignee: "xiaojian",
    progress: 90,
    aiResponsible: "小剪",
    wordCount: 350,
    content: {
      headline: "60秒看懂AI手机大战",
      body: "【画面1】三款手机同时亮相\n【画面2】芯片对比动画\n【画面3】AI功能演示拼图\n【画面4】价格总结\n【画面5】结尾引导互动",
    },
  },
  {
    id: "sct-4",
    title: "两会数字经济前瞻",
    mediaType: "article",
    status: "queued",
    assignee: "xiaowen",
    progress: 0,
    aiResponsible: "小文",
    wordCount: 0,
    content: {
      headline: "两会数字经济前瞻：AI立法将如何影响你的生活？",
      body: "",
    },
  },
  {
    id: "sct-5",
    title: "AI手机互动H5",
    mediaType: "h5",
    status: "drafting",
    assignee: "xiaojian",
    progress: 30,
    aiResponsible: "小剪",
    wordCount: 0,
    content: {
      headline: "测测你最适合哪款AI手机",
      body: "互动问答H5，通过5个问题推荐最适合的AI手机",
    },
  },
];

export const chatHistory: ChatMessage[] = [
  {
    id: "chat-1",
    role: "editor",
    name: "张编辑",
    content: "@小文 AI手机大战的文章开头需要更有冲击力，建议用数据对比开场",
    timestamp: "09:15",
  },
  {
    id: "chat-2",
    role: "ai",
    employeeId: "xiaowen",
    name: "小文",
    content: "收到！我来调整开头。用「三款旗舰手机，7200秒发布会，45TOPS AI算力」的数据组合作为开场，您觉得如何？",
    timestamp: "09:16",
  },
  {
    id: "chat-3",
    role: "editor",
    name: "张编辑",
    content: "很好！另外芯片对比部分需要加入跑分数据",
    timestamp: "09:20",
  },
  {
    id: "chat-4",
    role: "ai",
    employeeId: "xiaozi",
    name: "小资",
    content: "我已找到三款芯片的 AnTuTu 和 Geekbench 跑分数据，已发送给小文参考。华为麒麟9100综合跑分最高，小米骁龙8 Gen4紧随其后。",
    timestamp: "09:22",
  },
  {
    id: "chat-5",
    role: "ai",
    employeeId: "xiaowen",
    name: "小文",
    content: "跑分数据已整合到芯片对比章节，新增了可视化柱状图说明。初稿已更新，请审阅。",
    timestamp: "09:35",
  },
  {
    id: "chat-6",
    role: "editor",
    name: "张编辑",
    content: "@小审 请对AI手机大战深度评测进行终审",
    timestamp: "09:40",
  },
  {
    id: "chat-7",
    role: "ai",
    employeeId: "xiaoshen",
    name: "小审",
    content: "收到！正在进行事实核查和敏感内容检测。预计15分钟完成。",
    timestamp: "09:41",
  },
];
