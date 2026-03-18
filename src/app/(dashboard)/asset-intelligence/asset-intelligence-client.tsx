"use client";

import { useState } from "react";
import type {
  IntelligentAsset,
  ProcessingQueueItem,
  QueueStats,
  TagDistributionItem,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  AssetTagCategory,
} from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { AgentWorkCard } from "@/components/shared/agent-work-card";
import { AIScoreBadge } from "@/components/shared/ai-score-badge";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { GaugeChart } from "@/components/charts/gauge-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Search,
  Layers,
  Tag,
  GitBranch,
  ListChecks,
  Mic,
  ScanEye,
  Brain,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  XCircle,
  MessageSquare,
  Settings,
} from "lucide-react";
import AssetChat from "./asset-chat";
import TagConfig from "./tag-config";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TagSchemaItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  options: { value: string; label: string }[] | null;
  isCustom: boolean | null;
  isActive: boolean | null;
  sortOrder: number | null;
}

interface DefaultTagSchema {
  name: string;
  category: string;
  description: string;
  options: { value: string; label: string }[];
}

interface TagCategorySummaryItem {
  category: string;
  count: number;
  examples: string[];
}

interface AssetTagListItem {
  id: string;
  title: string;
  tagCount: number;
  mainCategory: string;
  status: "queued" | "processing" | "completed" | "failed";
}

interface Props {
  asset: IntelligentAsset | null;
  queue: ProcessingQueueItem[];
  queueStats: QueueStats;
  tagDistribution: TagDistributionItem[];
  knowledgeGraph: { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] };
  customTagSchemas: TagSchemaItem[];
  defaultTagSchemas: DefaultTagSchema[];
  tagCategorySummary: TagCategorySummaryItem[];
  assetTagList: AssetTagListItem[];
}

// ---------------------------------------------------------------------------
// UI constants (kept locally — not from DB)
// ---------------------------------------------------------------------------

const tagCategoryMeta: Record<
  AssetTagCategory,
  { label: string; color: string; bgColor: string }
> = {
  topic: { label: "主题", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  event: { label: "事件", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  emotion: { label: "情感", color: "text-pink-700 dark:text-pink-400", bgColor: "bg-pink-100 dark:bg-pink-950/50" },
  person: { label: "人物", color: "text-indigo-700 dark:text-indigo-400", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  location: { label: "地点", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30" },
  shotType: { label: "镜头", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  quality: { label: "画质", color: "text-teal-700 dark:text-teal-400", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  object: { label: "物体", color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  action: { label: "动作", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  queued: { label: "排队中", color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400", icon: <Clock size={10} /> },
  processing: { label: "处理中", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", icon: <Loader2 size={10} className="animate-spin" /> },
  completed: { label: "已完成", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400", icon: <CheckCircle size={10} /> },
  failed: { label: "失败", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400", icon: <XCircle size={10} /> },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  video: { label: "视频", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  audio: { label: "音频", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
  image: { label: "图片", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  document: { label: "文档", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
};

const nodeTypeColor: Record<string, { bg: string; border: string; text: string }> = {
  topic: { bg: "bg-blue-50 dark:bg-blue-950/50", border: "border-blue-300", text: "text-blue-700 dark:text-blue-400" },
  person: { bg: "bg-indigo-50 dark:bg-indigo-950/50", border: "border-indigo-300", text: "text-indigo-700 dark:text-indigo-400" },
  event: { bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-300", text: "text-amber-700 dark:text-amber-400" },
  location: { bg: "bg-green-50 dark:bg-green-950/50", border: "border-green-300", text: "text-green-700 dark:text-green-400" },
  organization: { bg: "bg-purple-50 dark:bg-purple-950/50", border: "border-purple-300", text: "text-purple-700 dark:text-purple-400" },
};


// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AssetIntelligenceClient({
  asset,
  queue,
  queueStats,
  tagDistribution,
  knowledgeGraph,
  customTagSchemas,
  defaultTagSchemas,
  tagCategorySummary,
  assetTagList,
}: Props) {
  const sampleAsset = asset;
  const graphNodes = knowledgeGraph.nodes;
  const graphEdges = knowledgeGraph.edges;
  const processingQueue = queue;
  const tagDistributionData = tagDistribution;

  const [selectedSegmentId, setSelectedSegmentId] = useState(sampleAsset?.segments[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagCategory, setSelectedTagCategory] = useState<string | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<string | null>(null);

  const selectedSegment = sampleAsset?.segments.find((s) => s.id === selectedSegmentId);

  // Segment timeline colors
  const segmentColors = ["bg-blue-400", "bg-amber-400", "bg-green-400", "bg-purple-400", "bg-red-400"];

  // Filter graph edges for selected node
  const highlightedEdges = selectedGraphNode
    ? graphEdges.filter((e) => e.source === selectedGraphNode || e.target === selectedGraphNode)
    : [];
  const highlightedNodeIds = selectedGraphNode
    ? new Set([selectedGraphNode, ...highlightedEdges.map((e) => e.source), ...highlightedEdges.map((e) => e.target)])
    : null;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Page Header */}
      <PageHeader
        title="媒资智能理解"
        description="AI自动理解、标注、关联你的每一件媒体资产"
        actions={
          <div className="flex items-center gap-2">
            <EmployeeAvatar employeeId="xiaozi" size="sm" showStatus status="working" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小资 智能分析中</span>
          </div>
        }
      />

      {/* KPI Comparison */}
      <KPIComparisonBar
        items={[
          { label: "标注耗时", before: "30min", after: "3秒", improvement: "600x" },
          { label: "标注维度", before: "5种", after: "100+", improvement: "20x" },
          { label: "关联发现", before: "手动", after: "自动", improvement: "AI" },
          { label: "搜索精度", before: "60%", after: "95%", improvement: "+35%" },
        ]}
      />

      {/* Tabs */}
      <Tabs defaultValue="understand" className="w-full">
        <TabsList>
          <TabsTrigger value="understand">
            <Layers size={14} className="mr-1" />
            自动理解
          </TabsTrigger>
          <TabsTrigger value="tagging">
            <Tag size={14} className="mr-1" />
            自动标注
          </TabsTrigger>
          <TabsTrigger value="graph">
            <GitBranch size={14} className="mr-1" />
            自动关联
          </TabsTrigger>
          <TabsTrigger value="queue">
            <ListChecks size={14} className="mr-1" />
            处理队列
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare size={14} className="mr-1" />
            对话检索
          </TabsTrigger>
          <TabsTrigger value="tagConfig">
            <Settings size={14} className="mr-1" />
            标注配置
          </TabsTrigger>
        </TabsList>

        {/* ====== Tab 1: 自动理解 ====== */}
        <TabsContent value="understand">
          <div className="grid grid-cols-12 gap-5">
            {/* Left: col-8 */}
            <div className="col-span-8 space-y-4">
              <GlassCard>
                {sampleAsset && selectedSegment ? (
                  <>
                    {/* Video placeholder */}
                    <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center mb-4">
                      <div className="text-center">
                        <Play size={48} className="text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">{sampleAsset.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{sampleAsset.duration} · {sampleAsset.fileSize}</p>
                      </div>
                    </div>

                    {/* Timeline bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">时间轴分析</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{sampleAsset.segments.length} 个段落</span>
                      </div>
                      <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
                        {sampleAsset.segments.map((seg, i) => (
                          <button
                            key={seg.id}
                            onClick={() => setSelectedSegmentId(seg.id)}
                            className={`flex-1 relative transition-all ${segmentColors[i % segmentColors.length]} ${
                              selectedSegmentId === seg.id
                                ? "ring-2 ring-blue-500 ring-offset-1 scale-y-110"
                                : "opacity-70 hover:opacity-100"
                            }`}
                          >
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-white/90">
                              {seg.startTime}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selected segment detail */}
                    <div className="space-y-3 p-4 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">
                          {selectedSegment.startTime} - {selectedSegment.endTime}
                        </Badge>
                        <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px]">
                          {selectedSegment.sceneType}
                        </Badge>
                      </div>

                      {/* ASR */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Mic size={12} className="text-blue-500" />
                          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">ASR 转写</span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed pl-4 border-l-2 border-blue-200 dark:border-blue-700/50">
                          {selectedSegment.transcript}
                        </p>
                      </div>

                      {/* OCR */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <ScanEye size={12} className="text-green-500" />
                          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">OCR 提取</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-4">
                          {selectedSegment.ocrTexts.map((text, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] bg-green-50 dark:bg-green-950/50">
                              {text}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* NLU */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Brain size={12} className="text-purple-500" />
                          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">NLU 摘要</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 pl-4 border-l-2 border-purple-200 dark:border-purple-700/50">
                          {selectedSegment.nluSummary}
                        </p>
                      </div>

                      {/* Detected faces */}
                      {selectedSegment.detectedFaces.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <User size={12} className="text-indigo-500" />
                            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">检测人物</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pl-4">
                            {selectedSegment.detectedFaces.map((face) => (
                              <div
                                key={face.id}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/30"
                              >
                                <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center text-[9px] font-bold text-indigo-700 dark:text-indigo-400">
                                  {face.name.charAt(0)}
                                </div>
                                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium">{face.name}</span>
                                <span className="text-[9px] text-indigo-400 dark:text-indigo-500">{face.role}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-20 text-sm text-gray-400 dark:text-gray-500">
                    暂无已完成分析的资产
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Right: col-4 */}
            <div className="col-span-4 space-y-4">
              {/* AI capabilities */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">AI理解能力</h4>
                <div className="space-y-2.5">
                  {[
                    { icon: <Mic size={14} />, label: "ASR 语音转写", status: "active", color: "text-blue-500" },
                    { icon: <ScanEye size={14} />, label: "OCR 文字提取", status: "active", color: "text-green-500" },
                    { icon: <Brain size={14} />, label: "NLU 语义理解", status: "active", color: "text-purple-500" },
                  ].map((cap, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50/70 dark:bg-gray-800/30">
                      <span className={cap.color}>{cap.icon}</span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">{cap.label}</span>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Detected people */}
              {sampleAsset && (
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <User size={14} className="text-indigo-500" />
                    检测到的人物
                  </h4>
                  <div className="space-y-2.5">
                    {sampleAsset.segments
                      .flatMap((s) => s.detectedFaces)
                      .filter((face, i, arr) => arr.findIndex((f) => f.id === face.id) === i)
                      .map((face) => (
                        <div key={face.id} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400">
                            {face.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{face.name}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">{face.role}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Progress value={face.confidence * 100} className="h-1 flex-1" />
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{Math.round(face.confidence * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </GlassCard>
              )}

              {/* Semantic search */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <Search size={14} className="text-blue-500" />
                  语义搜索
                </h4>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索资产内容..."
                    className="w-full h-8 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 pl-8 pr-3 text-xs outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  {searchQuery ? (
                    <div className="flex items-center justify-center py-8 text-xs text-gray-400 dark:text-gray-500">
                      语义搜索功能开发中，敬请期待
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-xs text-gray-400 dark:text-gray-500">
                      请输入关键词搜索资产内容
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 2: 自动标注 ====== */}
        <TabsContent value="tagging">
          <div className="grid grid-cols-12 gap-5">
            {/* Left: col-8 */}
            <div className="col-span-8 space-y-4">
              {/* Tag panorama */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <Tag size={14} className="text-blue-500" />
                  标签全景
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {tagCategorySummary.map((cat) => {
                    const meta = tagCategoryMeta[cat.category as AssetTagCategory];
                    const isSelected = selectedTagCategory === cat.category;
                    return (
                      <button
                        key={cat.category}
                        onClick={() =>
                          setSelectedTagCategory(isSelected ? null : cat.category)
                        }
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? `${meta.bgColor} border-current ring-1 ring-current`
                            : "bg-gray-50/70 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/50 hover:bg-gray-100/70 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{cat.count}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {cat.examples.slice(0, 3).map((ex, i) => (
                            <Badge key={i} className={`text-[9px] py-0 ${meta.bgColor} ${meta.color}`}>
                              {ex}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>

              {/* Asset tag table */}
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">资产标签明细</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">资产名称</th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">标签数</th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">主要类别</th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetTagList.map((asset) => {
                        const catMeta = tagCategoryMeta[asset.mainCategory as keyof typeof tagCategoryMeta];
                        const st = statusConfig[asset.status];
                        return (
                          <tr key={asset.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors">
                            <td className="py-2.5 px-3 text-xs font-medium text-gray-800 dark:text-gray-100">{asset.title}</td>
                            <td className="py-2.5 px-3 text-center text-xs font-mono text-gray-600 dark:text-gray-400">{asset.tagCount}</td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge className={`text-[10px] ${catMeta?.bgColor} ${catMeta?.color}`}>
                                {catMeta?.label}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge className={`text-[10px] ${st.color}`}>
                                {st.icon}
                                <span className="ml-0.5">{st.label}</span>
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>

            {/* Right: col-4 */}
            <div className="col-span-4 space-y-4">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">标签分布</h4>
                <DonutChartCard data={tagDistributionData} height={180} innerRadius={40} outerRadius={70} />
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {tagDistributionData.slice(0, 6).map((d) => (
                    <div key={d.name} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 truncate">{d.name}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GaugeChart value={94.2} label="标注准确率" suffix="%" />

              <div className="space-y-3">
                <StatCard
                  label="总标签数"
                  value={tagCategorySummary.reduce((sum, c) => sum + c.count, 0)}
                  suffix="个"
                  icon={<Tag size={18} />}
                />
                <StatCard
                  label="平均标签数"
                  value={assetTagList.length > 0
                    ? Math.round((assetTagList.reduce((sum, a) => sum + a.tagCount, 0) / assetTagList.length) * 10) / 10
                    : 0}
                  suffix="个/资产"
                  icon={<Layers size={18} />}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 3: 自动关联 (知识图谱) ====== */}
        <TabsContent value="graph">
          {/* Graph visualization */}
          <GlassCard className="mb-5">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-1.5">
              <GitBranch size={14} className="text-blue-500" />
              知识图谱 · 实体关联网络
            </h4>

            {/* Simplified graph as CSS grid nodes */}
            <div className="relative min-h-[360px] bg-gray-50/50 dark:bg-gray-800/25 rounded-xl p-6">
              {/* Center node */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={() => setSelectedGraphNode(selectedGraphNode === "n1" ? null : "n1")}
                  className={`px-4 py-2.5 rounded-xl border-2 transition-all shadow-md ${
                    selectedGraphNode === "n1"
                      ? "bg-blue-100 dark:bg-blue-900/30 border-blue-400 scale-110"
                      : highlightedNodeIds && !highlightedNodeIds.has("n1")
                      ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-30"
                      : "bg-white dark:bg-gray-900 border-blue-300 hover:border-blue-400"
                  }`}
                >
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{graphNodes[0]?.label ?? "养老金改革"}</span>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500">主题 · {graphNodes[0]?.connections ?? 0}个关联</p>
                </button>
              </div>

              {/* Surrounding nodes positioned in a circle pattern */}
              {[
                { node: graphNodes.find((n) => n.id === "n2"), top: "10%", left: "20%" },
                { node: graphNodes.find((n) => n.id === "n3"), top: "10%", left: "65%" },
                { node: graphNodes.find((n) => n.id === "n4"), top: "30%", left: "80%" },
                { node: graphNodes.find((n) => n.id === "n5"), top: "60%", left: "85%" },
                { node: graphNodes.find((n) => n.id === "n6"), top: "80%", left: "65%" },
                { node: graphNodes.find((n) => n.id === "n7"), top: "80%", left: "25%" },
                { node: graphNodes.find((n) => n.id === "n12"), top: "60%", left: "8%" },
                { node: graphNodes.find((n) => n.id === "n15"), top: "30%", left: "8%" },
                { node: graphNodes.find((n) => n.id === "n13"), top: "15%", left: "42%" },
                { node: graphNodes.find((n) => n.id === "n14"), top: "85%", left: "45%" },
                { node: graphNodes.find((n) => n.id === "n8"), top: "45%", left: "18%" },
                { node: graphNodes.find((n) => n.id === "n9"), top: "55%", left: "70%" },
              ].map(({ node, top, left }) => {
                if (!node) return null;
                const colors = nodeTypeColor[node.type] || nodeTypeColor.topic;
                const isHighlighted = !highlightedNodeIds || highlightedNodeIds.has(node.id);
                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedGraphNode(selectedGraphNode === node.id ? null : node.id)}
                    className={`absolute px-2.5 py-1.5 rounded-lg border transition-all ${colors.bg} ${colors.border} ${
                      selectedGraphNode === node.id
                        ? "scale-110 shadow-md ring-2 ring-blue-300"
                        : !isHighlighted
                        ? "opacity-30"
                        : "hover:scale-105 hover:shadow-sm"
                    }`}
                    style={{ top, left }}
                  >
                    <span className={`text-xs font-medium ${colors.text}`}>{node.label}</span>
                    <p className="text-[8px] text-gray-400 dark:text-gray-500">{node.connections}个关联</p>
                  </button>
                );
              })}

              {/* SVG connector lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                {graphEdges.map((edge, i) => {
                  const isHl = highlightedEdges.some(
                    (e) => e.source === edge.source && e.target === edge.target
                  );
                  return (
                    <line
                      key={i}
                      x1="50%"
                      y1="50%"
                      x2="50%"
                      y2="50%"
                      className={`${isHl ? "stroke-blue-400" : "stroke-gray-200"}`}
                      strokeWidth={isHl ? 2 : 1}
                      strokeDasharray={isHl ? undefined : "4 4"}
                    />
                  );
                })}
              </svg>
            </div>

            {/* Node type legend */}
            <div className="flex items-center gap-4 mt-3">
              {Object.entries(nodeTypeColor).map(([type, colors]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded border ${colors.bg} ${colors.border}`} />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {type === "topic" ? "主题" : type === "person" ? "人物" : type === "event" ? "事件" : type === "location" ? "地点" : "机构"}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="grid grid-cols-12 gap-5">
            {/* Relations list */}
            <div className="col-span-8">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">关联发现</h4>
                <div className="space-y-2">
                  {graphEdges.map((edge, i) => {
                    const sourceNode = graphNodes.find((n) => n.id === edge.source);
                    const targetNode = graphNodes.find((n) => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;
                    const srcColors = nodeTypeColor[sourceNode.type] || nodeTypeColor.topic;
                    const tgtColors = nodeTypeColor[targetNode.type] || nodeTypeColor.topic;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                      >
                        <Badge className={`text-[10px] ${srcColors.bg} ${srcColors.text}`}>
                          {sourceNode.label}
                        </Badge>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">—{edge.relation}→</span>
                        <Badge className={`text-[10px] ${tgtColors.bg} ${tgtColors.text}`}>
                          {targetNode.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            {/* Stats */}
            <div className="col-span-4 space-y-3">
              <StatCard label="实体节点" value={graphNodes.length} suffix="个" icon={<GitBranch size={18} />} />
              <StatCard label="关联边" value={graphEdges.length} suffix="条" icon={<GitBranch size={18} />} />
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">实体类型分布</h4>
                <div className="space-y-1.5">
                  {["topic", "person", "event", "location", "organization"].map((type) => {
                    const count = graphNodes.filter((n) => n.type === type).length;
                    const colors = nodeTypeColor[type];
                    const labels: Record<string, string> = { topic: "主题", person: "人物", event: "事件", location: "地点", organization: "机构" };
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded border ${colors.bg} ${colors.border}`} />
                        <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{labels[type]}</span>
                        <span className="text-xs font-mono font-medium text-gray-800 dark:text-gray-100">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 5: 对话检索 ====== */}
        <TabsContent value="chat">
          <GlassCard padding="none">
            <AssetChat />
          </GlassCard>
        </TabsContent>

        {/* ====== Tab 6: 标注配置 ====== */}
        <TabsContent value="tagConfig">
          <TagConfig
            customSchemas={customTagSchemas}
            defaultSchemas={defaultTagSchemas}
          />
        </TabsContent>

        {/* ====== Tab 4: 处理队列 ====== */}
        <TabsContent value="queue">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <StatCard label="排队中" value={queueStats.queued} suffix="个" icon={<Clock size={18} />} />
            <StatCard label="处理中" value={queueStats.processing} suffix="个" icon={<Loader2 size={18} />} />
            <StatCard label="已完成" value={queueStats.completed} suffix="个" icon={<CheckCircle size={18} />} />
            <StatCard label="失败" value={queueStats.failed} suffix="个" icon={<AlertCircle size={18} />} />
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-8">
              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">处理队列</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">资产名称</th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">类型</th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">状态</th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-32">进度</th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">耗时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processingQueue.map((item) => {
                        const st = statusConfig[item.status];
                        const tp = typeConfig[item.type] || typeConfig.video;
                        return (
                          <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors">
                            <td className="py-2.5 px-3 text-xs font-medium text-gray-800 dark:text-gray-100 max-w-[200px] truncate">
                              {item.title}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge className={`text-[10px] ${tp.color}`}>{tp.label}</Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge className={`text-[10px] ${st.color}`}>
                                {st.icon}
                                <span className="ml-0.5">{st.label}</span>
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <Progress value={item.progress} className="h-1.5 flex-1" />
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono w-8 text-right">{item.progress}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center text-xs font-mono text-gray-500 dark:text-gray-400">
                              {item.duration}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>

            <div className="col-span-4">
              <AgentWorkCard
                task={{
                  employeeId: "xiaozi",
                  taskName: "分析: 社区养老服务纪实",
                  progress: 67,
                  status: "working",
                  detail: "正在执行NLU语义分析...",
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
