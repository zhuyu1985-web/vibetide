"use client";

import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Zap,
  Trophy,
  Video,
  FileText,
  CheckCircle,
  Clock,
  Eye,
  Play,
  Mic,
  Quote,
  Sparkles,
  MapPin,
  Calendar,
  Building2,
  ClipboardCheck,
  Package,
  Star,
  CircleDot,
  Loader2,
} from "lucide-react";
import type {
  SportEvent,
  ConferenceEvent,
  FestivalEvent,
  ExhibitionEvent,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const highlightTypeIcon: Record<string, React.ReactNode> = {
  goal: <Trophy size={14} className="text-amber-500" />,
  slam_dunk: <Zap size={14} className="text-orange-500" />,
  save: <CheckCircle size={14} className="text-green-500" />,
  foul: <CircleDot size={14} className="text-red-500" />,
  highlight: <Star size={14} className="text-blue-500" />,
};

const outputTypeColor: Record<string, string> = {
  clip: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  summary: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  graphic: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
};

const outputStatusConfig: Record<string, { label: string; color: string }> = {
  done: { label: "已完成", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  processing: { label: "处理中", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  pending: { label: "待处理", color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
};

const conferenceOutputTypeColor: Record<string, string> = {
  flash: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  summary: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  quote_card: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

const conferenceOutputTypeLabel: Record<string, string> = {
  flash: "快讯",
  summary: "摘要",
  quote_card: "金句卡",
};

const phaseStatusColor: Record<string, { bg: string; text: string; bar: string }> = {
  completed: { bg: "bg-green-50 dark:bg-green-950/50 border-green-200", text: "text-green-700 dark:text-green-400", bar: "bg-green-500" },
  active: { bg: "bg-blue-50 dark:bg-blue-950/50 border-blue-200", text: "text-blue-700 dark:text-blue-400", bar: "bg-blue-500" },
  pending: { bg: "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700", text: "text-gray-500 dark:text-gray-400", bar: "bg-gray-400" },
};

const phaseStatusLabel: Record<string, string> = {
  completed: "已完成",
  active: "进行中",
  pending: "待开始",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventAutoClientProps {
  sportEvent: SportEvent | null;
  conferenceEvent: ConferenceEvent | null;
  festivalEvent: FestivalEvent | null;
  exhibitionEvent: ExhibitionEvent | null;
}

// ---------------------------------------------------------------------------
// Client Component
// ---------------------------------------------------------------------------

export function EventAutoClient({
  sportEvent,
  conferenceEvent,
  festivalEvent,
  exhibitionEvent,
}: EventAutoClientProps) {
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Page Header */}
      <PageHeader
        title="节赛会展"
        description="赛事3分钟出片 · 1人替代6人"
      />

      {/* KPI Comparison Bar */}
      <KPIComparisonBar
        items={[
          { label: "出片速度", before: "15-30min", after: "3min", improvement: "10x" },
          { label: "人力需求", before: "5-8人", after: "1人+AI", improvement: "-80%" },
          { label: "覆盖率", before: "60%", after: "98%", improvement: "+38%" },
          { label: "内容多样性", before: "2种", after: "6种", improvement: "3x" },
        ]}
      />

      {/* Tabs */}
      <Tabs defaultValue="sport" className="w-full">
        <TabsList>
          <TabsTrigger value="sport">
            <span className="mr-1">🏅</span>
            赛事
          </TabsTrigger>
          <TabsTrigger value="conference">
            <span className="mr-1">🎤</span>
            会议
          </TabsTrigger>
          <TabsTrigger value="festival">
            <span className="mr-1">🎊</span>
            节庆
          </TabsTrigger>
          <TabsTrigger value="exhibition">
            <span className="mr-1">🏛</span>
            展览
          </TabsTrigger>
        </TabsList>

        {/* ====== Tab 1: 赛事 ====== */}
        <TabsContent value="sport">
          {sportEvent ? (
            <div className="grid grid-cols-12 gap-5">
              {/* Left: col-8 */}
              <div className="col-span-8 space-y-4">
                {/* Current match card */}
                <GlassCard variant="blue">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{sportEvent.name}</h3>
                    <Badge className="bg-red-500 text-white text-[10px] flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                      </span>
                      LIVE
                    </Badge>
                  </div>

                  {/* Teams + Scores */}
                  <div className="flex items-center justify-center gap-8 mb-3">
                    {/* Team A */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center text-lg font-bold text-red-700">
                        {sportEvent.teams[0]?.logo}
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{sportEvent.teams[0]?.name}</span>
                    </div>

                    {/* Scores */}
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-black text-gray-900 dark:text-gray-100">{sportEvent.teams[0]?.score}</span>
                      <span className="text-xl font-bold text-gray-400">:</span>
                      <span className="text-4xl font-black text-gray-900 dark:text-gray-100">{sportEvent.teams[1]?.score}</span>
                    </div>

                    {/* Team B */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-lg font-bold text-blue-700">
                        {sportEvent.teams[1]?.logo}
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{sportEvent.teams[1]?.name}</span>
                    </div>
                  </div>

                  {/* Match time & period */}
                  <div className="flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <Clock size={12} />
                    <span>{sportEvent.time}</span>
                    <Badge variant="outline" className="text-[10px]">{sportEvent.period}</Badge>
                  </div>
                </GlassCard>

                {/* Simulated video frame */}
                <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden flex items-end justify-center pb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play size={48} className="text-gray-600" />
                  </div>
                  <div className="relative z-10">
                    <Badge className="bg-yellow-500/90 text-yellow-950 text-sm font-bold px-4 py-1.5 animate-pulse">
                      <Sparkles size={16} className="mr-1.5" />
                      检测到高光时刻!
                    </Badge>
                  </div>
                </div>

                {/* Event timeline (highlights) */}
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" />
                    赛事高光时刻
                  </h4>
                  <div className="space-y-3">
                    {sportEvent.highlights.map((highlight, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                      >
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0 w-16 pt-0.5">
                          {highlight.time}
                        </span>
                        <div className="shrink-0 mt-0.5">
                          {highlightTypeIcon[highlight.type] || <Star size={14} className="text-gray-400" />}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{highlight.description}</span>
                        {highlight.autoClipped && (
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] shrink-0">
                            <CheckCircle size={10} className="mr-0.5" />
                            已自动剪辑
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>

              {/* Right: col-4 */}
              <div className="col-span-4 space-y-4">
                {/* Auto output queue */}
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <Video size={14} className="text-blue-500" />
                    自动产出队列
                  </h4>
                  <div className="space-y-2.5">
                    {sportEvent.autoOutputs.map((output) => {
                      const typeColor = outputTypeColor[output.type] || "bg-gray-100 text-gray-600";
                      const statusCfg = outputStatusConfig[output.status];
                      return (
                        <div
                          key={output.id}
                          className="p-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate flex-1 mr-2">
                              {output.title}
                            </span>
                            <Badge className={`text-[9px] ${typeColor}`}>
                              {output.type === "clip" ? "剪辑" : output.type === "summary" ? "总结" : "图卡"}
                            </Badge>
                          </div>
                          {output.status === "processing" && (
                            <div className="mb-1.5">
                              <Progress value={output.progress} className="h-1.5" />
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <Badge className={`text-[9px] ${statusCfg.color}`}>
                              {output.status === "processing" && <Loader2 size={10} className="mr-0.5 animate-spin" />}
                              {statusCfg.label}
                            </Badge>
                            {output.duration && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">{output.duration}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                {/* Stats */}
                <div className="space-y-3">
                  <StatCard
                    label="已产出"
                    value={sportEvent.stats.produced}
                    suffix="条"
                    icon={<Video size={18} />}
                  />
                  <StatCard
                    label="已发布"
                    value={sportEvent.stats.published}
                    suffix="条"
                    icon={<CheckCircle size={18} />}
                  />
                  <StatCard
                    label="总浏览量"
                    value={`${(sportEvent.stats.totalViews / 10000).toFixed(1)}万`}
                    icon={<Eye size={18} />}
                  />
                </div>
              </div>
            </div>
          ) : (
            <GlassCard className="text-center py-12">
              <p className="text-sm text-gray-400 dark:text-gray-500">暂无赛事数据</p>
            </GlassCard>
          )}
        </TabsContent>

        {/* ====== Tab 2: 会议 ====== */}
        <TabsContent value="conference">
          {conferenceEvent ? (
            <div className="grid grid-cols-12 gap-5">
              {/* Left: col-8 */}
              <div className="col-span-8 space-y-4">
                <GlassCard variant="blue">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 mb-1">{conferenceEvent.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Mic size={12} />
                          {conferenceEvent.speaker}
                        </span>
                        <span>{conferenceEvent.speakerTitle}</span>
                      </div>
                    </div>
                    <Badge className="bg-red-500 text-white text-[10px] flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                      </span>
                      LIVE
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <Clock size={12} />
                    <span>{conferenceEvent.time}</span>
                  </div>
                </GlassCard>

                {/* Speaker identification card */}
                <GlassCard padding="sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-lg font-bold text-blue-700">
                      {conferenceEvent.speaker.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{conferenceEvent.speaker}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{conferenceEvent.speakerTitle}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      <Mic size={10} className="mr-0.5" />
                      正在发言
                    </Badge>
                  </div>
                </GlassCard>

                {/* Auto transcription area */}
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-500" />
                    AI 实时转录
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                    {conferenceEvent.transcription.map((line, i) => (
                      <p
                        key={i}
                        className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pl-3 border-l-2 border-blue-200 dark:border-blue-700/50"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </GlassCard>

                {/* Golden quotes */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Quote size={14} className="text-amber-500" />
                    金句提取
                  </h4>
                  {conferenceEvent.goldenQuotes.map((quote, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200"
                    >
                      <div className="flex items-start gap-2">
                        <Quote size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-900 font-medium leading-relaxed">
                          {quote}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: col-4 */}
              <div className="col-span-4 space-y-4">
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-500" />
                    自动生成内容
                  </h4>
                  <div className="space-y-2.5">
                    {conferenceEvent.outputs.map((output) => {
                      const typeColor = conferenceOutputTypeColor[output.type] || "bg-gray-100 text-gray-600";
                      const typeLabel = conferenceOutputTypeLabel[output.type] || output.type;
                      return (
                        <div
                          key={output.id}
                          className="p-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate flex-1 mr-2">
                              {output.title}
                            </span>
                            <Badge className={`text-[9px] ${typeColor}`}>
                              {typeLabel}
                            </Badge>
                          </div>
                          <Badge
                            className={`text-[9px] ${
                              output.status === "done"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            }`}
                          >
                            {output.status === "processing" && (
                              <Loader2 size={10} className="mr-0.5 animate-spin" />
                            )}
                            {output.status === "done" ? "已完成" : "处理中"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                <div className="space-y-3">
                  <StatCard
                    label="转录字数"
                    value={conferenceEvent.stats.transcribedWords.toLocaleString()}
                    suffix="字"
                    icon={<FileText size={18} />}
                  />
                  <StatCard
                    label="金句提取"
                    value={conferenceEvent.stats.quotesExtracted}
                    suffix="条"
                    icon={<Quote size={18} />}
                  />
                  <StatCard
                    label="内容产出"
                    value={conferenceEvent.stats.outputsGenerated}
                    suffix="条"
                    icon={<Sparkles size={18} />}
                  />
                </div>
              </div>
            </div>
          ) : (
            <GlassCard className="text-center py-12">
              <p className="text-sm text-gray-400 dark:text-gray-500">暂无会议数据</p>
            </GlassCard>
          )}
        </TabsContent>

        {/* ====== Tab 3: 节庆 ====== */}
        <TabsContent value="festival">
          {festivalEvent ? (
            <>
              <GlassCard variant="blue" className="mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Calendar size={20} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{festivalEvent.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{festivalEvent.date}</p>
                  </div>
                </div>
              </GlassCard>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {festivalEvent.phases.map((phase, i) => {
                  const color = phaseStatusColor[phase.status];
                  return (
                    <GlassCard
                      key={i}
                      padding="md"
                      className={`border ${color.bg}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`text-sm font-bold ${color.text}`}>
                          {phase.name}
                        </h4>
                        <Badge className={`text-[10px] ${
                          phase.status === "completed"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : phase.status === "active"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }`}>
                          {phase.status === "active" && (
                            <Loader2 size={10} className="mr-0.5 animate-spin" />
                          )}
                          {phaseStatusLabel[phase.status]}
                        </Badge>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">完成度</span>
                          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{phase.progress}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${color.bar}`}
                            style={{ width: `${phase.progress}%` }}
                          />
                        </div>
                      </div>

                      {phase.outputs.length > 0 ? (
                        <ul className="space-y-1.5">
                          {phase.outputs.map((output, j) => (
                            <li
                              key={j}
                              className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5"
                            >
                              <CheckCircle size={12} className={`shrink-0 mt-0.5 ${
                                phase.status === "completed" ? "text-green-500" : "text-blue-400"
                              }`} />
                              <span>{output}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">暂无产出</p>
                      )}
                    </GlassCard>
                  );
                })}
              </div>
            </>
          ) : (
            <GlassCard className="text-center py-12">
              <p className="text-sm text-gray-400 dark:text-gray-500">暂无节庆数据</p>
            </GlassCard>
          )}
        </TabsContent>

        {/* ====== Tab 4: 展览 ====== */}
        <TabsContent value="exhibition">
          {exhibitionEvent ? (
            <>
              <GlassCard variant="blue" className="mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/50">
                    <Building2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{exhibitionEvent.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {exhibitionEvent.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {exhibitionEvent.location}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Booth tracking */}
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <ClipboardCheck size={14} className="text-blue-500" />
                  展位追踪
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                          公司
                        </th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                          探访状态
                        </th>
                        <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                          报道数
                        </th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                          重点产品
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {exhibitionEvent.booths.map((booth, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-100 text-xs">
                            {booth.company}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {booth.visited ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs">
                                ○
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center text-xs text-gray-600 dark:text-gray-400 font-mono">
                            {booth.reports}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {booth.keyProducts.map((product, j) => (
                                <Badge
                                  key={j}
                                  variant="outline"
                                  className="text-[10px] py-0"
                                >
                                  {product}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Auto-generated product cards */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <Package size={14} className="text-purple-500" />
                  AI 自动生成产品卡
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {exhibitionEvent.autoProducts.map((product, i) => (
                    <GlassCard key={i} variant="interactive" padding="md">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-[10px]">
                          {product.company}
                        </Badge>
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{product.product}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        {product.summary}
                      </p>
                    </GlassCard>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <GlassCard className="text-center py-12">
              <p className="text-sm text-gray-400 dark:text-gray-500">暂无展览数据</p>
            </GlassCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
