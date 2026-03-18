import type { EmployeeId } from "@/lib/constants";

export interface PipelineNode {
  id: string;
  label: string;
  employeeId: EmployeeId;
  status: "completed" | "active" | "pending";
  progress: number;
  subTasks: { name: string; done: boolean }[];
  output?: string;
}

export interface HitTemplate {
  id: string;
  name: string;
  structure: string[];
  usageCount: number;
  hitRate: number;
  bestPerformance: { views: number; likes: number; shares: number };
  category: string;
  description: string;
}

export interface EDLProject {
  id: string;
  title: string;
  duration: string;
  tracks: {
    name: string;
    color: string;
    clips: { start: number; end: number; label: string }[];
  }[];
  formats: string[];
}

export interface ActivityLog {
  time: string;
  employeeId: EmployeeId;
  action: string;
}

export const pipelineNodes: PipelineNode[] = [
  {
    id: "node-1",
    label: "选题策划",
    employeeId: "xiaoce",
    status: "completed",
    progress: 100,
    subTasks: [
      { name: "热点分析", done: true },
      { name: "角度确定", done: true },
      { name: "大纲生成", done: true },
    ],
    output: "选题大纲已生成：AI手机大战深度报道（3个角度，5个章节）",
  },
  {
    id: "node-2",
    label: "资料采集",
    employeeId: "xiaozi",
    status: "completed",
    progress: 100,
    subTasks: [
      { name: "公开资料抓取", done: true },
      { name: "数据核实", done: true },
      { name: "素材入库", done: true },
    ],
    output: "已采集 23 篇参考资料、15 张高清图片、3 段视频素材",
  },
  {
    id: "node-3",
    label: "框架搭建",
    employeeId: "xiaowen",
    status: "completed",
    progress: 100,
    subTasks: [
      { name: "结构设计", done: true },
      { name: "段落分配", done: true },
      { name: "配图规划", done: true },
    ],
    output: "5 章节框架确认，总计预估 3500 字",
  },
  {
    id: "node-4",
    label: "多角度撰写",
    employeeId: "xiaowen",
    status: "active",
    progress: 65,
    subTasks: [
      { name: "技术评测角度", done: true },
      { name: "消费者体验角度", done: true },
      { name: "行业影响角度", done: false },
    ],
    output: "2/3 角度撰写完成，行业影响角度进行中",
  },
  {
    id: "node-5",
    label: "视觉制作",
    employeeId: "xiaojian",
    status: "pending",
    progress: 0,
    subTasks: [
      { name: "封面图设计", done: false },
      { name: "数据图表生成", done: false },
      { name: "视频片段剪辑", done: false },
    ],
  },
  {
    id: "node-6",
    label: "终审发布",
    employeeId: "xiaoshen",
    status: "pending",
    progress: 0,
    subTasks: [
      { name: "事实核查", done: false },
      { name: "敏感审核", done: false },
      { name: "格式校验", done: false },
    ],
  },
];

export const hitTemplates: HitTemplate[] = [
  {
    id: "tpl-1",
    name: "数据驱动深度报道",
    structure: ["数据悬念开头", "背景铺垫", "多维数据对比", "专家解读", "趋势预判"],
    usageCount: 156,
    hitRate: 34,
    bestPerformance: { views: 285000, likes: 12800, shares: 3400 },
    category: "深度报道",
    description: "以数据悬念切入，通过多维度数据对比展开分析，适用于科技、财经类深度报道",
  },
  {
    id: "tpl-2",
    name: "争议话题双面辩",
    structure: ["争议点抛出", "正方观点+论据", "反方观点+论据", "记者观察", "互动投票"],
    usageCount: 98,
    hitRate: 42,
    bestPerformance: { views: 420000, likes: 25600, shares: 8900 },
    category: "评论",
    description: "适用于具有争议性的社会话题，通过正反观点呈现引发讨论",
  },
  {
    id: "tpl-3",
    name: "人物故事线",
    structure: ["场景描写", "人物引入", "冲突展现", "转折发展", "升华收尾"],
    usageCount: 87,
    hitRate: 38,
    bestPerformance: { views: 380000, likes: 18900, shares: 5600 },
    category: "人物报道",
    description: "以叙事方式讲述人物故事，适用于典型人物报道和人物专访",
  },
  {
    id: "tpl-4",
    name: "30秒短视频速览",
    structure: ["震撼画面开场", "3个核心信息点", "数据字幕", "引导互动"],
    usageCount: 312,
    hitRate: 28,
    bestPerformance: { views: 1200000, likes: 45000, shares: 12000 },
    category: "短视频",
    description: "快节奏信息传递，适用于突发事件和数据类新闻的短视频化",
  },
  {
    id: "tpl-5",
    name: "横向测评对比",
    structure: ["评测背景", "参数对比表", "实际体验对比", "性价比分析", "推荐结论"],
    usageCount: 124,
    hitRate: 31,
    bestPerformance: { views: 320000, likes: 15600, shares: 4200 },
    category: "评测",
    description: "适用于产品横向评测，通过结构化对比帮助用户决策",
  },
  {
    id: "tpl-6",
    name: "政策解读三步法",
    structure: ["政策要点提炼", "影响分析", "行动建议"],
    usageCount: 76,
    hitRate: 25,
    bestPerformance: { views: 180000, likes: 8500, shares: 2800 },
    category: "政策解读",
    description: "精简高效的政策解读模板，突出对读者的实际影响和行动指南",
  },
];

export const edlProject: EDLProject = {
  id: "edl-1",
  title: "AI手机大战 - 完整版视频",
  duration: "05:30",
  tracks: [
    {
      name: "视频轨",
      color: "#3b82f6",
      clips: [
        { start: 0, end: 30, label: "开场动画" },
        { start: 30, end: 120, label: "华为评测" },
        { start: 120, end: 210, label: "小米评测" },
        { start: 210, end: 280, label: "OPPO评测" },
        { start: 280, end: 330, label: "对比总结" },
      ],
    },
    {
      name: "字幕轨",
      color: "#10b981",
      clips: [
        { start: 0, end: 330, label: "全程字幕" },
      ],
    },
    {
      name: "BGM轨",
      color: "#f59e0b",
      clips: [
        { start: 0, end: 30, label: "科技感BGM" },
        { start: 30, end: 280, label: "轻快背景音乐" },
        { start: 280, end: 330, label: "结尾音乐" },
      ],
    },
    {
      name: "音效轨",
      color: "#ef4444",
      clips: [
        { start: 0, end: 5, label: "开场音效" },
        { start: 29, end: 31, label: "转场" },
        { start: 119, end: 121, label: "转场" },
        { start: 209, end: 211, label: "转场" },
        { start: 279, end: 281, label: "转场" },
      ],
    },
  ],
  formats: ["PR XML", "剪映 JSON", "快编 EDL", "Edius AAF"],
};

export const activityLogs: ActivityLog[] = [
  { time: "10:32", employeeId: "xiaowen", action: "完成「消费者体验角度」章节撰写（1200字）" },
  { time: "10:15", employeeId: "xiaozi", action: "补充3张产品高清图至素材库" },
  { time: "09:58", employeeId: "xiaowen", action: "完成「技术评测角度」章节撰写（1500字）" },
  { time: "09:45", employeeId: "xiaoce", action: "调整大纲结构，新增「生态对比」子章节" },
  { time: "09:30", employeeId: "xiaozi", action: "采集到芯片跑分最新数据并核实" },
  { time: "09:15", employeeId: "xiaoce", action: "选题策划完成，确定3个写作角度" },
  { time: "09:00", employeeId: "xiaozi", action: "开始资料采集，扫描23个信息源" },
];
