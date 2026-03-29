"use client";

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Sparkles,
  Clock,
  Tag,
  Star,
  FolderOpen,
  Edit3,
  Save,
  SendHorizontal,
  ChevronRight,
  MessageCircle,
  BookOpen,
  Eye,
  FileText,
  Pencil,
  User,
  HelpCircle,
  Send,
  RefreshCw,
  Zap,
  Bot,
  CornerDownLeft,
  Lightbulb,
  ListChecks,
  Newspaper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateArticle, updateArticleStatus } from "@/app/actions/articles";
import type { ArticleDetail, CategoryNode, ChannelAdvisor } from "@/lib/types";

interface Props {
  article: ArticleDetail;
  categories: CategoryNode[];
  advisors: ChannelAdvisor[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  reviewing: { label: "审核中", color: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
  approved: { label: "已通过", color: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
  published: { label: "已发布", color: "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400" },
  archived: { label: "已归档", color: "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500" },
};

type AITab = "overview" | "qa" | "deep" | "notes";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

export default function ArticleEditClient({ article, categories, advisors }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [aiTab, setAiTab] = useState<AITab>("overview");

  // Edit state
  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(article.body || "");
  const [summary, setSummary] = useState(article.summary || "");
  const [categoryId, setCategoryId] = useState(article.categoryId || "");
  const [mediaType, setMediaType] = useState(article.mediaType || "article");

  // AI Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const statusCfg = statusConfig[article.status] || statusConfig.draft;
  const readingTime = useMemo(() => Math.max(1, Math.ceil((article.wordCount || body.length) / 500)), [article.wordCount, body.length]);

  // Generate key points from summary or body
  const keyPoints = useMemo(() => {
    const src = article.summary || article.body || "";
    if (!src) return [];
    const sentences = src.split(/[。！？\n]/).filter((s) => s.trim().length > 10);
    return sentences.slice(0, 4).map((s) => s.trim().replace(/^[，、\s]+/, "") + "。");
  }, [article.summary, article.body]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Quick actions for AI chat
  const quickActions = useMemo(() => [
    { icon: Lightbulb, label: "总结要点", prompt: "请总结这篇文章的核心要点" },
    { icon: ListChecks, label: "提炼观点", prompt: "请提炼这篇文章的主要观点" },
    { icon: Newspaper, label: "改写标题", prompt: "请为这篇文章生成3个更吸引人的标题" },
    { icon: HelpCircle, label: "提出问题", prompt: "请对这篇文章提出3个有深度的问题" },
  ], []);

  // Mock AI response generator (uses article content)
  const generateAIResponse = useCallback((userPrompt: string): string => {
    const lowerPrompt = userPrompt.toLowerCase();
    if (lowerPrompt.includes("总结") || lowerPrompt.includes("要点") || lowerPrompt.includes("概括")) {
      if (article.summary) return article.summary;
      const sentences = (article.body || "").split(/[。！？]/).filter((s) => s.trim().length > 10);
      return sentences.length > 0
        ? `本文核心要点：\n\n${sentences.slice(0, 3).map((s, i) => `${i + 1}. ${s.trim()}。`).join("\n")}`
        : `《${article.title}》是一篇${article.mediaType === "video" ? "视频" : "图文"}稿件，目前共 ${article.wordCount} 字。`;
    }
    if (lowerPrompt.includes("观点") || lowerPrompt.includes("提炼")) {
      const sentences = (article.body || "").split(/[。！？]/).filter((s) => s.trim().length > 15);
      return sentences.length > 2
        ? `文章主要观点：\n\n${sentences.slice(0, 4).map((s, i) => `• ${s.trim()}。`).join("\n")}`
        : "文章内容较短，建议补充更多内容后再提炼观点。";
    }
    if (lowerPrompt.includes("标题") || lowerPrompt.includes("改写")) {
      return `为您生成以下备选标题：\n\n1. 「深度」${article.title}\n2. 「解读」${article.title.slice(0, 15)}——多角度分析\n3. 「独家」${article.title.slice(0, 15)}背后的深层逻辑`;
    }
    if (lowerPrompt.includes("问题") || lowerPrompt.includes("提问")) {
      return `关于这篇文章，值得思考的问题：\n\n1. 文章的核心论点是否有充分的论据支撑？\n2. 对读者而言，最有价值的信息是什么？\n3. 从不同立场出发，如何看待文章的结论？`;
    }
    return `关于"${userPrompt.slice(0, 20)}"，基于文章《${article.title}》的内容：\n\n${article.summary || "这篇文章探讨了相关话题，建议仔细阅读正文获取更多信息。"}`;
  }, [article]);

  function handleChatSend(prompt?: string) {
    const text = prompt || chatInput.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiMsg: ChatMessage = { id: `a-${Date.now()}`, role: "ai", content: generateAIResponse(text), timestamp: new Date() };
      setChatMessages((prev) => [...prev, aiMsg]);
      setChatLoading(false);
    }, 800);
  }

  function handleSave() {
    startTransition(async () => {
      await updateArticle(article.id, { title, body, summary, categoryId: categoryId || undefined, mediaType });
    });
  }

  function handleSubmitReview() {
    startTransition(async () => {
      await updateArticle(article.id, { title, body, summary, categoryId: categoryId || undefined, mediaType });
      await updateArticleStatus(article.id, "reviewing");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 -m-6 overflow-hidden">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-5 h-12 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0">
        {/* Left: Back + breadcrumb */}
        <Link
          href="/articles"
          className="flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>返回</span>
        </Link>
        <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />
        <span className="text-[13px] text-gray-600 dark:text-gray-300 truncate max-w-[300px]">
          {article.title}
        </span>

        {/* Center: View mode toggles */}
        <div className="flex items-center gap-1 mx-auto">
          <button
            onClick={() => setMode("read")}
            className={cn(
              "flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] transition-colors",
              mode === "read"
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5"
            )}
          >
            <Eye size={13} />
            沉浸阅读
          </button>
          <button
            onClick={() => setMode("edit")}
            className={cn(
              "flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] transition-colors",
              mode === "edit"
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5"
            )}
          >
            <Pencil size={13} />
            编辑
          </button>
        </div>

        {/* Right: Status + Actions */}
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", statusCfg.color)}>
            {statusCfg.label}
          </span>
          {mode === "edit" && (
            <>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={isPending} className="h-7 text-xs">
                <Save size={13} className="mr-1" />
                保存
              </Button>
              {(article.status === "draft" || article.status === "approved") && (
                <Button size="sm" onClick={handleSubmitReview} disabled={isPending} className="h-7 text-xs">
                  <SendHorizontal size={13} className="mr-1" />
                  提交审核
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: AI Chat Panel ── */}
        <aside className="w-[380px] shrink-0 border-r border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl flex flex-col overflow-hidden hidden lg:flex">
          {/* Chat Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">AI 编辑助手</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">基于文章内容智能分析</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 ? (
              /* Welcome state with quick actions */
              <div className="space-y-4">
                {/* Welcome message */}
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} className="text-white" />
                  </div>
                  <div className="glass-card p-3 flex-1">
                    <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">
                      你好！我是这篇文章的 AI 助手。我已阅读《{article.title.slice(0, 20)}{article.title.length > 20 ? "..." : ""}》，可以帮你：
                    </p>
                    <ul className="mt-2 space-y-1">
                      <li className="text-[11px] text-gray-500 dark:text-gray-400">• 总结文章核心要点</li>
                      <li className="text-[11px] text-gray-500 dark:text-gray-400">• 提炼关键观点和论据</li>
                      <li className="text-[11px] text-gray-500 dark:text-gray-400">• 优化标题和摘要</li>
                      <li className="text-[11px] text-gray-500 dark:text-gray-400">• 回答关于文章内容的问题</li>
                    </ul>
                  </div>
                </div>

                {/* Quick Action Chips */}
                <div className="pl-8">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">快捷操作</p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.label}
                          onClick={() => handleChatSend(action.prompt)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-[11px] text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                        >
                          <Icon size={11} />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Chat conversation */
              chatMessages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "")}>
                  {msg.role === "ai" ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={12} className="text-white" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={12} className="text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] p-3 rounded-xl text-[12px] leading-relaxed whitespace-pre-line",
                      msg.role === "user"
                        ? "bg-blue-500 text-white rounded-tr-sm"
                        : "glass-card rounded-tl-sm text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {/* Loading indicator */}
            {chatLoading && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-white" />
                </div>
                <div className="glass-card px-4 py-2.5 rounded-xl rounded-tl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {/* Quick actions after conversation started */}
            {chatMessages.length > 0 && !chatLoading && (
              <div className="flex flex-wrap gap-1.5 pl-8">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleChatSend(action.prompt)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100/60 dark:bg-white/5 text-[10px] text-gray-500 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-white/10 transition-colors"
                    >
                      <Icon size={10} />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="px-3 py-3 border-t border-[var(--glass-border)]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100/60 dark:bg-white/5 focus-within:ring-2 focus-within:ring-blue-500/20 transition-shadow">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                placeholder="问一下关于这篇文章..."
                className="flex-1 bg-transparent text-[12px] text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
              />
              <button
                onClick={() => handleChatSend()}
                disabled={!chatInput.trim() || chatLoading}
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center transition-colors shrink-0",
                  chatInput.trim()
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "text-gray-300 dark:text-gray-600"
                )}
              >
                <CornerDownLeft size={12} />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Center: Reader / Editor ── */}
        <div className="flex-1 overflow-y-auto">
          {mode === "read" ? (
            /* Reading View */
            <article className="max-w-[680px] mx-auto px-8 py-10">
              {/* Title */}
              <h1 className="text-[28px] font-bold text-gray-900 dark:text-gray-100 leading-tight tracking-tight">
                {article.title}
              </h1>

              {/* Source info */}
              <div className="flex items-center gap-2 mt-4 mb-8 text-[13px] text-gray-400 dark:text-gray-500">
                {article.assigneeName && <span>{article.assigneeName}</span>}
                {article.categoryName && (
                  <>
                    {article.assigneeName && <span>·</span>}
                    <span>{article.categoryName}</span>
                  </>
                )}
                <span>·</span>
                <span>{new Date(article.updatedAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</span>
              </div>

              {/* Body */}
              <div className="article-reader text-[16px] text-gray-800 dark:text-gray-200 leading-[1.9] tracking-wide">
                {(article.body || "暂无正文内容").split("\n").map((para, i) => {
                  const trimmed = para.trim();
                  if (!trimmed) return <div key={i} className="h-4" />;
                  // Bold headers
                  if (trimmed.startsWith("#")) {
                    const text = trimmed.replace(/^#+\s*/, "");
                    return (
                      <h2 key={i} className="text-[18px] font-bold text-gray-900 dark:text-gray-100 mt-10 mb-4">
                        {text}
                      </h2>
                    );
                  }
                  if (/^[一二三四五六七八九十]+[、.]/.test(trimmed) || /^\*\*/.test(trimmed)) {
                    return (
                      <h3 key={i} className="text-[17px] font-bold text-gray-900 dark:text-gray-100 mt-8 mb-3">
                        {trimmed.replace(/\*\*/g, "")}
                      </h3>
                    );
                  }
                  return (
                    <p key={i} className="mb-5 text-justify indent-[2em]">
                      {trimmed}
                    </p>
                  );
                })}
              </div>
            </article>
          ) : (
            /* Edit View */
            <div className="max-w-[800px] mx-auto px-8 py-8 space-y-5">
              <div className="glass-card p-6 space-y-5">
                <div>
                  <Label htmlFor="title" className="mb-2 text-[13px]">标题</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="请输入稿件标题"
                    className="text-lg font-medium"
                  />
                </div>
                <div>
                  <Label htmlFor="body" className="mb-2 text-[13px]">正文</Label>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="请输入稿件正文内容..."
                    className="min-h-[400px] resize-y text-[15px] leading-[1.8]"
                  />
                </div>
                <div>
                  <Label htmlFor="summary" className="mb-2 text-[13px]">摘要</Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="请输入稿件摘要..."
                    className="min-h-[100px] resize-y"
                  />
                </div>
              </div>

              {/* Metadata in edit mode */}
              <div className="glass-card p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 text-[13px]">栏目</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="选择栏目" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-2 text-[13px]">媒体类型</Label>
                    <Select value={mediaType} onValueChange={setMediaType}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="选择类型" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="article">图文</SelectItem>
                        <SelectItem value="video">视频</SelectItem>
                        <SelectItem value="audio">音频</SelectItem>
                        <SelectItem value="h5">H5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: AI Panel ── */}
        <aside className="w-[320px] shrink-0 border-l border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl flex flex-col overflow-hidden hidden xl:flex">
          {/* AI Panel Header */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-blue-500" />
                <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">AI 智能解读</span>
              </div>
              <button className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600 transition-colors">
                <RefreshCw size={12} />
                重生成
              </button>
            </div>

            {/* AI Tabs */}
            <div className="flex gap-0.5 p-0.5 bg-gray-100/60 dark:bg-white/5 rounded-lg">
              {([
                { key: "overview" as const, label: "概览" },
                { key: "qa" as const, label: "问答" },
                { key: "deep" as const, label: "精读" },
                { key: "notes" as const, label: "批注" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAiTab(tab.key)}
                  className={cn(
                    "flex-1 py-1.5 text-[12px] rounded-md transition-all",
                    aiTab === tab.key
                      ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 font-medium shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {aiTab === "overview" && (
              <div className="space-y-4">
                {/* AI Quick Read */}
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-amber-500" />
                      <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">AI 快读</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                      <Clock size={11} />
                      {readingTime} 分钟
                    </div>
                  </div>

                  {/* Summary */}
                  {article.summary ? (
                    <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-relaxed mb-3">
                      {article.summary}
                    </p>
                  ) : (
                    <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-relaxed mb-3">
                      {article.title}
                    </p>
                  )}

                  {/* Key Points */}
                  {keyPoints.length > 0 && (
                    <ul className="space-y-2.5">
                      {keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-2">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]",
                            i === 0 ? "bg-blue-500" : i === 1 ? "bg-green-500" : i === 2 ? "bg-amber-500" : "bg-purple-500"
                          )} />
                          <span className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">
                            {point}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Tags */}
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--glass-border)]">
                      {article.tags.map((tag) => (
                        <span key={tag} className="text-[11px] text-gray-500 dark:text-gray-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Key Questions */}
                <div className="glass-card-interactive p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 relative z-10">
                      <HelpCircle size={15} className="text-amber-500" />
                      <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">进入关键问题</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 relative z-10" />
                  </div>
                  <p className="relative z-10 text-[12px] text-gray-500 dark:text-gray-400 mt-1.5">
                    用 3 个问题带你把文章读"透"。
                  </p>
                </div>

                {/* Article Info */}
                <div className="space-y-2.5 pt-2">
                  <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">稿件信息</p>
                  {article.assigneeName && (
                    <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                      <User size={13} className="text-gray-400" />
                      <span>负责人：{article.assigneeName}</span>
                    </div>
                  )}
                  {article.categoryName && (
                    <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                      <FolderOpen size={13} className="text-gray-400" />
                      <span>栏目：{article.categoryName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                    <BookOpen size={13} className="text-gray-400" />
                    <span>字数：{article.wordCount || body.length}</span>
                  </div>
                </div>
              </div>
            )}

            {aiTab === "qa" && (
              <div className="space-y-3">
                {/* Advisor Notes as Q&A */}
                {article.advisorNotes && article.advisorNotes.length > 0 ? (
                  article.advisorNotes.map((note, i) => {
                    const advisor = advisors[i % Math.max(advisors.length, 1)];
                    return (
                      <div key={i} className="glass-card p-3">
                        {advisor && (
                          <p className="text-[11px] font-medium text-purple-600 dark:text-purple-400 mb-1.5">{advisor.name}</p>
                        )}
                        <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">{note}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center py-12 text-gray-400 dark:text-gray-500">
                    <MessageCircle size={32} className="mb-2 opacity-40" />
                    <p className="text-[12px]">暂无问答记录</p>
                  </div>
                )}
              </div>
            )}

            {aiTab === "deep" && (
              <div className="flex flex-col items-center py-12 text-gray-400 dark:text-gray-500">
                <BookOpen size={32} className="mb-2 opacity-40" />
                <p className="text-[12px]">精读分析即将推出</p>
              </div>
            )}

            {aiTab === "notes" && (
              <div className="flex flex-col items-center py-12 text-gray-400 dark:text-gray-500">
                <Edit3 size={32} className="mb-2 opacity-40" />
                <p className="text-[12px]">暂无批注</p>
              </div>
            )}
          </div>

          {/* AI Input */}
          <div className="px-4 py-3 border-t border-[var(--glass-border)]">
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-gray-100/60 dark:bg-white/5">
              <input
                type="text"
                placeholder="对解读有疑问？继续追问 AI..."
                className="flex-1 bg-transparent text-[12px] text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
              />
              <Send size={14} className="text-gray-400 dark:text-gray-500 cursor-pointer hover:text-blue-500 transition-colors" />
            </div>
          </div>
        </aside>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="flex items-center justify-center gap-8 h-10 border-t border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0">
        <button className="flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <Tag size={13} />
          添加标签...
        </button>
        <button className="flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <Star size={13} />
          设为星标
        </button>
        <button className="flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <FolderOpen size={13} />
          {article.categoryName || "未分类"}
        </button>
      </div>
    </div>
  );
}
