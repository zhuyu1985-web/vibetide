"use client";

import { useState } from "react";
import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import { TimelineStep, type TimelineItem } from "@/components/shared/timeline-step";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  Loader2,
  Circle,
  ChevronRight,
  Eye,
  Heart,
  Share2,
  Copy,
  Download,
  Film,
  FileText,
  Sparkles,
} from "lucide-react";
import type {
  PipelineNode,
  HitTemplate,
  EDLProject,
  ActivityLog,
} from "@/lib/types";

interface PremiumContentClientProps {
  pipelineNodes: PipelineNode[];
  hitTemplates: HitTemplate[];
  edlProject: EDLProject;
  activityLogs: ActivityLog[];
}

export function PremiumContentClient({
  pipelineNodes,
  hitTemplates,
  edlProject,
  activityLogs,
}: PremiumContentClientProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>(edlProject.formats[0]);

  const TOTAL_DURATION = 330;

  const selectedPipelineNode = pipelineNodes.find((n) => n.id === selectedNode);

  // Map activity logs to TimelineItem format
  const timelineItems: TimelineItem[] = activityLogs.map((log, i) => ({
    time: log.time,
    title: log.action,
    description: undefined,
    status: i === 0 ? "active" : "completed",
  }));

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="精品聚合"
        description="画布式多Agent编排 · 爆款模板一键复制"
      />

      <KPIComparisonBar
        items={[
          { label: "精品周期", before: "5-7天", after: "1-2天" },
          { label: "爆款率", before: "12%", after: "35%" },
          { label: "多角度覆盖", before: "1", after: "3+" },
          { label: "素材利用率", before: "40%", after: "90%" },
        ]}
      />

      <Tabs defaultValue="canvas" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="canvas" className="text-xs">
            <Sparkles size={14} className="mr-1" />
            生产画布
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs">
            <Copy size={14} className="mr-1" />
            爆款模板库
          </TabsTrigger>
          <TabsTrigger value="edl" className="text-xs">
            <Film size={14} className="mr-1" />
            EDL导出
          </TabsTrigger>
        </TabsList>

        {/* ============ Tab 1: 生产画布 ============ */}
        <TabsContent value="canvas">
          {/* Horizontal Pipeline */}
          <GlassCard className="mb-6 overflow-x-auto">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              生产流水线
            </h3>
            <div className="flex items-center gap-0 min-w-[800px]">
              {pipelineNodes.map((node, i) => (
                <div key={node.id} className="flex items-center flex-1">
                  {/* Node Card */}
                  <button
                    onClick={() =>
                      setSelectedNode(
                        selectedNode === node.id ? null : node.id
                      )
                    }
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer w-full min-w-[120px] ${
                      selectedNode === node.id
                        ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/50 shadow-md"
                        : node.status === "completed"
                        ? "border-green-200 bg-green-50/30 dark:bg-green-950/50 hover:border-green-300"
                        : node.status === "active"
                        ? "border-blue-200 bg-blue-50/30 dark:bg-blue-950/50 hover:border-blue-300"
                        : "border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/25 hover:border-gray-300"
                    }`}
                  >
                    <EmployeeAvatar
                      employeeId={node.employeeId}
                      size="sm"
                      showStatus
                      status={
                        node.status === "completed"
                          ? "idle"
                          : node.status === "active"
                          ? "working"
                          : "learning"
                      }
                    />
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-100">
                      {node.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {node.status === "completed" ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : node.status === "active" ? (
                        <Loader2
                          size={14}
                          className="text-blue-500 animate-spin"
                        />
                      ) : (
                        <Circle size={14} className="text-gray-300" />
                      )}
                      <span
                        className={`text-[10px] ${
                          node.status === "completed"
                            ? "text-green-600 dark:text-green-400"
                            : node.status === "active"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {node.status === "completed"
                          ? "已完成"
                          : node.status === "active"
                          ? `${node.progress}%`
                          : "待开始"}
                      </span>
                    </div>
                    {node.status === "active" && (
                      <Progress value={node.progress} className="h-1.5 w-full" />
                    )}
                  </button>
                  {/* Connecting Line */}
                  {i < pipelineNodes.length - 1 && (
                    <div className="flex items-center px-1 shrink-0">
                      <div
                        className={`h-0.5 w-6 ${
                          node.status === "completed"
                            ? "bg-green-400"
                            : "bg-gray-200"
                        }`}
                      />
                      <ChevronRight
                        size={14}
                        className={
                          node.status === "completed"
                            ? "text-green-400"
                            : "text-gray-300"
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Selected Node Detail Panel */}
          {selectedPipelineNode && (
            <GlassCard variant="blue" className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <EmployeeAvatar
                  employeeId={selectedPipelineNode.employeeId}
                  size="md"
                  showStatus
                  status={
                    selectedPipelineNode.status === "active"
                      ? "working"
                      : "idle"
                  }
                />
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {selectedPipelineNode.label}
                  </h4>
                  <Badge
                    className={`text-[10px] ${
                      selectedPipelineNode.status === "completed"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : selectedPipelineNode.status === "active"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {selectedPipelineNode.status === "completed"
                      ? "已完成"
                      : selectedPipelineNode.status === "active"
                      ? "进行中"
                      : "待开始"}
                  </Badge>
                </div>
              </div>
              {/* Sub-tasks Checklist */}
              <div className="space-y-2 mb-3">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  子任务清单
                </span>
                {selectedPipelineNode.subTasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {task.done ? (
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <Circle size={14} className="text-gray-300 shrink-0" />
                    )}
                    <span
                      className={`text-xs ${
                        task.done ? "text-gray-600 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {task.name}
                    </span>
                  </div>
                ))}
              </div>
              {/* Output */}
              {selectedPipelineNode.output && (
                <div className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 border border-blue-100 dark:border-blue-800/30">
                  <span className="text-[10px] text-blue-500 font-medium block mb-1">
                    产出结果
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    {selectedPipelineNode.output}
                  </p>
                </div>
              )}
            </GlassCard>
          )}

          {/* Activity Log Feed */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              生产动态
            </h3>
            <div className="space-y-3">
              {activityLogs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0 last:pb-0"
                >
                  <EmployeeAvatar
                    employeeId={log.employeeId}
                    size="xs"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-300">{log.action}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono shrink-0">
                    {log.time}
                  </span>
                </div>
              ))}
            </div>
            {/* Timeline view */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50">
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">
                时间线视图
              </h4>
              <TimelineStep items={timelineItems} />
            </div>
          </GlassCard>
        </TabsContent>

        {/* ============ Tab 2: 爆款模板库 ============ */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {hitTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </TabsContent>

        {/* ============ Tab 3: EDL导出 ============ */}
        <TabsContent value="edl">
          {/* Project Info */}
          <GlassCard className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Film size={20} className="text-blue-500" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {edlProject.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    时长：{edlProject.duration}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {edlProject.tracks.length} 轨道
              </Badge>
            </div>
          </GlassCard>

          {/* Multi-track Timeline Preview */}
          <GlassCard className="mb-6">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              多轨道时间线预览
            </h3>
            {/* Time ruler */}
            <div className="flex items-center mb-2 ml-20">
              <div className="flex justify-between w-full text-[9px] text-gray-400 dark:text-gray-500 font-mono">
                <span>0:00</span>
                <span>1:00</span>
                <span>2:00</span>
                <span>3:00</span>
                <span>4:00</span>
                <span>5:00</span>
                <span>5:30</span>
              </div>
            </div>

            <div className="space-y-3">
              {edlProject.tracks.map((track) => (
                <div key={track.name} className="flex items-center gap-3">
                  {/* Track Label */}
                  <div className="w-16 shrink-0">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: track.color }}
                    >
                      {track.name}
                    </span>
                  </div>
                  {/* Track Timeline Bar */}
                  <div className="flex-1 relative h-8 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                    {track.clips.map((clip, ci) => {
                      const leftPercent =
                        (clip.start / TOTAL_DURATION) * 100;
                      const widthPercent =
                        ((clip.end - clip.start) / TOTAL_DURATION) * 100;
                      return (
                        <div
                          key={ci}
                          className="absolute top-0 h-full flex items-center justify-center rounded-sm text-white text-[9px] font-medium overflow-hidden"
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            backgroundColor: track.color,
                            opacity: 0.85,
                          }}
                          title={`${clip.label} (${clip.start}s - ${clip.end}s)`}
                        >
                          {widthPercent > 8 && (
                            <span className="truncate px-1">{clip.label}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Export Format Selection */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              导出格式
            </h3>
            <div className="flex flex-wrap gap-3 mb-6">
              {edlProject.formats.map((format) => (
                <button
                  key={format}
                  onClick={() => setSelectedFormat(format)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    selectedFormat === format
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                  }`}
                >
                  <FileText
                    size={14}
                    className={`inline mr-1.5 ${
                      selectedFormat === format
                        ? "text-blue-500"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  />
                  {format}
                </button>
              ))}
            </div>
            <Button className="w-full sm:w-auto">
              <Download size={14} className="mr-2" />
              导出 {selectedFormat} 文件
            </Button>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ Template Card Sub-component ============ */

function TemplateCard({ template }: { template: HitTemplate }) {
  return (
    <GlassCard variant="interactive" padding="md">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">{template.name}</h4>
        <Badge variant="secondary" className="text-[10px]">
          {template.category}
        </Badge>
      </div>

      {/* Structure Steps */}
      <div className="mb-3 space-y-1">
        {template.structure.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-blue-400 w-4 text-right shrink-0">
              {i + 1}.
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{step}</span>
          </div>
        ))}
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-3 text-[10px] text-gray-500 dark:text-gray-400">
        <span>
          <Copy size={10} className="inline mr-0.5" />
          {template.usageCount} 次使用
        </span>
        <span>
          <Sparkles size={10} className="inline mr-0.5" />
          {template.hitRate}% 爆款率
        </span>
      </div>

      {/* Best Performance */}
      <div className="flex items-center gap-3 mb-4 p-2 bg-amber-50/50 dark:bg-amber-950/50 rounded-lg">
        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
          最佳表现
        </span>
        <div className="flex items-center gap-3 text-[10px] text-gray-600 dark:text-gray-400">
          <span>
            <Eye size={10} className="inline mr-0.5" />
            {(template.bestPerformance.views / 10000).toFixed(1)}万
          </span>
          <span>
            <Heart size={10} className="inline mr-0.5" />
            {(template.bestPerformance.likes / 10000).toFixed(1)}万
          </span>
          <span>
            <Share2 size={10} className="inline mr-0.5" />
            {(template.bestPerformance.shares / 1000).toFixed(1)}千
          </span>
        </div>
      </div>

      {/* Use Template Button -> Sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="w-full text-xs">
            <Copy size={12} className="mr-1" />
            使用模板
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{template.name}</SheetTitle>
            <SheetDescription>{template.description}</SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            {/* Category */}
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">分类</span>
              <Badge>{template.category}</Badge>
            </div>

            {/* Full Structure */}
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-2">模板结构</span>
              <div className="space-y-2">
                {template.structure.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Stats */}
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-2">
                使用数据
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-center">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {template.usageCount}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                    累计使用
                  </span>
                </div>
                <div className="p-2 bg-green-50 dark:bg-green-950/50 rounded-lg text-center">
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {template.hitRate}%
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                    爆款率
                  </span>
                </div>
              </div>
            </div>

            {/* Best Performance Detail */}
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-2">
                最佳表现
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Eye size={14} className="mx-auto text-gray-400 dark:text-gray-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 block">
                    {(template.bestPerformance.views / 10000).toFixed(1)}万
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">阅读</span>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Heart size={14} className="mx-auto text-gray-400 dark:text-gray-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 block">
                    {(template.bestPerformance.likes / 10000).toFixed(1)}万
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">点赞</span>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Share2 size={14} className="mx-auto text-gray-400 dark:text-gray-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 block">
                    {(template.bestPerformance.shares / 1000).toFixed(1)}千
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">分享</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button className="w-full">
              <Sparkles size={14} className="mr-2" />
              应用此模板开始创作
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </GlassCard>
  );
}
