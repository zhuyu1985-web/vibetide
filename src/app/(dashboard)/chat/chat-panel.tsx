"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import {
  CollapsibleMessageContent,
  markdownComponents,
  remarkPlugins,
} from "@/app/(dashboard)/employee/[id]/collapsible-markdown";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Plus,
  Loader2,
  Globe,
  CheckCircle2,
  ChevronDown,
  BookOpen,
  type LucideIcon,
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  Lightbulb,
  Users,
  CalendarDays,
  Package,
  FolderOpen,
  PenTool,
  Type,
  Film,
  RefreshCw,
  Image,
  Music,
  CheckCircle,
  Shield,
  TrendingUp,
  RotateCcw,
  Radio,
  Zap,
} from "lucide-react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { AIEmployee, ScenarioCardData } from "@/lib/types";
import type { ChatMessage, ThinkingStep, SkillUsed } from "@/lib/chat-utils";
import type { SavedConversationRow } from "@/db/types";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  BookOpen,
  Lightbulb,
  Users,
  CalendarDays,
  Package,
  FolderOpen,
  PenTool,
  Type,
  Film,
  RefreshCw,
  Image,
  Music,
  CheckCircle,
  Shield,
  TrendingUp,
  RotateCcw,
  Radio,
  Zap,
};

/* ── Build a rounded-rect SVG path starting from top-center, clockwise ── */
function buildBorderPath(w: number, h: number, r: number): string {
  const i = 0.5;
  const R = Math.min(r, (w - 2 * i) / 2, (h - 2 * i) / 2);
  const x1 = i + R;
  const x2 = w - i - R;
  const y1 = i + R;
  const y2 = h - i - R;
  const cx = w / 2;
  return [
    `M${cx},${i}`,
    `H${x2}`,
    `A${R},${R} 0 0,1 ${w - i},${y1}`,
    `V${y2}`,
    `A${R},${R} 0 0,1 ${x2},${h - i}`,
    `H${x1}`,
    `A${R},${R} 0 0,1 ${i},${y2}`,
    `V${y1}`,
    `A${R},${R} 0 0,1 ${x1},${i}`,
    "Z",
  ].join(" ");
}

interface ChatPanelProps {
  employee: AIEmployee | null;
  messages: ChatMessage[];
  scenarios: ScenarioCardData[];
  activeScenario: ScenarioCardData | null;
  viewingSaved: SavedConversationRow | null;
  isSaved: boolean;
  loading: boolean;
  onSendMessage: (text: string) => void;
  onSelectScenario: (scenario: ScenarioCardData) => void;
  onSave: () => void;
  onNewChat: () => void;
  currentThinking: ThinkingStep[];
  currentSkillsUsed: SkillUsed[];
  currentSources: string[];
  currentRefCount: number;
  isStreaming: boolean;
}

export function ChatPanel({
  employee,
  messages,
  scenarios,
  activeScenario,
  viewingSaved,
  isSaved,
  loading,
  onSendMessage,
  onSelectScenario,
  onSave,
  onNewChat,
  currentThinking,
  currentSkillsUsed,
  currentSources,
  currentRefCount,
  isStreaming,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [inputHovered, setInputHovered] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [borderDone, setBorderDone] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [borderSize, setBorderSize] = useState({ w: 0, h: 0 });

  const chatBodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const borderBoxRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const meta = employee
    ? EMPLOYEE_META[employee.id as EmployeeId]
    : null;

  /* ── Border animation logic ── */
  const borderActive = inputHovered || inputFocused;

  const stopAnim = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const el = borderBoxRef.current;
    if (!el) return;
    const measure = () =>
      setBorderSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [employee?.id]);

  useEffect(() => {
    if (!borderActive) {
      if (!inputFocused) {
        stopAnim();
        setBorderDone(false);
        if (pathRef.current) pathRef.current.style.strokeDashoffset = "1";
        if (glowRef.current) {
          glowRef.current.style.strokeDashoffset = "0";
          glowRef.current.style.opacity = "0";
        }
      }
      return;
    }
    if (borderDone) return;

    let startTs = 0;
    const duration = 1800;

    function tick(ts: number) {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      if (pathRef.current) {
        pathRef.current.style.strokeDashoffset = String(1 - progress);
      }
      if (glowRef.current) {
        if (progress < 1) {
          glowRef.current.style.strokeDashoffset = String(-progress);
          glowRef.current.style.opacity = "1";
        } else {
          glowRef.current.style.opacity = "0";
        }
      }
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setBorderDone(true);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => stopAnim();
  }, [borderActive, borderDone, inputFocused, stopAnim]);

  /* ── Scroll detection ── */
  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distanceFromBottom > 100);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [employee?.id]);

  /* ── Auto-scroll (use scrollTop to avoid scrollIntoView bubbling to outer containers) ── */
  useEffect(() => {
    const el = chatBodyRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading, currentThinking]);

  const scrollToBottom = () => {
    const el = chatBodyRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  };

  /* ── Auto-resize textarea ── */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputText]);

  const handleSend = () => {
    if (!inputText.trim() || loading || !!viewingSaved) return;
    onSendMessage(inputText.trim());
    setInputText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  /* ── Check if last message is streaming ── */
  const lastMsg = messages[messages.length - 1];
  const isLastMsgStreaming =
    loading &&
    lastMsg?.role === "assistant" &&
    lastMsg.content &&
    !lastMsg.durationMs;

  if (!employee) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto">
            <Sparkles size={24} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            选择一位AI员工开始对话
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/30 via-slate-50/60 to-slate-50/40 dark:from-blue-950/10 dark:via-gray-900/50 dark:to-gray-900/30 pointer-events-none" />

      {/* ── Header ── */}
      <div className="relative flex items-center gap-3 px-6 py-3 border-b border-gray-300/50 dark:border-gray-600/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <EmployeeAvatar
          employeeId={employee.id}
          size="md"
          showStatus
          status={employee.status}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {employee.nickname}
          </h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
            {employee.title}
            {activeScenario && (
              <span className="text-blue-500 dark:text-blue-400 ml-2">
                · {activeScenario.name}
              </span>
            )}
          </p>
        </div>

        {viewingSaved && (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            收藏对话 · 只读
          </span>
        )}

        {!viewingSaved && messages.length > 0 && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 border-0"
            onClick={onSave}
          >
            {isSaved ? (
              <BookmarkCheck size={15} className="text-blue-500" />
            ) : (
              <Bookmark size={15} />
            )}
            {isSaved ? "已收藏" : "收藏"}
          </button>
        )}

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 border-0"
          onClick={onNewChat}
        >
          <Plus size={15} />
          新对话
        </button>
      </div>

      {/* Scenario bar removed from here — moved to above input bar */}

      {/* ── Message list ── */}
      <div ref={chatBodyRef} className="relative flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">
          {messages.length === 0 && !loading ? (
            /* ── Empty state greeting ── */
            <div className="flex flex-col items-center justify-center py-12">
              <EmployeeAvatar
                employeeId={employee.id}
                size="xl"
                className="mb-4"
              />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                你好，我是{employee.nickname}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                {employee.motto || `${employee.title}，随时为你服务`}
              </p>

              {/* Scenario suggestions */}
              {!viewingSaved && scenarios.length > 0 && (
                <div className="w-full max-w-lg space-y-2">
                  <p className="text-xs text-gray-400 mb-2 text-center">
                    试试以下场景，或直接输入你的问题
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {scenarios.slice(0, 4).map((s) => {
                      const Icon = ICON_MAP[s.icon] || Sparkles;
                      return (
                        <button
                          key={s.id}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-800/60 text-left transition-all duration-200 group border-0"
                          onClick={() => onSelectScenario(s)}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              backgroundColor: meta?.bgColor ?? "rgba(59,130,246,0.12)",
                            }}
                          >
                            <Icon
                              size={15}
                              style={{ color: meta?.color ?? "#3b82f6" }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {s.name}
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-2 mt-0.5">
                              {s.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Messages ── */
            <>
              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[75%] bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 text-sm leading-relaxed shadow-sm shadow-blue-500/20">
                      {msg.content}
                    </div>
                  </div>
                ) : !msg.content && !msg.durationMs ? null : (
                  <div key={i} className="flex gap-3">
                    <EmployeeAvatar
                      employeeId={employee.id}
                      size="sm"
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      {/* Status header */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {msg.durationMs ? (
                          <CheckCircle2
                            size={14}
                            className="text-blue-500"
                          />
                        ) : (
                          <Loader2
                            size={14}
                            className="animate-spin text-blue-500"
                          />
                        )}
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {msg.durationMs
                            ? `${employee.nickname}思考完成`
                            : `${employee.nickname}正在输出...`}
                        </span>
                        {msg.durationMs &&
                          msg.referenceCount != null &&
                          msg.referenceCount > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <BookOpen size={12} />
                              引用{msg.referenceCount}篇资料作为参考
                            </span>
                          )}
                        {msg.durationMs && (
                          <span className="text-[11px] text-gray-400">
                            耗时 {(msg.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* Skills used */}
                      {(() => {
                        const skills = msg.durationMs
                          ? msg.skillsUsed
                          : i === messages.length - 1
                            ? currentSkillsUsed
                            : undefined;
                        return skills && skills.length > 0 ? (
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <span className="text-[11px] text-gray-400 mr-0.5">
                              使用技能
                            </span>
                            {skills.map((s) => (
                              <span
                                key={s.tool}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[11px] text-violet-600 dark:text-violet-400",
                                  !msg.durationMs &&
                                    "animate-in fade-in zoom-in-95 duration-200"
                                )}
                              >
                                <Sparkles size={10} />
                                {s.skillName}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}

                      {/* Source tags */}
                      {msg.durationMs &&
                        msg.sources &&
                        msg.sources.length > 0 && (
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            {msg.sources.slice(0, 6).map((src) => (
                              <span
                                key={src}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[11px] text-blue-600 dark:text-blue-400"
                              >
                                <Globe size={10} />
                                {src}
                              </span>
                            ))}
                            {msg.sources.length > 6 && (
                              <span className="text-[11px] text-gray-400">
                                +{msg.sources.length - 6}个来源
                              </span>
                            )}
                          </div>
                        )}

                      {/* Message content */}
                      {msg.content && (
                        <div className="bg-gradient-to-br from-white/80 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30">
                          <div className="px-5 py-4">
                            {msg.durationMs ? (
                              <CollapsibleMessageContent
                                markdown={msg.content}
                              />
                            ) : (
                              <div
                                className={cn(
                                  "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100 [&_code]:text-xs [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
                                  isLastMsgStreaming &&
                                    i === messages.length - 1 &&
                                    "streaming-text"
                                )}
                              >
                                <ReactMarkdown
                                  remarkPlugins={remarkPlugins}
                                  components={markdownComponents}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                                {isLastMsgStreaming &&
                                  i === messages.length - 1 && (
                                    <span className="streaming-cursor-dot" />
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* ── Thinking indicator (before text arrives) ── */}
              {loading &&
                messages.length > 0 &&
                !messages[messages.length - 1].content && (
                  <div className="flex gap-3">
                    <EmployeeAvatar
                      employeeId={employee.id}
                      size="sm"
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Loader2
                          size={14}
                          className="animate-spin text-blue-500"
                        />
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {employee.nickname}正在思考...
                        </span>
                        {currentRefCount > 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <BookOpen size={12} />
                            已引用{currentRefCount}篇资料
                          </span>
                        )}
                      </div>

                      {/* Thinking steps */}
                      {currentThinking.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {currentThinking.map((step, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-left-2 duration-300"
                            >
                              <div className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                              <span>{step.label}</span>
                              {idx === currentThinking.length - 1 && (
                                <Loader2
                                  size={10}
                                  className="animate-spin text-gray-400"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Live skills during thinking */}
                      {currentSkillsUsed.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <span className="text-[11px] text-gray-400 mr-0.5">
                            使用技能
                          </span>
                          {currentSkillsUsed.map((s) => (
                            <span
                              key={s.tool}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[11px] text-violet-600 dark:text-violet-400 animate-in fade-in zoom-in-95 duration-200"
                            >
                              <Sparkles size={10} />
                              {s.skillName}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Live sources during thinking */}
                      {currentSources.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          {currentSources.slice(0, 6).map((src) => (
                            <span
                              key={src}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[11px] text-blue-600 dark:text-blue-400 animate-in fade-in zoom-in-95 duration-200"
                            >
                              <Globe size={10} />
                              {src}
                            </span>
                          ))}
                          {currentSources.length > 6 && (
                            <span className="text-[11px] text-gray-400">
                              +{currentSources.length - 6}个来源
                            </span>
                          )}
                        </div>
                      )}

                      <div className="bg-gradient-to-br from-white/80 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </>
          )}
          <div />
        </div>

        {/* Scroll to bottom button */}
        {showScrollDown && messages.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer animate-in fade-in zoom-in-95 duration-200 border-0"
          >
            <ChevronDown
              size={18}
              className="text-gray-500 dark:text-gray-400"
            />
          </button>
        )}
      </div>

      {/* ── Bottom input bar (pinned) ── */}
      {!viewingSaved && (
        <div className="relative flex-shrink-0">
          {/* Scenario quick-action chips — always visible like DingTalk action bar */}
          {scenarios.length > 0 && (
            <div className="flex items-center gap-1.5 px-5 pt-2.5 pb-1 overflow-x-auto scrollbar-hide">
              {scenarios.map((s) => {
                const Icon = ICON_MAP[s.icon] || Sparkles;
                return (
                  <button
                    key={s.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100/80 dark:bg-gray-800/60 text-[11px] text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 flex-shrink-0 border-0"
                    onClick={() => onSelectScenario(s)}
                  >
                    <Icon size={12} />
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}

          <div className="px-5 pt-1.5 pb-3">
            <div
              ref={borderBoxRef}
              className="relative rounded-2xl p-[1px]"
              onMouseEnter={() => setInputHovered(true)}
              onMouseLeave={() => setInputHovered(false)}
            >
              {/* SVG border-draw animation */}
              {borderSize.w > 0 && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${borderSize.w} ${borderSize.h}`}
                  fill="none"
                >
                  <defs>
                    <filter id="chat-border-glow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    ref={pathRef}
                    d={buildBorderPath(borderSize.w, borderSize.h, 16)}
                    className="stroke-blue-400 dark:stroke-blue-500"
                    strokeWidth="1"
                    pathLength={1}
                    strokeDasharray="1"
                    strokeDashoffset="1"
                  />
                  <path
                    ref={glowRef}
                    d={buildBorderPath(borderSize.w, borderSize.h, 16)}
                    className="stroke-blue-500 dark:stroke-blue-400"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="0.04 0.96"
                    strokeDashoffset="0"
                    filter="url(#chat-border-glow)"
                    opacity="0"
                  />
                </svg>
              )}

              {/* Static gray border */}
              <div
                className={cn(
                  "absolute inset-0 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 pointer-events-none transition-opacity duration-200",
                  borderActive || borderDone ? "opacity-0" : "opacity-100"
                )}
              />

              {/* Inner content */}
              <div className="relative rounded-[15px] bg-white dark:bg-gray-800">
                <textarea
                  ref={textareaRef}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 resize-none px-4 pt-3 pb-1 border-0 min-h-[72px]"
                  rows={3}
                  placeholder={`和${employee.nickname}自由对话...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="flex items-center justify-between px-4 pb-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Globe size={14} className="text-blue-500" />
                    <span>联网搜索</span>
                  </div>
                  <button
                    className={cn(
                      "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 border-0",
                      inputText.trim() && !loading
                        ? "bg-blue-500 text-white cursor-pointer shadow-sm"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                    )}
                    onClick={handleSend}
                    disabled={loading || !inputText.trim()}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
