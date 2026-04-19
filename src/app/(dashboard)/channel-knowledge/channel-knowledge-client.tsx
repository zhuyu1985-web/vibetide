"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  KnowledgeSource,
  KnowledgeItem,
  ChannelDNA,
  KnowledgeSyncLog,
} from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { AgentWorkCard } from "@/components/shared/agent-work-card";
import { AIScoreBadge } from "@/components/shared/ai-score-badge";
import { SearchInput } from "@/components/shared/search-input";
import { TimelineStep } from "@/components/shared/timeline-step";
import { RealTimeIndicator } from "@/components/shared/realtime-indicator";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { RadarChartCard } from "@/components/charts/radar-chart-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Database,
  Rss,
  Search,
  BookOpen,
  Dna,
  ScrollText,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  sources: {
    upload: KnowledgeSource[];
    cms: KnowledgeSource[];
    subscription: KnowledgeSource[];
    stats: { totalDocuments: number; totalChunks: number; lastSync: string };
  };
  items: KnowledgeItem[];
  dna: { dimensions: ChannelDNA[]; report: string };
  syncLogs: KnowledgeSyncLog[];
  embedded?: boolean;
}

// ---------------------------------------------------------------------------
// UI constants
// ---------------------------------------------------------------------------

const sourceStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "正常", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400", icon: <CheckCircle size={10} /> },
  syncing: { label: "同步中", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", icon: <Loader2 size={10} className="animate-spin" /> },
  error: { label: "异常", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400", icon: <AlertCircle size={10} /> },
  pending: { label: "待处理", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", icon: <Clock size={10} /> },
};

const sourceTypeBadge: Record<string, { label: string; color: string }> = {
  upload: { label: "上传", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  cms: { label: "内部", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  subscription: { label: "订阅", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
};

const logStatusConfig: Record<string, { label: string; color: string }> = {
  success: { label: "成功", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  error: { label: "失败", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  warning: { label: "警告", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
};

// Timeline data kept locally (not backed by DB yet)
const recentSyncTimeline = [
  { time: "09:00", title: "新华社要闻同步", description: "新增23条知识条目", status: "completed" as const },
  { time: "08:55", title: "央视热点同步", description: "新增12条知识条目", status: "completed" as const },
  { time: "08:30", title: "突发规范解析", description: "生成22个分片", status: "completed" as const },
  { time: "07:45", title: "受众反馈同步", description: "部分数据异常", status: "active" as const },
  { time: "06:00", title: "全量内容同步", description: "484条记录", status: "completed" as const },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ChannelKnowledgeClient({ sources, items, dna, syncLogs, embedded }: Props) {
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string | null>(null);

  const uploadSources = sources.upload;
  const cmsSources = sources.cms;
  const subscriptionSources = sources.subscription;
  const sourceStats = {
    uploadCount: uploadSources.length,
    cmsCount: cmsSources.length,
    subscriptionCount: subscriptionSources.length,
  };
  const knowledgeItems = items;
  const channelDNAData = dna.dimensions.length > 0
    ? dna.dimensions.map((d) => ({ dimension: d.dimension, current: d.score, target: Math.min(10, d.score + 1) }))
    : [
        { dimension: "时政深度", current: 8.5, target: 9.0 },
        { dimension: "民生温度", current: 7.8, target: 8.5 },
        { dimension: "数据驱动", current: 6.5, target: 8.0 },
        { dimension: "视觉表达", current: 7.2, target: 8.5 },
        { dimension: "互动参与", current: 5.8, target: 7.5 },
        { dimension: "国际视野", current: 6.0, target: 7.0 },
        { dimension: "创新叙事", current: 6.8, target: 8.0 },
        { dimension: "热点响应", current: 8.2, target: 9.0 },
      ];
  const channelDNAReport = dna.report || `基于对频道326条历史爆款内容和158份选题档案的深度分析，我们发现您的频道具有明显的**时政深度报道**和**热点快速响应**优势，这两个维度得分均在8分以上。

然而，在**互动参与**和**数据驱动**两个维度上仍有提升空间。建议增加数据可视化内容比例，并在稿件中嵌入更多互动元素（投票、问答）以提升用户粘性。

**国际视野**维度得分偏低，建议通过订阅更多国际新闻源和引入多语适配能力来补强。`;

  // Source distribution for donut chart
  const sourceDistributionData = [
    { name: "上传文档", value: uploadSources.reduce((s, k) => s + k.chunkCount, 0), color: "#3b82f6" },
    { name: "内部内容", value: cmsSources.reduce((s, k) => s + k.chunkCount, 0), color: "#10b981" },
    { name: "外部订阅", value: subscriptionSources.reduce((s, k) => s + k.chunkCount, 0), color: "#f59e0b" },
  ];

  // Filter knowledge items
  const filteredItems = knowledgeItems.filter((item) => {
    const matchesSearch =
      !knowledgeSearchQuery ||
      item.title.includes(knowledgeSearchQuery) ||
      item.snippet.includes(knowledgeSearchQuery) ||
      item.tags.some((t) => t.includes(knowledgeSearchQuery));
    const matchesType = !sourceTypeFilter || item.sourceType === sourceTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className={embedded ? "" : "max-w-[1400px] mx-auto"}>
      {/* Page Header */}
      <PageHeader
        title="频道知识库"
        description="为频道顾问注入领域知识，让AI更懂你的栏目"
        actions={
          <div className="flex items-center gap-2">
            <EmployeeAvatar employeeId="advisor" size="sm" showStatus status="working" />
            <Link
              href="/channel-advisor"
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              查看顾问
              <ExternalLink size={10} />
            </Link>
          </div>
        }
      />

      {/* KPI Comparison */}
      <KPIComparisonBar
        items={[
          { label: "知识查找", before: "2h", after: "3秒", improvement: "2400x" },
          { label: "顾问准确度", before: "70%", after: "95%", improvement: "+25%" },
          { label: "知识更新", before: "每周", after: "实时", improvement: "即时" },
          { label: "覆盖面", before: "20%", after: "98%", improvement: "+78%" },
        ]}
      />

      {/* Tabs */}
      <Tabs defaultValue="sources" className="w-full">
        <TabsList>
          <TabsTrigger value="sources">
            <Database size={14} className="mr-1" />
            知识来源
          </TabsTrigger>
          <TabsTrigger value="browse">
            <BookOpen size={14} className="mr-1" />
            知识浏览
          </TabsTrigger>
          <TabsTrigger value="dna">
            <Dna size={14} className="mr-1" />
            频道DNA
          </TabsTrigger>
          <TabsTrigger value="logs">
            <ScrollText size={14} className="mr-1" />
            同步日志
          </TabsTrigger>
        </TabsList>

        {/* ====== Tab 1: 知识来源 ====== */}
        <TabsContent value="sources">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="上传文档" value={sourceStats.uploadCount} suffix="份" icon={<Upload size={18} />} />
            <StatCard label="内部内容" value={sourceStats.cmsCount} suffix="个源" icon={<Database size={18} />} />
            <StatCard label="外部订阅" value={sourceStats.subscriptionCount} suffix="个" icon={<Rss size={18} />} />
          </div>

          <div className="grid grid-cols-12 gap-5">
            {/* Left: col-8 */}
            <div className="col-span-8 space-y-4">
              {/* Upload section */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <Upload size={14} className="text-blue-500" />
                  外部知识灌入
                </h4>

                {/* Drop zone */}
                <div className="border-2 border-dashed border-blue-200 dark:border-blue-700/50 rounded-xl p-6 text-center mb-4 bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer">
                  <Upload size={24} className="text-blue-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">拖拽文件到此处，或点击上传</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">支持 PDF、DOCX、TXT、MD 格式</p>
                </div>

                {/* Uploaded docs */}
                <div className="space-y-2">
                  {uploadSources.map((src) => {
                    const st = sourceStatusConfig[src.status];
                    return (
                      <div
                        key={src.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                      >
                        <FileText size={16} className="text-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-800 dark:text-gray-100 block truncate">{src.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] py-0">{src.format}</Badge>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{src.sizeDisplay}</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{src.chunkCount}个分片</span>
                          </div>
                        </div>
                        <Badge className={`text-[9px] ${st.color}`}>
                          {st.icon}
                          <span className="ml-0.5">{st.label}</span>
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

              {/* CMS section */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <Database size={14} className="text-green-500" />
                  内部知识梳理
                </h4>
                <div className="space-y-2.5">
                  {cmsSources.map((src) => {
                    const st = sourceStatusConfig[src.status];
                    const syncProgress = src.status === "syncing" ? 68 : 100;
                    return (
                      <div
                        key={src.id}
                        className="px-3 py-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{src.name}</span>
                          <Badge className={`text-[9px] ${st.color}`}>
                            {st.icon}
                            <span className="ml-0.5">{st.label}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-1.5">
                          <span>{src.documentCount}条文档</span>
                          <span>{src.chunkCount}个分片</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={syncProgress} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{syncProgress}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

              {/* Subscription section */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <Rss size={14} className="text-amber-500" />
                  外部订阅
                </h4>
                <div className="space-y-2">
                  {subscriptionSources.map((src) => {
                    const st = sourceStatusConfig[src.status];
                    return (
                      <div
                        key={src.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                      >
                        <Rss size={14} className="text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-800 dark:text-gray-100 block">{src.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] py-0">{src.format}</Badge>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{src.documentCount}条</span>
                            <span className="text-[10px] text-gray-400">
                              最后同步: {new Date(src.lastSyncAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                        <Badge className={`text-[9px] ${st.color}`}>
                          {st.icon}
                          <span className="ml-0.5">{st.label}</span>
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            {/* Right: col-4 */}
            <div className="col-span-4 space-y-4">
              {/* Donut chart */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">来源分布</h4>
                <DonutChartCard data={sourceDistributionData} height={180} innerRadius={40} outerRadius={70} />
                <div className="flex flex-col gap-1 mt-2">
                  {sourceDistributionData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{d.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400">{d.value.toLocaleString()} 分片</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Agent work card */}
              <AgentWorkCard
                task={{
                  employeeId: "advisor",
                  taskName: "知识库同步与索引",
                  progress: 85,
                  status: "working",
                  detail: "正在向量化新增知识条目...",
                }}
              />

              {/* Recent sync timeline */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">最近同步</h4>
                <TimelineStep items={recentSyncTimeline} />
              </GlassCard>
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 2: 知识浏览 ====== */}
        <TabsContent value="browse">
          {/* Search + Filter */}
          <div className="flex items-center gap-3 mb-5">
            <SearchInput
              className="flex-1"
              value={knowledgeSearchQuery}
              onChange={(e) => setKnowledgeSearchQuery(e.target.value)}
              placeholder="搜索知识库..."
            />
            <div className="flex items-center gap-1.5">
              {[
                { key: null, label: "全部" },
                { key: "upload", label: "上传" },
                { key: "cms", label: "内部" },
                { key: "subscription", label: "订阅" },
              ].map((f) => (
                <button
                  key={f.key ?? "all"}
                  onClick={() => setSourceTypeFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    sourceTypeFilter === f.key
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Knowledge items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const typeBadge = sourceTypeBadge[item.sourceType];
              return (
                <GlassCard key={item.id} variant="interactive">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1 mr-2">{item.title}</h4>
                    <AIScoreBadge score={item.relevanceScore} size={36} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`text-[9px] ${typeBadge.color}`}>{typeBadge.label}</Badge>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{item.source}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 mb-2">{item.snippet}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </TabsContent>

        {/* ====== Tab 3: 频道DNA ====== */}
        <TabsContent value="dna">
          <div className="grid grid-cols-12 gap-5">
            {/* Left: Radar chart */}
            <div className="col-span-7">
              <RadarChartCard
                title="频道内容DNA"
                data={channelDNAData}
                series={[
                  { dataKey: "current", name: "当前水平", color: "#3b82f6" },
                  { dataKey: "target", name: "目标水平", color: "#f59e0b", fillOpacity: 0.1 },
                ]}
                height={360}
              />
            </div>

            {/* Right: DNA report + pipeline */}
            <div className="col-span-5 space-y-4">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <Dna size={14} className="text-purple-500" />
                  DNA分析报告
                </h4>
                <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                  {channelDNAReport}
                </div>
              </GlassCard>

              <GlassCard variant="blue">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">知识 → 顾问</h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white/60 dark:bg-gray-900/60 border border-blue-100 dark:border-blue-800/30 text-center">
                    <Database size={16} className="text-blue-500 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">知识库</p>
                  </div>
                  <ArrowRight size={16} className="text-blue-400 shrink-0" />
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white/60 dark:bg-gray-900/60 border border-blue-100 dark:border-blue-800/30 text-center">
                    <Dna size={16} className="text-purple-500 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">向量化</p>
                  </div>
                  <ArrowRight size={16} className="text-blue-400 shrink-0" />
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white/60 dark:bg-gray-900/60 border border-blue-100 dark:border-blue-800/30 text-center">
                    <EmployeeAvatar employeeId="advisor" size="xs" />
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-1">频道顾问</p>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <Link
                    href="/channel-advisor"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    前往频道顾问
                    <ExternalLink size={10} />
                  </Link>
                </div>
              </GlassCard>
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 4: 同步日志 ====== */}
        <TabsContent value="logs">
          <div className="flex items-center gap-3 mb-5">
            <RealTimeIndicator label="知识源" count={10} />
          </div>

          <GlassCard>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">同步日志</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">时间</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">操作</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">状态</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => {
                    const cfg = logStatusConfig[log.status];
                    return (
                      <tr key={log.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors">
                        <td className="py-2.5 px-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-medium text-gray-800 dark:text-gray-100">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400">
                          {log.detail}
                        </td>
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
