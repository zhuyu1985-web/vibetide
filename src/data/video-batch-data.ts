export interface BatchTopic {
  id: string;
  title: string;
  progress: number;
  channels: {
    channel: string;
    status: "done" | "processing" | "pending";
    format: string;
  }[];
}

export interface ConversionTask {
  id: string;
  title: string;
  sourceRatio: string;
  targetRatio: string;
  status: "done" | "processing" | "pending";
  settings: {
    smartFocus: boolean;
    facePriority: boolean;
    subtitleReflow: boolean;
  };
}

export interface DigitalHumanConfig {
  id: string;
  name: string;
  avatar: string;
  style: "formal" | "friendly" | "energetic";
  voiceType: string;
}

export interface BatchStats {
  todayOutput: number;
  inProgress: number;
  published: number;
  pendingReview: number;
}

export const batchStats: BatchStats = {
  todayOutput: 18,
  inProgress: 4,
  published: 12,
  pendingReview: 2,
};

export const batchTopics: BatchTopic[] = [
  {
    id: "vb-1",
    title: "AI手机大战速览",
    progress: 100,
    channels: [
      { channel: "微信视频号", status: "done", format: "竖版 9:16 60s" },
      { channel: "抖音", status: "done", format: "竖版 9:16 30s" },
      { channel: "微博", status: "done", format: "横版 16:9 90s" },
      { channel: "头条", status: "done", format: "横版 16:9 120s" },
    ],
  },
  {
    id: "vb-2",
    title: "新能源降价全景图",
    progress: 75,
    channels: [
      { channel: "微信视频号", status: "done", format: "竖版 9:16 45s" },
      { channel: "抖音", status: "done", format: "竖版 9:16 30s" },
      { channel: "微博", status: "processing", format: "横版 16:9 60s" },
      { channel: "头条", status: "pending", format: "横版 16:9 90s" },
    ],
  },
  {
    id: "vb-3",
    title: "两会数字经济前瞻",
    progress: 50,
    channels: [
      { channel: "微信视频号", status: "done", format: "竖版 9:16 60s" },
      { channel: "抖音", status: "processing", format: "竖版 9:16 30s" },
      { channel: "微博", status: "pending", format: "横版 16:9 90s" },
      { channel: "头条", status: "pending", format: "横版 16:9 120s" },
    ],
  },
  {
    id: "vb-4",
    title: "GPT-5新功能解读",
    progress: 25,
    channels: [
      { channel: "微信视频号", status: "processing", format: "竖版 9:16 45s" },
      { channel: "抖音", status: "pending", format: "竖版 9:16 30s" },
      { channel: "微博", status: "pending", format: "横版 16:9 60s" },
      { channel: "头条", status: "pending", format: "横版 16:9 90s" },
    ],
  },
  {
    id: "vb-5",
    title: "春季档票房破百亿",
    progress: 0,
    channels: [
      { channel: "微信视频号", status: "pending", format: "竖版 9:16 30s" },
      { channel: "抖音", status: "pending", format: "竖版 9:16 20s" },
      { channel: "微博", status: "pending", format: "横版 16:9 45s" },
      { channel: "头条", status: "pending", format: "横版 16:9 60s" },
    ],
  },
];

export const conversionTasks: ConversionTask[] = [
  {
    id: "cv-1",
    title: "AI手机发布会直播片段",
    sourceRatio: "16:9",
    targetRatio: "9:16",
    status: "done",
    settings: { smartFocus: true, facePriority: true, subtitleReflow: true },
  },
  {
    id: "cv-2",
    title: "新能源汽车工厂探访",
    sourceRatio: "16:9",
    targetRatio: "9:16",
    status: "processing",
    settings: { smartFocus: true, facePriority: false, subtitleReflow: true },
  },
  {
    id: "cv-3",
    title: "两会记者现场报道",
    sourceRatio: "16:9",
    targetRatio: "9:16",
    status: "pending",
    settings: { smartFocus: true, facePriority: true, subtitleReflow: false },
  },
];

export const digitalHumans: DigitalHumanConfig[] = [
  { id: "dh-1", name: "小新", avatar: "新", style: "formal", voiceType: "标准男声" },
  { id: "dh-2", name: "小悦", avatar: "悦", style: "friendly", voiceType: "亲切女声" },
  { id: "dh-3", name: "小动", avatar: "动", style: "energetic", voiceType: "活力男声" },
];

export const channelAdaptations = [
  {
    channel: "微信视频号",
    icon: "💬",
    format: "竖版短视频",
    ratio: "9:16",
    duration: "30-60s",
    style: "信息密集+字幕大号",
    status: "done" as const,
  },
  {
    channel: "抖音",
    icon: "🎵",
    format: "竖版短视频",
    ratio: "9:16",
    duration: "15-30s",
    style: "节奏快+热门BGM",
    status: "done" as const,
  },
  {
    channel: "微博",
    icon: "📱",
    format: "横版视频",
    ratio: "16:9",
    duration: "60-120s",
    style: "深度解读+数据图表",
    status: "processing" as const,
  },
  {
    channel: "头条",
    icon: "📰",
    format: "横版视频",
    ratio: "16:9",
    duration: "90-180s",
    style: "完整叙事+专业感",
    status: "pending" as const,
  },
];
