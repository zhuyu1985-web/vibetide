"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  ReviveRecommendation,
  HotTopicMatch,
  ReviveMetrics,
  ReviveRecord,
  TrendDataPoint,
  ScenarioDistribution,
  StyleVariant,
  InternationalAdaptation,
} from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { AgentWorkCard } from "@/components/shared/agent-work-card";
import { AIScoreBadge } from "@/components/shared/ai-score-badge";
import { HeatScoreBadge } from "@/components/shared/heat-score-badge";
import { TimelineStep } from "@/components/shared/timeline-step";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles,
  Flame,
  Palette,
  Globe,
  BarChart3,
  Calendar,
  CheckCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Zap,
  Target,
  Users,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  recommendations: ReviveRecommendation[];
  hotMatches: HotTopicMatch[];
  metrics: ReviveMetrics;
  records: ReviveRecord[];
  trend: TrendDataPoint[];
  scenarioDist: ScenarioDistribution[];
}

// ---------------------------------------------------------------------------
// UI constants (kept locally)
// ---------------------------------------------------------------------------

const scenarioBadge: Record<string, { label: string; color: string }> = {
  topic_match: { label: "跟选题", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  hot_match: { label: "蹭热点", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  daily_push: { label: "自推荐", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  intl_broadcast: { label: "国际传播", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
  style_adapt: { label: "风格适配", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
};

const recordStatusConfig: Record<string, { label: string; color: string }> = {
  adopted: { label: "已采用", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  pending: { label: "待处理", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
  rejected: { label: "已跳过", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
};

// Mock data kept locally (not yet backed by DB)
const dailySummary = {
  date: "2026年3月1日",
  totalCount: 6,
  adoptionRate: 78,
};

const matchSuccessData = [
  { name: "2/23", value: 65 },
  { name: "2/24", value: 72 },
  { name: "2/25", value: 68 },
  { name: "2/26", value: 80 },
  { name: "2/27", value: 75 },
  { name: "2/28", value: 85 },
  { name: "3/1", value: 82 },
];

const matchTimeline = [
  { time: "09:00", title: "养老金话题匹配", description: "命中2条历史资产", status: "completed" as const },
  { time: "08:30", title: "DeepSeek匹配", description: "命中1条科技素材", status: "completed" as const },
  { time: "08:00", title: "长江保护法匹配", description: "命中1条纪录片", status: "completed" as const },
  { time: "07:30", title: "元宵节匹配", description: "命中2条节日素材", status: "active" as const },
  { time: "07:00", title: "每日扫描启动", description: "扫描热点池与资产库", status: "completed" as const },
];

const styleSourceContent = {
  title: "养老金并轨改革深度解读",
  originalExcerpt: "从2024年10月起，机关事业单位与企业职工的养老保险制度正式并轨。人社部相关负责人介绍，新的计发办法将基础养老金与个人账户养老金相结合，确保退休人员待遇平稳过渡。",
};

const styleVariants: StyleVariant[] = [
  {
    style: "joyful",
    styleLabel: "愉悦风格",
    title: "好消息！养老金「双轨」变「单轨」，退休工资怎么算？一文看懂！",
    excerpt: "说一个让退休人员开心的好消息！从去年10月开始，不管你是公务员还是企业员工，养老金都按同一套规则算啦！简单来说就是——更公平、更透明，大家的养老钱都有保障！",
    tone: "轻松活泼，使用口语化表达，多用感叹号和互动式提问，适合短视频和社交媒体传播",
  },
  {
    style: "serious",
    styleLabel: "严肃风格",
    title: "制度并轨：中国养老保障体系改革的里程碑",
    excerpt: "2024年10月，历经十年过渡期的机关事业单位养老保险制度改革正式完成并轨。这一制度性变革消除了长期存在的「双轨制」差异，标志着我国社会保障制度向更加公平、可持续的方向迈出关键一步。",
    tone: "正式严谨，使用书面语和专业术语，注重数据引用和逻辑论证，适合深度报道和评论",
  },
  {
    style: "dramatic",
    styleLabel: "跌宕风格",
    title: "十年博弈终落幕！养老金「双轨制」如何走向大一统？",
    excerpt: "这是一场持续十年的制度变革。2014年，一纸文件打破了沿用数十年的「铁饭碗」规则；2024年，过渡期悄然结束，新旧制度的角力终于尘埃落定。然而，这真的意味着「公平」已经到来吗？",
    tone: "戏剧悬念，使用对比和转折手法，设置悬念和反问，适合深度专题和纪录片解说",
  },
];

const internationalSource = {
  title: "中国春节：从传统年俗到世界文化遗产",
  excerpt: "2024年12月，中国春节正式列入联合国教科文组织人类非物质文化遗产代表作名录。这个有着4000多年历史的节日，从贴春联、放鞭炮、吃年夜饭，到如今的全球同庆，见证了中华文化的传承与创新。",
};

const internationalAdaptations: InternationalAdaptation[] = [
  {
    language: "泰语",
    languageCode: "th",
    flag: "🇹🇭",
    title: "ตรุษจีน: จากประเพณีสู่มรดกโลก",
    excerpt: "เทศกาลตรุษจีนได้รับการขึ้นทะเบียนเป็นมรดกวัฒนธรรมที่จับต้องไม่ได้ของมนุษยชาติ ชาวไทยเชื้อสายจีนร่วมเฉลิมฉลองกับคนทั่วโลก...",
    adaptationNotes: "融入泰国华人社区庆祝元素，增加曼谷唐人街活动描述，调整为泰国读者熟悉的文化参照",
    status: "completed",
  },
  {
    language: "越南语",
    languageCode: "vi",
    flag: "🇻🇳",
    title: "Tết Nguyên Đán Trung Quốc: Từ truyền thống đến di sản thế giới",
    excerpt: "Tết Nguyên Đán Trung Quốc đã được UNESCO công nhận là di sản văn hóa phi vật thể. Với lịch sử hơn 4000 năm, lễ hội này đã trở thành sự kiện văn hóa toàn cầu...",
    adaptationNotes: "注意越南也有传统春节（Tết），需要区分说明，增加中越文化交流的正面叙事",
    status: "completed",
  },
  {
    language: "马来语",
    languageCode: "ms",
    flag: "🇲🇾",
    title: "Tahun Baru Cina: Dari Tradisi ke Warisan Dunia",
    excerpt: "Perayaan Tahun Baru Cina telah diiktiraf oleh UNESCO sebagai warisan budaya tidak ketara. Di Malaysia, perayaan ini disambut meriah oleh masyarakat Cina tempatan bersama rakyat pelbagai kaum...",
    adaptationNotes: "突出马来西亚多元文化共庆特色，增加当地华人新年传统（捞鱼生等），体现民族和谐",
    status: "in_progress",
  },
  {
    language: "印尼语",
    languageCode: "id",
    flag: "🇮🇩",
    title: "Imlek: Dari Tradisi Tiongkok hingga Warisan Dunia",
    excerpt: "Perayaan Imlek telah diakui UNESCO sebagai warisan budaya tak benda. Di Indonesia, Imlek menjadi hari libur nasional sejak tahun 2003 dan dirayakan secara meriah oleh masyarakat Tionghoa Indonesia...",
    adaptationNotes: "使用印尼对春节的本地称呼「Imlek」，提及2003年成为国家假日的历史背景，强调印尼华人文化贡献",
    status: "pending",
  },
];

const languageDistributionData = [
  { name: "泰语", value: 35, color: "#3b82f6" },
  { name: "越南语", value: 28, color: "#10b981" },
  { name: "马来语", value: 22, color: "#f59e0b" },
  { name: "印尼语", value: 15, color: "#8b5cf6" },
];

const internationalStats = {
  totalAdaptations: 42,
  languagesCovered: 4,
  avgProcessingTime: "12min",
};

const culturalAdaptPoints = [
  "尊重当地称呼习惯（如印尼用Imlek）",
  "融入本地华人社区文化元素",
  "避免文化敏感表述和政治隐喻",
  "增加目标国家与中国的文化纽带",
  "保持核心信息一致，本地化表达形式",
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AssetReviveClient({
  recommendations,
  hotMatches,
  metrics,
  records,
  trend,
  scenarioDist,
}: Props) {
  const dailyRecommendations = recommendations;
  const hotTopicMatches = hotMatches;
  const reviveMetrics = metrics;
  const reviveRecords = records;
  const reuseTrendData = trend.length > 0 ? trend.map((t) => ({ date: t.date, value: t.value })) : [
    { date: "2/23", value: 8 },
    { date: "2/24", value: 12 },
    { date: "2/25", value: 10 },
    { date: "2/26", value: 15 },
    { date: "2/27", value: 13 },
    { date: "2/28", value: 18 },
    { date: "3/1", value: 15 },
  ];
  const scenarioDistributionData: Record<string, unknown>[] = scenarioDist.length > 0
    ? scenarioDist.map((s) => ({ name: s.name, value: s.value }))
    : [
        { name: "跟选题", value: 35 },
        { name: "蹭热点", value: 28 },
        { name: "自推荐", value: 20 },
        { name: "国际传播", value: 12 },
        { name: "风格适配", value: 5 },
      ];

  const [recommendationStatuses, setRecommendationStatuses] = useState<
    Record<string, "adopted" | "rejected">
  >({});
  const [selectedHotTopic, setSelectedHotTopic] = useState<string | null>(null);

  const handleAdopt = (id: string) => {
    setRecommendationStatuses((prev) => ({ ...prev, [id]: "adopted" }));
  };

  const handleReject = (id: string) => {
    setRecommendationStatuses((prev) => ({ ...prev, [id]: "rejected" }));
  };

  // International adaptation status config
  const adaptStatusConfig: Record<string, { label: string; color: string }> = {
    completed: { label: "已完成", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
    in_progress: { label: "适配中", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
    pending: { label: "待处理", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Page Header */}
      <PageHeader
        title="资产盘活中心"
        description="让沉睡的优质资产焕发新生"
        actions={
          <div className="flex items-center gap-2">
            <EmployeeAvatar employeeId="xiaozi" size="sm" showStatus status="working" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小资 每日推荐已就绪</span>
          </div>
        }
      />

      {/* KPI Comparison */}
      <KPIComparisonBar
        items={[
          { label: "资产利用率", before: "15%", after: "68%", improvement: "+53%" },
          { label: "热点响应", before: "2h", after: "5min", improvement: "24x" },
          { label: "二创量", before: "3条/周", after: "15条/天", improvement: "35x" },
          { label: "国际覆盖", before: "1语种", after: "4语种", improvement: "4x" },
        ]}
      />

      {/* Top-level stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard label="复用率" value={`${reviveMetrics.reuseRate}%`} change={reviveMetrics.reuseRateChange} icon={<RefreshCw size={18} />} />
        <StatCard label="采纳率" value={`${reviveMetrics.adoptionRate}%`} change={reviveMetrics.adoptionRateChange} icon={<ThumbsUp size={18} />} />
        <StatCard label="二创数" value={reviveMetrics.secondaryCreationCount} suffix="条/天" change={reviveMetrics.secondaryCreationCountChange} icon={<FileText size={18} />} />
        <StatCard label="传播倍率" value={`${reviveMetrics.reachMultiplier}x`} change={reviveMetrics.reachMultiplierChange} icon={<TrendingUp size={18} />} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="daily" className="w-full">
        <TabsList>
          <TabsTrigger value="daily">
            <Sparkles size={14} className="mr-1" />
            每日推荐
          </TabsTrigger>
          <TabsTrigger value="hotmatch">
            <Flame size={14} className="mr-1" />
            热点匹配
          </TabsTrigger>
          <TabsTrigger value="style">
            <Palette size={14} className="mr-1" />
            风格适配
          </TabsTrigger>
          <TabsTrigger value="international">
            <Globe size={14} className="mr-1" />
            国际传播
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            <BarChart3 size={14} className="mr-1" />
            盘活看板
          </TabsTrigger>
        </TabsList>

        {/* ====== Tab 1: 每日推荐 ====== */}
        <TabsContent value="daily">
          {/* Summary card */}
          <GlassCard variant="blue" className="mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles size={20} className="text-blue-500" />
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">今日资产盘活推荐</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {dailySummary.date} · 共{dailyRecommendations.length || dailySummary.totalCount}条推荐 · 历史采纳率 {dailySummary.adoptionRate}%
                  </p>
                </div>
              </div>
              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs">
                <Calendar size={12} className="mr-1" />
                每日更新
              </Badge>
            </div>
          </GlassCard>

          {/* Recommendation grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyRecommendations.map((rec) => {
              const scenario = scenarioBadge[rec.scenario];
              const currentStatus = recommendationStatuses[rec.id];
              return (
                <GlassCard key={rec.id} variant="interactive">
                  <AnimatePresence mode="wait">
                    {currentStatus ? (
                      <motion.div
                        key="status"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-6"
                      >
                        {currentStatus === "adopted" ? (
                          <>
                            <CheckCircle size={32} className="text-green-500 mb-2" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">已采用</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">{rec.originalAsset}</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={32} className="text-gray-400 mb-2" />
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">已跳过</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">{rec.originalAsset}</span>
                          </>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div key="card" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                        {/* Thumbnail placeholder */}
                        <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 flex items-center justify-center">
                          <FileText size={24} className="text-gray-300" />
                        </div>

                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 mr-2">
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">{rec.originalAsset}</h4>
                            <Badge className={`text-[9px] ${scenario.color}`}>{scenario.label}</Badge>
                          </div>
                          <AIScoreBadge score={rec.matchScore} size={40} label="匹配" />
                        </div>

                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-start gap-1.5">
                            <Target size={11} className="text-blue-400 mt-0.5 shrink-0" />
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              <span className="font-medium text-gray-700 dark:text-gray-300">匹配话题: </span>{rec.matchedTopic}
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <AlertCircle size={11} className="text-amber-400 mt-0.5 shrink-0" />
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              <span className="font-medium text-gray-700 dark:text-gray-300">推荐理由: </span>{rec.reason}
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Zap size={11} className="text-green-400 mt-0.5 shrink-0" />
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              <span className="font-medium text-gray-700 dark:text-gray-300">建议动作: </span>{rec.suggestedAction}
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Users size={11} className="text-purple-400 mt-0.5 shrink-0" />
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              <span className="font-medium text-gray-700 dark:text-gray-300">预估覆盖: </span>{rec.estimatedReach}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-xs bg-blue-500 hover:bg-blue-600"
                            onClick={() => handleAdopt(rec.id)}
                          >
                            <ThumbsUp size={12} className="mr-1" />
                            采用
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleReject(rec.id)}
                          >
                            <ThumbsDown size={12} className="mr-1" />
                            不适合
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              );
            })}
          </div>
        </TabsContent>

        {/* ====== Tab 2: 热点匹配 ====== */}
        <TabsContent value="hotmatch">
          <div className="grid grid-cols-12 gap-5">
            {/* Left: col-7 */}
            <div className="col-span-7 space-y-3">
              {hotTopicMatches.map((match, i) => {
                const isSelected = selectedHotTopic === match.hotTopic;
                return (
                  <GlassCard
                    key={i}
                    variant={isSelected ? "blue" : "default"}
                    className="cursor-pointer"
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => setSelectedHotTopic(isSelected ? null : match.hotTopic)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Flame size={14} className="text-red-500" />
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{match.hotTopic}</span>
                        </div>
                        <HeatScoreBadge score={match.heatScore} />
                      </div>

                      <div className="space-y-2">
                        {match.matchedAssets.map((asset, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/60 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700/50"
                          >
                            <ArrowRight size={12} className="text-blue-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-gray-800 dark:text-gray-100 block">{asset.assetTitle}</span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">{asset.suggestedAngle}</span>
                            </div>
                            <AIScoreBadge score={asset.matchScore} size={32} />
                          </div>
                        ))}
                      </div>
                    </button>
                  </GlassCard>
                );
              })}
            </div>

            {/* Right: col-5 */}
            <div className="col-span-5 space-y-4">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">近7天匹配成功率</h4>
                <BarChartCard data={matchSuccessData} dataKey="value" xKey="name" color="#3b82f6" height={180} />
              </GlassCard>

              <AgentWorkCard
                task={{
                  employeeId: "xiaozi",
                  taskName: "热点-资产匹配引擎",
                  progress: 92,
                  status: "working",
                  detail: "正在扫描最新热点与历史资产库...",
                }}
              />

              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">匹配活动</h4>
                <TimelineStep items={matchTimeline} />
              </GlassCard>
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 3: 风格适配 ====== */}
        <TabsContent value="style">
          <div className="mb-5">
            <GlassCard variant="blue" className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={16} className="text-blue-500" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">同一内容，三种风格</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">原文: {styleSourceContent.title}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{styleSourceContent.originalExcerpt}</p>
            </GlassCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {styleVariants.map((variant) => {
                const colorMap: Record<string, { badge: string; border: string; bg: string }> = {
                  joyful: { badge: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400", border: "border-green-200", bg: "bg-green-50/30" },
                  serious: { badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-700/50", bg: "bg-blue-50/30" },
                  dramatic: { badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", border: "border-amber-200", bg: "bg-amber-50/30" },
                };
                const colors = colorMap[variant.style] || colorMap.serious;
                return (
                  <GlassCard key={variant.style} className={`border ${colors.border} ${colors.bg}`}>
                    <Badge className={`text-[10px] mb-3 ${colors.badge}`}>{variant.styleLabel}</Badge>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2 leading-snug">{variant.title}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{variant.excerpt}</p>
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">语气特点:</span>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{variant.tone}</p>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 4: 国际传播 ====== */}
        <TabsContent value="international">
          <div className="grid grid-cols-12 gap-5">
            {/* Left: col-8 */}
            <div className="col-span-8 space-y-4">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <Globe size={14} className="text-blue-500" />
                  东南亚多语适配
                </h4>

                {/* Chinese original */}
                <GlassCard variant="blue" className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">🇨🇳</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">中文原文</span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">{internationalSource.title}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{internationalSource.excerpt}</p>
                </GlassCard>

                {/* Adaptation grid */}
                <div className="grid grid-cols-2 gap-3">
                  {internationalAdaptations.map((adapt) => {
                    const st = adaptStatusConfig[adapt.status];
                    return (
                      <div
                        key={adapt.languageCode}
                        className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg">{adapt.flag}</span>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{adapt.language}</span>
                          </div>
                          <Badge className={`text-[9px] ${st.color}`}>{st.label}</Badge>
                        </div>
                        <h5 className="text-xs font-bold text-gray-800 dark:text-gray-100 mb-1 leading-snug">{adapt.title}</h5>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 mb-2">
                          {adapt.excerpt}
                        </p>
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                          <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">文化调整:</span>
                          <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{adapt.adaptationNotes}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            {/* Right: col-4 */}
            <div className="col-span-4 space-y-4">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">语种分布</h4>
                <DonutChartCard data={languageDistributionData} height={180} innerRadius={40} outerRadius={70} />
                <div className="flex flex-col gap-1 mt-2">
                  {languageDistributionData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{d.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400">{d.value}%</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <div className="space-y-3">
                <StatCard label="适配总数" value={internationalStats.totalAdaptations} suffix="条" icon={<Globe size={18} />} />
                <StatCard label="覆盖语种" value={internationalStats.languagesCovered} suffix="种" icon={<Globe size={18} />} />
                <StatCard label="平均耗时" value={internationalStats.avgProcessingTime} icon={<RefreshCw size={18} />} />
              </div>

              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">文化适配要点</h4>
                <ul className="space-y-1.5">
                  {culturalAdaptPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] text-gray-600 dark:text-gray-400">
                      <CheckCircle size={10} className="text-green-500 shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 5: 盘活看板 ====== */}
        <TabsContent value="dashboard">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <StatCard label="复用率" value={`${reviveMetrics.reuseRate}%`} change={reviveMetrics.reuseRateChange} icon={<RefreshCw size={18} />} />
            <StatCard label="采纳率" value={`${reviveMetrics.adoptionRate}%`} change={reviveMetrics.adoptionRateChange} icon={<ThumbsUp size={18} />} />
            <StatCard label="二创数" value={reviveMetrics.secondaryCreationCount} suffix="条/天" change={reviveMetrics.secondaryCreationCountChange} icon={<FileText size={18} />} />
            <StatCard label="传播倍率" value={`${reviveMetrics.reachMultiplier}x`} change={reviveMetrics.reachMultiplierChange} icon={<TrendingUp size={18} />} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-12 gap-5 mb-5">
            <div className="col-span-7">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">资产复用趋势 (7天)</h4>
                <AreaChartCard data={reuseTrendData} dataKey="value" xKey="date" color="#3b82f6" height={220} />
              </GlassCard>
            </div>
            <div className="col-span-5">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">场景分布</h4>
                <BarChartCard data={scenarioDistributionData} dataKey="value" xKey="name" color="#8b5cf6" height={220} />
              </GlassCard>
            </div>
          </div>

          {/* Records table */}
          <GlassCard>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">盘活记录</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">资产名称</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">场景</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">匹配分</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">状态</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">日期</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">覆盖量</th>
                  </tr>
                </thead>
                <tbody>
                  {reviveRecords.map((record) => {
                    const scenario = scenarioBadge[record.scenario];
                    const st = recordStatusConfig[record.status];
                    return (
                      <tr key={record.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors">
                        <td className="py-2.5 px-3 text-xs font-medium text-gray-800 dark:text-gray-100">{record.asset}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge className={`text-[10px] ${scenario.color}`}>{scenario.label}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <AIScoreBadge score={record.matchScore} size={28} />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-gray-500 dark:text-gray-400">{record.date}</td>
                        <td className="py-2.5 px-3 text-center text-xs font-mono text-gray-600 dark:text-gray-400">{record.reach}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
