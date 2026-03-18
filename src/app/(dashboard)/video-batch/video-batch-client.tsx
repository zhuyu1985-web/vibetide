"use client";

import { useState } from "react";
import {
  KPIComparisonBar,
  type KPIItem,
} from "@/components/shared/kpi-comparison-bar";
import {
  ChannelAdaptGrid,
  type ChannelAdaption,
} from "@/components/shared/channel-adapt-grid";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Video,
  Layers,
  CheckCircle,
  Clock,
  RotateCcw,
  User,
  Play,
  Loader2,
  Share2,
} from "lucide-react";
import type {
  BatchTopic,
  BatchStats,
  ConversionTaskItem,
  DigitalHumanConfig,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  KPI comparison items                                                */
/* ------------------------------------------------------------------ */
const kpiItems: KPIItem[] = [
  {
    label: "批量产出",
    before: "5条/天",
    after: "20条/2h",
    improvement: "4x",
  },
  {
    label: "渠道覆盖",
    before: "1-2",
    after: "4+",
    improvement: "2x+",
  },
  {
    label: "横转竖效率",
    before: "手动2h",
    after: "AI 3min",
    improvement: "40x",
  },
  {
    label: "数字人成本",
    before: "5000元/条",
    after: "50元/条",
    improvement: "100x",
  },
];

/* ------------------------------------------------------------------ */
/*  Style labels / helpers                                              */
/* ------------------------------------------------------------------ */
const styleLabels: Record<string, string> = {
  formal: "正式",
  friendly: "亲切",
  energetic: "活泼",
};

const statusBadge: Record<string, string> = {
  done: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  processing: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  pending: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

const statusLabel: Record<string, string> = {
  done: "已完成",
  processing: "生成中",
  pending: "待处理",
};

interface VideoBatchClientProps {
  batchTopics: BatchTopic[];
  batchStats: BatchStats;
  conversionTasks: ConversionTaskItem[];
  digitalHumans: DigitalHumanConfig[];
  channelAdaptations: ChannelAdaption[];
}

export function VideoBatchClient({
  batchTopics,
  batchStats,
  conversionTasks,
  digitalHumans,
  channelAdaptations,
}: VideoBatchClientProps) {
  /* --- Digital Human state --- */
  const [selectedHuman, setSelectedHuman] = useState(digitalHumans[0]?.id || "");
  const [broadcastStyle, setBroadcastStyle] = useState<
    "formal" | "friendly" | "energetic"
  >("formal");
  const [scriptText, setScriptText] = useState(
    "各位观众大家好，今天的科技快报为您带来AI手机大战的最新消息..."
  );
  const [genProgress, setGenProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentHuman = digitalHumans.find((h) => h.id === selectedHuman) || digitalHumans[0];

  /* Unique channels across all topics (for matrix header) */
  const allChannels = Array.from(
    new Set(batchTopics.flatMap((t) => t.channels.map((c) => c.channel)))
  );

  /* Simulate generation */
  const handleGenerate = () => {
    setIsGenerating(true);
    setGenProgress(0);
    let p = 0;
    const timer = setInterval(() => {
      p += Math.random() * 12;
      if (p >= 100) {
        p = 100;
        clearInterval(timer);
        setIsGenerating(false);
      }
      setGenProgress(Math.round(p));
    }, 400);
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ---------- Header ---------- */}
      <PageHeader
        title="短视频工厂"
        description="一稿多渠道 · 数字人播报 · 大屏转小屏"
      />

      {/* ---------- KPI Bar ---------- */}
      <KPIComparisonBar items={kpiItems} />

      {/* ---------- Stats Row ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="今日产出"
          value={batchStats.todayOutput}
          suffix="条"
          icon={<Video size={18} />}
        />
        <StatCard
          label="进行中"
          value={batchStats.inProgress}
          suffix="条"
          icon={<Loader2 size={18} className="animate-spin" />}
        />
        <StatCard
          label="已发布"
          value={batchStats.published}
          suffix="条"
          icon={<CheckCircle size={18} />}
        />
        <StatCard
          label="待审核"
          value={batchStats.pendingReview}
          suffix="条"
          icon={<Clock size={18} />}
        />
      </div>

      {/* ---------- Tabs ---------- */}
      <Tabs defaultValue="batch" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="batch">
            <Layers size={14} className="mr-1" />
            批量生产
          </TabsTrigger>
          <TabsTrigger value="convert">
            <RotateCcw size={14} className="mr-1" />
            横转竖
          </TabsTrigger>
          <TabsTrigger value="digital-human">
            <User size={14} className="mr-1" />
            数字人播报
          </TabsTrigger>
          <TabsTrigger value="channel">
            <Share2 size={14} className="mr-1" />
            渠道适配
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/*  TAB 1 - 批量生产                                          */}
        {/* ======================================================== */}
        <TabsContent value="batch">
          <div className="grid grid-cols-12 gap-5">
            {/* --- Left: Topic queue --- */}
            <div className="col-span-12 lg:col-span-5">
              <GlassCard>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
                  选题队列
                </h3>
                <div className="space-y-3">
                  {batchTopics.map((topic) => (
                    <div
                      key={topic.id}
                      className="p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 hover:border-blue-200 transition-colors bg-white/60 dark:bg-gray-900/60"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                          {topic.title}
                        </span>
                        {/* Circular progress indicator */}
                        <div className="relative w-9 h-9 flex items-center justify-center">
                          <svg
                            className="w-9 h-9 -rotate-90"
                            viewBox="0 0 36 36"
                          >
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke="#e5e7eb"
                              strokeWidth="3"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke={
                                topic.progress === 100
                                  ? "#22c55e"
                                  : topic.progress > 0
                                  ? "#3b82f6"
                                  : "#d1d5db"
                              }
                              strokeWidth="3"
                              strokeDasharray={`${
                                (topic.progress / 100) * 94.2
                              } 94.2`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute text-[10px] font-bold text-gray-700 dark:text-gray-300">
                            {topic.progress}%
                          </span>
                        </div>
                      </div>
                      <Progress value={topic.progress} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* --- Right: Topic x Channel matrix --- */}
            <div className="col-span-12 lg:col-span-7">
              <GlassCard>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
                  选题 x 渠道 矩阵
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700/50">
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px]">
                          选题
                        </th>
                        {allChannels.map((ch) => (
                          <th
                            key={ch}
                            className="text-center py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
                          >
                            {ch}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batchTopics.map((topic) => (
                        <tr
                          key={topic.id}
                          className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-100 text-xs">
                            {topic.title}
                          </td>
                          {allChannels.map((ch) => {
                            const cell = topic.channels.find(
                              (c) => c.channel === ch
                            );
                            return (
                              <td
                                key={ch}
                                className="py-2.5 px-2 text-center"
                                title={cell?.format}
                              >
                                {cell?.status === "done" && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 text-xs font-bold">
                                    &#10003;
                                  </span>
                                )}
                                {cell?.status === "processing" && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs animate-pulse">
                                    &#9679;
                                  </span>
                                )}
                                {cell?.status === "pending" && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-xs">
                                    &#9675;
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 inline-flex items-center justify-center text-[10px] font-bold">
                      &#10003;
                    </span>
                    已完成
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 inline-flex items-center justify-center text-[10px]">
                      &#9679;
                    </span>
                    生成中
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 inline-flex items-center justify-center text-[10px]">
                      &#9675;
                    </span>
                    待处理
                  </span>
                </div>
              </GlassCard>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/*  TAB 2 - 横转竖                                            */}
        {/* ======================================================== */}
        <TabsContent value="convert">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {conversionTasks.map((task) => (
              <GlassCard key={task.id} variant="interactive">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate pr-2">
                    {task.title}
                  </h4>
                  <Badge
                    className={`text-[10px] shrink-0 ${
                      statusBadge[task.status]
                    }`}
                  >
                    {statusLabel[task.status]}
                  </Badge>
                </div>

                {/* Source / Target preview */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Source 16:9 */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-full aspect-video rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {task.sourceRatio}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      原始横版
                    </span>
                  </div>

                  {/* Target 9:16 */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-full aspect-[9/16] max-h-[140px] rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center relative overflow-hidden">
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {task.targetRatio}
                      </span>
                      {/* Smart focus indicator */}
                      <div className="absolute inset-x-3 inset-y-4 border-2 border-dashed border-blue-400 rounded-md flex items-end justify-center pb-1">
                        <span className="text-[8px] text-blue-500 font-medium bg-white/80 px-1 rounded">
                          智能跟焦
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      目标竖版
                    </span>
                  </div>
                </div>

                {/* Settings toggles */}
                <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">智能跟焦</span>
                    <Switch
                      size="sm"
                      checked={task.settings.smartFocus}
                      disabled
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">人脸优先</span>
                    <Switch
                      size="sm"
                      checked={task.settings.facePriority}
                      disabled
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">字幕重排</span>
                    <Switch
                      size="sm"
                      checked={task.settings.subtitleReflow}
                      disabled
                    />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/*  TAB 3 - 数字人播报                                        */}
        {/* ======================================================== */}
        <TabsContent value="digital-human">
          <div className="grid grid-cols-12 gap-5">
            {/* --- Left panel --- */}
            <div className="col-span-12 lg:col-span-6 space-y-5">
              {/* Script input */}
              <GlassCard>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                  播报脚本
                </h3>
                <textarea
                  className="w-full h-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-3 text-sm text-gray-700 dark:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                />
              </GlassCard>

              {/* Style selection */}
              <GlassCard>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                  播报风格
                </h3>
                <div className="flex gap-2">
                  {(
                    ["formal", "friendly", "energetic"] as const
                  ).map((style) => (
                    <button
                      key={style}
                      onClick={() => setBroadcastStyle(style)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        broadcastStyle === style
                          ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 text-blue-700 dark:text-blue-400 shadow-sm"
                          : "bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      {styleLabels[style]}
                    </button>
                  ))}
                </div>
              </GlassCard>

              {/* Digital human selection */}
              <GlassCard>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                  选择数字人
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {digitalHumans.map((dh) => (
                    <button
                      key={dh.id}
                      onClick={() => setSelectedHuman(dh.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                        selectedHuman === dh.id
                          ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 shadow-sm"
                          : "bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                          selectedHuman === dh.id
                            ? "bg-gradient-to-br from-blue-400 to-purple-500 text-white"
                            : "bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600"
                        }`}
                      >
                        {dh.avatar}
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {dh.name}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {dh.voiceType}
                      </span>
                    </button>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* --- Right panel: Preview --- */}
            <div className="col-span-12 lg:col-span-6">
              <GlassCard className="flex flex-col items-center py-8">
                {/* Large avatar */}
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-4xl font-bold text-white shadow-lg mb-6">
                  {currentHuman?.avatar}
                </div>
                <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">
                  {currentHuman?.name}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                  {currentHuman?.voiceType} ·{" "}
                  {currentHuman ? styleLabels[currentHuman.style] : ""}风格
                </p>

                {/* Audio waveform animation */}
                <div className="flex items-end gap-[3px] h-12 mb-6">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const barHeight = 12 + ((i * 7 + 13) % 37);
                    const barDuration = 0.4 + ((i * 11 + 5) % 7) / 10;
                    return (
                      <div
                        key={i}
                        className="w-[3px] rounded-full bg-gradient-to-t from-blue-500 to-purple-400"
                        style={{
                          height: isGenerating
                            ? `${barHeight}px`
                            : "6px",
                          animation: isGenerating
                            ? `pulse ${barDuration}s ease-in-out infinite alternate`
                            : "none",
                          transition: "height 0.3s ease",
                        }}
                      />
                    );
                  })}
                </div>

                {/* Generation progress */}
                <div className="w-full max-w-xs mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>生成进度</span>
                    <span className="font-mono font-medium">
                      {genProgress}%
                    </span>
                  </div>
                  <Progress value={genProgress} className="h-2" />
                </div>

                {/* Generate button */}
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="mt-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} className="mr-1 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Play size={14} className="mr-1" />
                      开始生成
                    </>
                  )}
                </Button>
              </GlassCard>
            </div>
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/*  TAB 4 - 渠道适配                                          */}
        {/* ======================================================== */}
        <TabsContent value="channel">
          <ChannelAdaptGrid items={channelAdaptations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
