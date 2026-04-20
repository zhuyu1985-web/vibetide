"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import {
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Globe,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { CollapsibleMessageContent, markdownComponents, remarkPlugins } from "./collapsible-markdown";
import type { ScenarioCardData } from "@/lib/types";
import { normalizeFieldOption } from "@/lib/types";

const ICON_MAP: Record<string, LucideIcon> = {
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
};

interface ThinkingStep {
  tool: string;
  label: string;
  skillName?: string;
}

interface SkillUsed {
  tool: string;
  skillName: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  durationMs?: number;
  thinkingSteps?: ThinkingStep[];
  skillsUsed?: SkillUsed[];
  sources?: string[];
  referenceCount?: number;
}

interface ScenarioChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: ScenarioCardData | null;
  scenarios: ScenarioCardData[];
  employeeDbId: string;
  employeeSlug: string;
  employeeNickname: string;
}

/** Parse SSE events from a text buffer. Returns parsed events and remaining buffer. */
function parseSSE(buffer: string) {
  const events: { event: string; data: string }[] = [];
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() || ""; // last incomplete chunk

  for (const part of parts) {
    if (!part.trim()) continue;
    let eventType = "";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) eventType = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (eventType && data) {
      events.push({ event: eventType, data });
    }
  }

  return { events, remaining };
}

/** Build a rounded-rect SVG path starting from top-center, clockwise. */
function buildBorderPath(w: number, h: number, r: number): string {
  const i = 0.5; // inset half of stroke-width so the 1px stroke stays inside
  const R = Math.min(r, (w - 2 * i) / 2, (h - 2 * i) / 2);
  const x1 = i + R;
  const x2 = w - i - R;
  const y1 = i + R;
  const y2 = h - i - R;
  const cx = w / 2;
  return [
    `M${cx},${i}`,
    `H${x2}`, `A${R},${R} 0 0,1 ${w - i},${y1}`,
    `V${y2}`, `A${R},${R} 0 0,1 ${x2},${h - i}`,
    `H${x1}`, `A${R},${R} 0 0,1 ${i},${y2}`,
    `V${y1}`, `A${R},${R} 0 0,1 ${x1},${i}`,
    "Z",
  ].join(" ");
}

export function ScenarioChatSheet({
  open,
  onOpenChange,
  scenario,
  scenarios,
  employeeDbId,
  employeeSlug,
  employeeNickname,
}: ScenarioChatSheetProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [started, setStarted] = useState(false);
  const [inputHovered, setInputHovered] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [borderDone, setBorderDone] = useState(false);
  // Thinking state for the current streaming message
  const [currentThinking, setCurrentThinking] = useState<ThinkingStep[]>([]);
  const [currentSkillsUsed, setCurrentSkillsUsed] = useState<SkillUsed[]>([]);
  const [currentSources, setCurrentSources] = useState<string[]>([]);
  const [currentRefCount, setCurrentRefCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const borderBoxRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const [borderSize, setBorderSize] = useState({ w: 0, h: 0 });

  // Border-draw animation: sweep once then stay
  const borderActive = inputHovered || inputFocused;

  const stopAnim = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
  }, []);

  // Measure border container for SVG viewBox
  useEffect(() => {
    const el = borderBoxRef.current;
    if (!el) return;
    const measure = () => setBorderSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [started]);

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

  useEffect(() => {
    if (open) {
      // Pre-select first option for select fields so required validation passes
      const defaults: Record<string, string> = {};
      if (scenario) {
        for (const field of scenario.inputFields) {
          if (field.type === "select" && field.options?.length) {
            defaults[field.name] = normalizeFieldOption(field.options[0]).value;
          }
        }
      }
      setInputs(defaults);
      setMessages([]);
      setStarted(false);
      setFollowUp("");
      setInputHovered(false);
      setInputFocused(false);
      setBorderDone(false);
      setCurrentThinking([]);
      setCurrentSkillsUsed([]);
      setCurrentSources([]);
      setCurrentRefCount(0);
      setIsStreaming(false);
    }
  }, [open, scenario?.id]);

  // Detect if user has scrolled up from bottom
  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distanceFromBottom > 100);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [started]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, currentThinking]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!scenario) return null;

  const handleExecute = async (
    userContent: string,
    inputValues: Record<string, string>,
    history?: ChatMessage[]
  ) => {
    const userMsg: ChatMessage = { role: "user", content: userContent };
    const allMessages = history ? [...history, userMsg] : [userMsg];
    const assistantIdx = allMessages.length;
    setMessages([...allMessages, { role: "assistant", content: "" }]);
    setLoading(true);
    setIsStreaming(false);
    setCurrentThinking([]);
    setCurrentSkillsUsed([]);
    setCurrentSources([]);
    setCurrentRefCount(0);

    const startTime = Date.now();
    const thinkingSteps: ThinkingStep[] = [];
    const skillsUsed: SkillUsed[] = [];
    const skillSet = new Set<string>();
    const sources: string[] = [];
    let refCount = 0;

    try {
      const res = await fetch("/api/scenarios/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeDbId,
          scenarioId: scenario.id,
          userInputs: inputValues,
          conversationHistory: history ? allMessages.slice(-10) : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error((await res.text()) || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let accumulated = "";
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const { events, remaining } = parseSSE(sseBuffer);
        sseBuffer = remaining;

        for (const evt of events) {
          try {
            const payload = JSON.parse(evt.data);

            switch (evt.event) {
              case "thinking": {
                const step: ThinkingStep = {
                  tool: payload.tool,
                  label: payload.label,
                  skillName: payload.skillName,
                };
                thinkingSteps.push(step);
                setCurrentThinking([...thinkingSteps]);
                // Track unique skills used — update live UI
                if (payload.skillName && !skillSet.has(payload.tool)) {
                  skillSet.add(payload.tool);
                  skillsUsed.push({ tool: payload.tool, skillName: payload.skillName });
                  setCurrentSkillsUsed([...skillsUsed]);
                }
                break;
              }
              case "source": {
                const newSources = payload.sources as string[];
                for (const s of newSources) {
                  if (!sources.includes(s)) sources.push(s);
                }
                refCount = payload.totalReferences ?? refCount;
                setCurrentSources([...sources]);
                setCurrentRefCount(refCount);
                break;
              }
              case "text-delta": {
                setIsStreaming(true);
                accumulated += payload.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[assistantIdx] = {
                    role: "assistant",
                    content: accumulated,
                  };
                  return updated;
                });
                break;
              }
              case "done": {
                refCount = payload.referenceCount ?? refCount;
                const finalSources = (payload.sources as string[]) ?? sources;
                setCurrentRefCount(refCount);
                setCurrentSources(finalSources);
                // Merge server-side skills info if available
                if (Array.isArray(payload.skillsUsed)) {
                  for (const s of payload.skillsUsed as SkillUsed[]) {
                    if (!skillSet.has(s.tool)) {
                      skillSet.add(s.tool);
                      skillsUsed.push(s);
                    }
                  }
                }
                break;
              }
              case "error": {
                throw new Error(payload.message || "未知错误");
              }
            }
          } catch (parseErr) {
            // Skip malformed SSE events silently
            if (
              parseErr instanceof Error &&
              parseErr.message !== "未知错误" &&
              !evt.data.startsWith("{")
            ) {
              continue;
            }
            throw parseErr;
          }
        }
      }

      const durationMs = Date.now() - startTime;
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = {
          role: "assistant",
          content: accumulated,
          durationMs,
          thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
          skillsUsed: skillsUsed.length > 0 ? skillsUsed : undefined,
          sources: sources.length > 0 ? sources : undefined,
          referenceCount: refCount > 0 ? refCount : undefined,
        };
        return updated;
      });
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = {
          role: "assistant",
          content: `执行出错：${err instanceof Error ? err.message : "未知错误"}`,
        };
        return updated;
      });
    } finally {
      setLoading(false);
      setIsStreaming(false);
      setCurrentThinking([]);
      setCurrentSkillsUsed([]);
      setCurrentSources([]);
      setCurrentRefCount(0);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleStart = async () => {
    for (const field of scenario.inputFields) {
      if (field.required && !inputs[field.name]?.trim()) return;
    }
    setStarted(true);
    const inputSummary = scenario.inputFields
      .map((f) => `${f.label}: ${inputs[f.name] || "全部"}`)
      .join("，");
    await handleExecute(inputSummary, inputs);
  };

  const handleFollowUp = async () => {
    if (!followUp.trim() || loading) return;
    const text = followUp.trim();
    setFollowUp("");
    await handleExecute(text, inputs, messages);
  };

  const handleClear = () => {
    setMessages([]);
    setStarted(false);
    setInputs({});
    setFollowUp("");
  };

  // Quick actions from other scenarios (with icons)
  const quickActions = scenarios
    .filter((s) => s.id !== scenario.id);

  // Check if the last message is currently streaming (has content but no durationMs)
  const lastMsg = messages[messages.length - 1];
  const isLastMsgStreaming =
    loading && lastMsg?.role === "assistant" && lastMsg.content && !lastMsg.durationMs;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[60vw] min-w-[640px] max-w-[960px] sm:max-w-[960px] flex flex-col p-0 gap-0 overflow-visible"
        showCloseButton={false}
      >
        {/* ── Collapse button (left edge, circular with shadow) ── */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 w-11 h-11 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.18)] hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ChevronRight size={18} className="text-gray-500 dark:text-gray-400 ml-0.5" />
        </button>

        {/* ── Gradient background layer ── */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-slate-50/80 to-slate-50/60 dark:from-blue-950/20 dark:via-gray-900 dark:to-gray-900 pointer-events-none" />

        {/* ── Header ── */}
        <div className="relative flex items-center gap-3 px-6 py-3.5 border-b border-gray-200/40 dark:border-gray-700/40">
          <EmployeeAvatar employeeId={employeeSlug} size="sm" />
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-sm font-semibold">
              {employeeNickname} · {scenario.name}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {scenario.description}
            </SheetDescription>
          </div>
          <span className="text-[11px] text-gray-400">场景助手</span>
        </div>

        {/* ── Chat body (scrollable) ── */}
        <div ref={chatBodyRef} className="relative flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {!started ? (
              /* ── Initial form as AI message ── */
              <div className="flex gap-3">
                <EmployeeAvatar
                  employeeId={employeeSlug}
                  size="sm"
                  className="mt-0.5 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                    <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
                      {scenario.description}，请设置以下参数开始执行：
                    </p>
                    <div className="space-y-3">
                      {scenario.inputFields.map((field) => (
                        <div key={field.name} className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {field.label}
                            {field.required && (
                              <span className="text-red-500 ml-0.5">*</span>
                            )}
                          </Label>
                          {field.type === "select" && field.options ? (
                            <div className="flex flex-wrap gap-2">
                              {field.options.map((opt) => {
                                const o = normalizeFieldOption(opt);
                                return (
                                  <button
                                    key={o.value}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                      inputs[field.name] === o.value
                                        ? "bg-blue-500 text-white shadow-sm"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                                    }`}
                                    onClick={() =>
                                      setInputs((prev) => ({
                                        ...prev,
                                        [field.name]: o.value,
                                      }))
                                    }
                                  >
                                    {o.label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : field.type === "textarea" ? (
                            <Textarea
                              className="border-0 bg-gray-100 dark:bg-gray-700 resize-none text-sm"
                              rows={2}
                              placeholder={field.placeholder}
                              value={inputs[field.name] || ""}
                              onChange={(e) =>
                                setInputs((prev) => ({
                                  ...prev,
                                  [field.name]: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <Input
                              className="border-0 bg-gray-100 dark:bg-gray-700 text-sm"
                              placeholder={field.placeholder}
                              value={inputs[field.name] || ""}
                              onChange={(e) =>
                                setInputs((prev) => ({
                                  ...prev,
                                  [field.name]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing) handleStart();
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      className="mt-4 border-0 gap-2"
                      size="sm"
                      onClick={handleStart}
                      disabled={loading}
                    >
                      <Sparkles size={14} />
                      开始执行
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Chat messages ── */
              <>
                {messages.map((msg, i) =>
                  msg.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[75%] bg-blue-500 text-white rounded-2xl rounded-tr-sm px-5 py-3 text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ) : !msg.content && !msg.durationMs ? null : (
                    <div key={i} className="flex gap-3">
                      <EmployeeAvatar
                        employeeId={employeeSlug}
                        size="sm"
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        {/* Status header */}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {msg.durationMs ? (
                            <CheckCircle2 size={14} className="text-blue-500" />
                          ) : (
                            <Loader2 size={14} className="animate-spin text-blue-500" />
                          )}
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            {msg.durationMs
                              ? `${employeeNickname}思考完成`
                              : `${employeeNickname}正在输出...`}
                          </span>
                          {/* Reference info (completed message) */}
                          {msg.durationMs && msg.referenceCount && msg.referenceCount > 0 && (
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

                        {/* Skills used (completed or streaming) */}
                        {(() => {
                          const skills = msg.durationMs
                            ? msg.skillsUsed
                            : i === messages.length - 1 ? currentSkillsUsed : undefined;
                          return skills && skills.length > 0 ? (
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              <span className="text-[11px] text-gray-400 mr-0.5">使用技能</span>
                              {skills.map((s) => (
                                <span
                                  key={s.tool}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[11px] text-violet-600 dark:text-violet-400${
                                    !msg.durationMs ? " animate-in fade-in zoom-in-95 duration-200" : ""
                                  }`}
                                >
                                  <Sparkles size={10} />
                                  {s.skillName}
                                </span>
                              ))}
                            </div>
                          ) : null;
                        })()}

                        {/* Source tags (completed message) */}
                        {msg.durationMs && msg.sources && msg.sources.length > 0 && (
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
                          <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                            <div className="px-5 py-4">
                              {msg.durationMs ? (
                                <CollapsibleMessageContent markdown={msg.content} />
                              ) : (
                                <div className={`prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100 [&_code]:text-xs [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded${
                                  isLastMsgStreaming && i === messages.length - 1
                                    ? " streaming-text"
                                    : ""
                                }`}>
                                  <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>{msg.content}</ReactMarkdown>
                                  {isLastMsgStreaming && i === messages.length - 1 && (
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

                {/* ── Thinking indicator (before any text arrives) ── */}
                {loading && messages.length > 0 && !messages[messages.length - 1].content && (
                  <div className="flex gap-3">
                    <EmployeeAvatar
                      employeeId={employeeSlug}
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
                          {employeeNickname}正在思考...
                        </span>
                        {/* Live reference count during thinking */}
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
                                <Loader2 size={10} className="animate-spin text-gray-400" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Live skills used during thinking */}
                      {currentSkillsUsed.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <span className="text-[11px] text-gray-400 mr-0.5">使用技能</span>
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

                      {/* Live source tags during thinking */}
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

                      <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
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
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button */}
          {showScrollDown && started && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer animate-in fade-in zoom-in-95 duration-200"
            >
              <ChevronDown size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>

        {/* ── Bottom bar ── */}
        <div className="relative">
          {/* Quick action pills (above input) */}
          {started && (
            <div className="px-6 pt-3 pb-2 flex items-center gap-2.5 flex-wrap">
              {quickActions.map((s) => {
                const Icon = ICON_MAP[s.icon] || Sparkles;
                return (
                  <button
                    key={s.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/80 dark:bg-gray-800/60 text-xs text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
                    onClick={() => {
                      setFollowUp(`请帮我执行「${s.name}」`);
                      textareaRef.current?.focus();
                    }}
                  >
                    <Icon size={13} className="text-gray-400" />
                    {s.name}
                  </button>
                );
              })}
              <button
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/80 dark:bg-gray-800/60 text-xs text-gray-600 dark:text-gray-300 hover:text-red-500 transition-all duration-200"
                onClick={handleClear}
              >
                <Trash2 size={13} />
                清除对话
              </button>
            </div>
          )}

          {/* Input box — draw-once border animation */}
          {started && (
            <div className="px-6 pt-1 pb-4">
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
                      <filter id="border-glow">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Trail: stroke drawn along the exact rounded-rect perimeter */}
                    <path
                      ref={pathRef}
                      d={buildBorderPath(borderSize.w, borderSize.h, 16)}
                      className="stroke-blue-400 dark:stroke-blue-500"
                      strokeWidth="1"
                      pathLength={1}
                      strokeDasharray="1"
                      strokeDashoffset="1"
                    />
                    {/* Glow dot at the leading edge */}
                    <path
                      ref={glowRef}
                      d={buildBorderPath(borderSize.w, borderSize.h, 16)}
                      className="stroke-blue-500 dark:stroke-blue-400"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray="0.04 0.96"
                      strokeDashoffset="0"
                      filter="url(#border-glow)"
                      opacity="0"
                    />
                  </svg>
                )}

                {/* Static gray border (visible when not active/done) */}
                <div
                  className={`absolute inset-0 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 pointer-events-none transition-opacity duration-200 ${
                    borderActive || borderDone ? "opacity-0" : "opacity-100"
                  }`}
                />

                {/* Inner content */}
                <div className="relative rounded-[15px] bg-white dark:bg-gray-800">
                  <textarea
                    ref={textareaRef}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 resize-none px-4 pt-3 pb-1"
                    rows={2}
                    placeholder="输入内容主题，开启你的AI创作之旅"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleFollowUp();
                      }
                    }}
                    disabled={loading}
                  />
                  <div className="flex items-center justify-between px-4 pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Globe size={14} className="text-blue-500" />
                      <span>联网搜索</span>
                    </div>
                    <button
                      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        followUp.trim() && !loading
                          ? "bg-blue-500 text-white cursor-pointer shadow-sm"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                      onClick={handleFollowUp}
                      disabled={loading || !followUp.trim()}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
