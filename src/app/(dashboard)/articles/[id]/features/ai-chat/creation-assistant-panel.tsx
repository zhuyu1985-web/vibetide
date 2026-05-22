"use client";

/**
 * 「创作助手」面板 —— 对齐参考图 #5 的 AI 助手默认视图。
 *
 * 布局：
 *   [创作助手] [AI配图] 顶 tab
 *   "精彩内容，从这里起笔" 装饰大字 + 紫色波浪下划线
 *   热点创作 / 换一换  → 6 条热点编号列表（点击填入 prompt）
 *   [热点创作] [内容改写] [历史版本] 操作 chip
 *   prompt textarea + [模板] 按钮
 *   底部：华生智媒 ▼ + □ 联网搜索 + 发送箭头
 *   免责声明
 */

import { useState } from "react";
import { Sparkles, RefreshCw, Send, ArrowUp, FileText, History, Bot, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArticlePageStore } from "../../store";

type AssistantTab = "creation" | "imagery";

// 占位热点（实际数据接 hot_topics 表，下个迭代）
const MOCK_HOT_TOPICS = [
  "宁夏大学图书馆贴告示称「图书馆占座…」",
  "如何看待 5 月 21 日小米发布的 YU7 G…",
  "金秀贤事件再反转，韩国警方否认金秀…",
  "女子捡到金项链发现异常立马扔掉",
  "短剧女王浩浩妈，大家顶得住吗?",
  "中方将引进 200 架波音飞机，哪些信…",
];

interface CreationAssistantPanelProps {
  articleId: string;
}

export function CreationAssistantPanel({ articleId }: CreationAssistantPanelProps) {
  const [tab, setTab] = useState<AssistantTab>("creation");
  const [prompt, setPrompt] = useState("");
  const [model] = useState("华生智媒");
  const [webSearch, setWebSearch] = useState(false);
  const setLeftTab = useArticlePageStore((s) => s.setLeftTab);

  const handleHotTopicClick = (topic: string) => {
    setPrompt(`围绕「${topic}」帮我生成一篇深度报道`);
  };

  const handleSend = () => {
    if (!prompt.trim()) return;
    // 把 prompt 暂存到 store 后跳到 chat 子 tab，让 AIChatPanel 接管真正发送
    useArticlePageStore.getState().setSelectedText(prompt, undefined);
    setLeftTab("chat");
    setPrompt("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶 sub tab */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 shrink-0">
        <SubTab active={tab === "creation"} onClick={() => setTab("creation")}>
          创作助手
        </SubTab>
        <SubTab active={tab === "imagery"} onClick={() => setTab("imagery")}>
          AI 配图
        </SubTab>
      </div>

      {tab === "creation" ? (
        <CreationTab
          prompt={prompt}
          setPrompt={setPrompt}
          model={model}
          webSearch={webSearch}
          setWebSearch={setWebSearch}
          onHotTopicClick={handleHotTopicClick}
          onSend={handleSend}
        />
      ) : (
        <ImageryTab />
      )}
      <span aria-hidden className="hidden">{articleId}</span>
    </div>
  );
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-md text-xs transition-colors",
        active
          ? "bg-white dark:bg-white/10 text-foreground font-medium shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CreationTab({
  prompt,
  setPrompt,
  model,
  webSearch,
  setWebSearch,
  onHotTopicClick,
  onSend,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  model: string;
  webSearch: boolean;
  setWebSearch: (v: boolean) => void;
  onHotTopicClick: (t: string) => void;
  onSend: () => void;
}) {
  return (
    <>
      {/* 中间：装饰头 + 热点列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="text-center py-5">
          <h3 className="text-xl font-bold text-foreground tracking-wide leading-snug">
            精彩内容，<br />
            从这里
            <span className="relative inline-block">
              起笔
              <svg
                className="absolute -bottom-1 left-0 w-full"
                viewBox="0 0 60 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 4C12 -1 24 1 36 4C48 7 54 1 60 3"
                  stroke="url(#wavy)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="wavy" x1="0" x2="60" y1="0" y2="0">
                    <stop offset="0" stopColor="#a855f7" />
                    <stop offset="1" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h3>
        </div>

        {/* 热点创作 list */}
        <div className="bg-gradient-to-b from-blue-50/60 to-violet-50/40 dark:from-blue-500/[0.06] dark:to-violet-500/[0.05] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-xs font-medium text-foreground">
              <span className="text-orange-500">🔥</span>
              热点创作
            </div>
            <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" />
              换一换
            </button>
          </div>
          <ol className="space-y-1">
            {MOCK_HOT_TOPICS.map((t, i) => (
              <li key={i}>
                <button
                  onClick={() => onHotTopicClick(t)}
                  className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
                >
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded",
                      i < 3
                        ? "text-orange-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[11px] leading-relaxed text-foreground truncate">{t}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* 底部 prompt 区 */}
      <div className="border-t border-[var(--glass-border)] p-3 shrink-0 space-y-2">
        <div className="flex items-center gap-1.5">
          <QuickChip icon={Sparkles}>热点创作</QuickChip>
          <QuickChip icon={FileText}>内容改写</QuickChip>
          <QuickChip icon={History}>历史版本</QuickChip>
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="可以选择模板或输入话题描述哦~"
            rows={3}
            className="w-full resize-none rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-400/30 placeholder:text-muted-foreground"
          />
          <button className="absolute right-2 top-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <FileText className="h-3 w-3" />
            模板
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground bg-muted/30 dark:bg-white/5">
              <Bot className="h-3 w-3" />
              {model}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={webSearch}
                onChange={(e) => setWebSearch(e.target.checked)}
                className="w-3 h-3 accent-blue-500"
              />
              联网搜索
            </label>
          </div>
          <button
            onClick={onSend}
            disabled={!prompt.trim()}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
              prompt.trim()
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-muted/40 text-muted-foreground",
            )}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center pt-1">
          内容由 AI 生成，无法确保真实准确，仅供参考
        </p>
      </div>
    </>
  );
}

function ImageryTab() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center text-muted-foreground">
      <Sparkles className="h-8 w-8 text-violet-400 mb-3" />
      <p className="text-sm font-medium text-foreground">AI 配图</p>
      <p className="text-xs mt-2 leading-relaxed">
        根据稿件正文自动生成配图、海报、封面图。<br />
        接入文生图 / 图生图 API 后启用。
      </p>
      <span className="mt-4 text-[10px] uppercase tracking-wider opacity-60">
        即将上线
      </span>
    </div>
  );
}

function QuickChip({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-500/[0.08] hover:bg-blue-100/60 dark:hover:bg-blue-500/15 transition-colors"
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}

void Send;
