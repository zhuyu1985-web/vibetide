"use client";

import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import { RecentSection } from "@/components/home/recent-section";
import { useSearchParams } from "next/navigation";
import { useChatStream } from "@/hooks/use-chat-stream";
import {
  EMPLOYEE_META,
  type EmployeeId,
} from "@/lib/constants";
import type { ScenarioCardData } from "@/lib/types";
import type { IntentResult } from "@/lib/agent/types";
import {
  Plus,
  Mic,
  AudioLines,
  ChevronDown,
  Check,
  Cpu,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABLE_MODELS = [
  { id: "auto", label: "智能路由", description: "自动选择最佳模型" },
  { id: "deepseek-chat", label: "DeepSeek", description: "通用对话" },
  { id: "glm-5", label: "GLM-5", description: "智谱最新模型" },
  { id: "glm-4-flash", label: "GLM-4 Flash", description: "快速响应" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HomeClientProps {
  recentMissions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    sourceModule?: string;
  }>;
  recentConversations: Array<{
    id: string;
    title: string;
    employeeSlug: string;
    updatedAt: string;
  }>;
  scenarioMap?: Record<string, ScenarioCardData[]>;
  employeeDbIdMap?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeClient({
  recentMissions,
  recentConversations,
  scenarioMap = {},
  employeeDbIdMap = {},
}: HomeClientProps) {
  // ── State ──
  const [inputValue, setInputValue] = useState("");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeId | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [isRecording, setIsRecording] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [inlineScenario, setInlineScenario] =
    useState<ScenarioCardData | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Default to xiaolei for intent recognition
  const effectiveEmployee = activeEmployee ?? "xiaolei";

  const chat = useChatStream({ employeeSlug: effectiveEmployee });

  // ── Ancestor layout patch ──
  // The dashboard shell's <main> element uses `overflow-y-auto`, which means
  // when the home content exceeds its available height (e.g., during a long
  // chat), the ENTIRE page scrolls — dragging the input box along with it.
  // Patch the ancestor chain to `overflow: hidden` + flex-col + min-h:0 so
  // the home container can use `flex-1` sizing and keep internal scroll areas
  // (messages list) strictly bounded to their own scroller. Mirror the
  // approach used by chat-center-client so both pages behave identically.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const patches: { el: HTMLElement; saved: string }[] = [];
    const patch = (
      target: HTMLElement | null | undefined,
      styles: Record<string, string>
    ) => {
      if (!target) return;
      patches.push({ el: target, saved: target.style.cssText });
      Object.assign(target.style, styles);
    };

    // Chain walk: rootRef → div.p-6 wrapper → main → sidebarInset → sidebarWrapper
    const wrapper = el.parentElement;
    const innerMain = wrapper?.parentElement;
    const sidebarInset = innerMain?.parentElement;
    const sidebarWrapper = sidebarInset?.parentElement;

    patch(sidebarWrapper, { overflow: "hidden" });
    patch(sidebarInset, { minHeight: "0", overflow: "hidden" });
    patch(innerMain, {
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      minHeight: "0",
    });
    patch(wrapper, {
      padding: "0",
      flex: "1",
      minHeight: "0",
      display: "flex",
      flexDirection: "column",
    });

    return () => {
      for (const p of patches) p.el.style.cssText = p.saved;
    };
  }, []);

  // ── URL parameter linkage from marketplace ──
  const searchParams = useSearchParams();

  useEffect(() => {
    const emp = searchParams.get("employee") as EmployeeId | null;
    const task = searchParams.get("task");

    if (emp && EMPLOYEE_META[emp]) {
      setActiveEmployee(emp);
      if (task) {
        setInputValue(task);
        // Auto-send after a brief delay for UI to settle
        setTimeout(() => {
          setChatOpen(true);
          chat.sendMessage(task);
          setInputValue("");
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // ── Handlers ──
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || chat.loading || chat.isStreaming) return;

    setChatOpen(true);
    setInputValue("");
    chat.sendMessage(text);
  }, [inputValue, chat]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSelectEmployee = useCallback(
    (slug: EmployeeId) => {
      setActiveEmployee(slug);
      chat.clearMessages();
      setChatOpen(false);
      setInlineScenario(null);
      textareaRef.current?.focus();
    },
    [chat]
  );

  const handleCloseChat = useCallback(() => {
    setChatOpen(false);
    setInlineScenario(null);
  }, []);

  // Switch employee while keeping chat open (clears messages, starts fresh)
  const handleSwitchEmployee = useCallback(
    (slug: EmployeeId) => {
      setActiveEmployee(slug);
      chat.clearMessages();
      setInlineScenario(null);
      textareaRef.current?.focus();
    },
    [chat]
  );

  // File upload placeholder
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      toast.info("文件上传功能即将上线", {
        description: `已选择 ${files.length} 个文件`,
      });
    }
    e.target.value = "";
  }, []);

  // Voice input
  const handleVoiceInput = useCallback(() => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;

    if (!SR) {
      toast.info("当前浏览器不支持语音输入");
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setInputValue((prev) => prev + transcript);
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setIsRecording(false);
      if (e.error === "not-allowed") {
        toast.error("请允许麦克风访问权限");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  // ── Scenario execution — matches chat center behavior ──
  // Declared with `function` to avoid useCallback dep-cycle with handleScenarioClick.
  const executeScenario = useCallback(
    async (scenario: ScenarioCardData, inputs: Record<string, string>) => {
      const employeeDbId = employeeDbIdMap[effectiveEmployee];
      if (!employeeDbId) {
        toast.error("员工信息加载失败，请刷新页面重试");
        return;
      }

      const empMeta = EMPLOYEE_META[effectiveEmployee];
      const inputSummary = scenario.inputFields
        .map((f) => `${f.label}: ${inputs[f.name] || "全部"}`)
        .join("，");
      const userContent = inputSummary || `请执行「${scenario.name}」`;

      // Build intent display from scenario metadata (mirror chat-center-client)
      const scenarioIntent: IntentResult = {
        intentType: "content_creation",
        summary: `场景：${scenario.name}${inputSummary ? ` — ${inputSummary}` : ""}`,
        confidence: 1.0,
        steps: [
          {
            employeeSlug: effectiveEmployee,
            employeeName: empMeta?.nickname ?? effectiveEmployee,
            skills:
              scenario.toolsHint.length > 0
                ? scenario.toolsHint
                : ["content_generate"],
            taskDescription: scenario.description,
          },
        ],
        reasoning: `用户选择了预设场景「${scenario.name}」`,
      };
      chat.setPendingIntent(scenarioIntent);
      chat.setPendingMessage(userContent);

      await chat.executeChat(userContent, [], "/api/scenarios/execute", {
        employeeDbId,
        scenarioId: scenario.id,
        userInputs: inputs,
      });
    },
    [chat, effectiveEmployee, employeeDbIdMap]
  );

  // Scenario chip click — show inline form when inputs are required,
  // otherwise execute directly (matching chat center UX)
  const handleScenarioClick = useCallback(
    (scenario: ScenarioCardData) => {
      if (scenario.inputFields.length > 0) {
        setInlineScenario(scenario);
        setChatOpen(true);
      } else {
        setInlineScenario(null);
        setChatOpen(true);
        void executeScenario(scenario, {});
      }
    },
    [executeScenario]
  );

  const handleScenarioFormSubmit = useCallback(
    (scenario: ScenarioCardData, inputs: Record<string, string>) => {
      setInlineScenario(null);
      void executeScenario(scenario, inputs);
    },
    [executeScenario]
  );

  const handleCancelScenario = useCallback(() => {
    setInlineScenario(null);
  }, []);

  // Active employee meta (for indicator inside input)
  const activeMeta = activeEmployee ? EMPLOYEE_META[activeEmployee] : null;
  const ActiveIcon = activeMeta?.icon;

  // Active model label
  const activeModelInfo = AVAILABLE_MODELS.find((m) => m.id === selectedModel);

  // Scenarios for the active employee
  // - Normal mode: show top 3 as pill chips in the input box
  // - Chat mode: show the full list in a horizontal scroller above the input,
  //   matching the chat center UX
  const allScenarios = activeEmployee
    ? (scenarioMap[activeEmployee] ?? [])
    : [];
  const activeScenarios = chatOpen ? allScenarios : allScenarios.slice(0, 3);

  // ── Input box (shared between normal and chat mode) ──
  const renderInputBox = () => (
    <div className="w-full">
      <div
        className={cn(
          "rounded-2xl overflow-hidden",
          "bg-white dark:bg-white/[0.06]",
          "border border-gray-200 dark:border-white/[0.1]",
          "shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
          "focus-within:border-gray-300 dark:focus-within:border-white/[0.18]",
          "focus-within:shadow-md dark:focus-within:shadow-[0_8px_40px_rgba(59,130,246,0.12)]",
          "transition-all duration-300 ease-out"
        )}
      >
        {/* Textarea area */}
        <div className="px-5 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="询问任何问题，创造任何事物"
            rows={chatOpen ? 1 : 2}
            className={cn(
              "w-full bg-transparent text-[15px] leading-relaxed",
              "text-gray-900 dark:text-white/90",
              "placeholder:text-gray-400 dark:placeholder:text-white/30",
              "resize-none outline-none",
              chatOpen ? "min-h-[36px] max-h-[100px]" : "min-h-[52px] max-h-[160px]"
            )}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              const maxH = chatOpen ? 100 : 160;
              target.style.height = `${Math.min(target.scrollHeight, maxH)}px`;
            }}
          />
        </div>

        {/* Scenario quick-actions — wrap to multiple rows instead of
            horizontal scroll. When there are many scenarios, they grow
            downward (pushing into the input area padding) rather than
            producing a scrollbar. */}
        {activeEmployee && activeScenarios.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {activeScenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => handleScenarioClick(scenario)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors border-0 cursor-pointer"
              >
                {scenario.name}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          {/* Left tools */}
          <div className="flex items-center gap-1">
            {/* Add attachment button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border-0 bg-transparent"
              title="添加附件"
            >
              <Plus size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
              onChange={handleFileSelect}
            />

            {/* Model selector */}
            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                    "text-gray-500 dark:text-white/40",
                    "hover:bg-gray-100 dark:hover:bg-white/10",
                    "transition-colors border-0 bg-transparent"
                  )}
                >
                  {selectedModel === "auto" ? (
                    activeMeta && ActiveIcon ? (
                      <>
                        <ActiveIcon size={14} style={{ color: activeMeta.color }} />
                        <span style={{ color: activeMeta.color }}>
                          {activeMeta.nickname}
                        </span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} />
                        <span>智能路由</span>
                      </>
                    )
                  ) : (
                    <>
                      <Cpu size={14} />
                      <span>{activeModelInfo?.label ?? selectedModel}</span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-52 p-1.5"
                sideOffset={8}
              >
                <div className="space-y-0.5">
                  {AVAILABLE_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setModelOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors border-0 bg-transparent",
                        selectedModel === m.id
                          ? "bg-black/[0.05] dark:bg-white/[0.08] text-gray-900 dark:text-white"
                          : "text-gray-600 dark:text-white/60 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-[10px] text-gray-400 dark:text-white/30">
                          {m.description}
                        </span>
                      </div>
                      {selectedModel === m.id && (
                        <Check size={14} className="text-blue-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Mic button */}
            <button
              onClick={handleVoiceInput}
              className={cn(
                "p-2 rounded-lg transition-colors border-0 bg-transparent",
                isRecording
                  ? "text-red-500 dark:text-red-400 animate-pulse"
                  : "text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10"
              )}
              title={isRecording ? "停止录音" : "语音输入"}
            >
              <Mic size={18} />
            </button>

            {/* Send / "对话" button */}
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || chat.loading || chat.isStreaming}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium",
                "transition-all duration-200 border-0",
                inputValue.trim() && !chat.loading && !chat.isStreaming
                  ? "bg-gray-900 dark:bg-white/90 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-white"
                  : "bg-gray-100 dark:bg-white/10 text-gray-300 dark:text-white/20 cursor-not-allowed"
              )}
            >
              <AudioLines size={16} />
              <span>对话</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex-1 min-h-0 flex flex-col items-center px-4 pb-4 overflow-hidden"
    >
      {/* Background atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-blue-500/[0.04] blur-[120px]" />
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-purple-500/[0.03] blur-[80px]" />
      </div>

      {chatOpen ? (
        /* ── Chat mode: messages above (scroll internally), input PINNED below ──
            Uses CSS Grid with `grid-rows-[minmax(0,1fr)_auto]` instead of flex
            because grid's `minmax(0, 1fr)` explicitly allows the first row to
            shrink below its content's intrinsic size — unlike flex where
            content min-size can leak through even with `min-h-0`. This
            guarantees the input row NEVER gets pushed down by growing
            messages, regardless of how tall the message list becomes.
            Row 1 (messages): fills remaining vertical space, clips internally.
            Row 2 (input):     auto-sized by content, pinned to the bottom. */
        <div
          className="w-full max-w-3xl flex-1 min-h-0 grid gap-3"
          style={{ gridTemplateRows: "minmax(0, 1fr) auto" }}
        >
          {/* Row 1 — dedicated flex container for the embedded chat panel.
              `min-h-0 overflow-hidden flex flex-col` creates a strict
              bounding box so EmbeddedChatPanel's internal scroll behavior
              always stays within this row. */}
          <div className="min-h-0 overflow-hidden flex flex-col">
            <EmbeddedChatPanel
              activeEmployee={effectiveEmployee}
              chat={chat}
              onClose={handleCloseChat}
              onSwitchEmployee={handleSwitchEmployee}
              inlineScenario={inlineScenario}
              onScenarioFormSubmit={handleScenarioFormSubmit}
              onCancelScenario={handleCancelScenario}
              embedded
            />
          </div>
          {/* Row 2 — input box, auto-sized, never shrinks or gets pushed */}
          <div>{renderInputBox()}</div>
        </div>
      ) : (
        /* ── Normal mode: title, input, employee panel, recent ──
            The outer container is overflow-hidden, so NO page-level
            scrolling. Fixed-size sections (title / input / employee panel)
            take natural height; the recent section gets `flex-1 min-h-0`
            and scrolls internally if the list grows beyond the viewport. */
        <>
          {/* Title (fixed) */}
          <div className="text-center mb-4 flex-shrink-0 mt-[50px]">
            <h1 className="text-4xl font-bold mb-1.5 text-foreground">
              Vibetide 智媒工作空间
            </h1>
            <p className="text-sm text-muted-foreground">
              与 AI 团队协作，高效完成内容生产
            </p>
            <Link
              href="/chat"
              className="group relative inline-flex items-center gap-2 mt-3 pl-3 pr-3.5 py-1.5 rounded-full text-xs font-medium text-white bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-[0_4px_16px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_22px_rgba(99,102,241,0.55)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
            >
              {/* 脉冲指示点 */}
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white/80 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              <MessageSquare size={13} className="shrink-0" />
              <span>进入对话中心</span>
              <ArrowRight
                size={13}
                className="shrink-0 transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </Link>
          </div>

          {/* Input box (fixed) */}
          <div className="w-full max-w-3xl mb-4 flex-shrink-0">
            {renderInputBox()}
          </div>

          {/* Employee quick panel (fixed) */}
          <div className="w-full max-w-3xl mb-3 flex justify-center flex-shrink-0">
            <EmployeeQuickPanel onSelectEmployee={handleSelectEmployee} />
          </div>

          {/* Recent section — internal scroll if content exceeds remaining space */}
          {(recentMissions.length > 0 || recentConversations.length > 0) && (
            <div className="w-full max-w-3xl mt-2 flex-1 min-h-0 overflow-y-auto">
              <RecentSection
                missions={recentMissions}
                conversations={recentConversations}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
