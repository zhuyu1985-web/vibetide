"use client";

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { type EmployeeId } from "@/lib/constants";
import { Mic, Paperclip, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { ChatMessage } from "@/lib/chat-utils";
import { renderScenarioTemplate } from "@/lib/scenario-template";
import { ParticleBackground } from "@/components/shared/particle-background";
import { ModelSwitcher, DEFAULT_MODEL_ID } from "@/components/shared/model-switcher";
import { HeroSection } from "@/components/home/hero-section";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { ScenarioGrid } from "@/components/home/scenario-grid";
import { RecentSection } from "@/components/home/recent-section";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import type { ScenarioCardData, InputFieldDef } from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";

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
  /**
   * Task 2.3 — Map of tab key → workflow templates for that tab. Keys are the
   * 8 employee slugs plus `"custom"` for user-defined workflows. Replaces the
   * former flat `workflows` prop and legacy scenario-detail-sheet plumbing.
   *
   * Task 4 — 9 个共享 tab 的行额外带 `__homepagePinnedAt`（由 DAL LEFT JOIN
   * 填充），供客户端区分置顶卡；custom tab 无此字段。
   */
  templatesByTab?: Record<
    string,
    (WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[]
  >;
  /**
   * Task 4 — admin / owner / super admin 可见"整理顺序"与 Pin/Unpin 控件。
   */
  canManageHomepage?: boolean;
}

// 嵌入式对话状态快照，详见 HomeClient 内的 useEffect。
const HOME_CHAT_STATE_KEY = "home-embedded-chat-state";
const HOME_CHAT_STATE_TTL_MS = 4 * 60 * 60 * 1000; // 4 小时

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeClient({
  recentMissions,
  recentConversations,
  scenarioMap = {},
  employeeDbIdMap: _employeeDbIdMap = {},
  templatesByTab = {},
  canManageHomepage = false,
}: HomeClientProps) {
  const router = useRouter();

  // ── State ──
  const [inputValue, setInputValue] = useState("");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeId | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [isRecording, setIsRecording] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [inlineScenario, setInlineScenario] = useState<ScenarioCardData | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Silence unused-var warnings for props reserved for follow-ups.
  void _employeeDbIdMap;

  // Task 2.3 — custom-scenario localStorage migration is handled by the
  // "我的工作流" tab in <ScenarioGrid>, which reads from workflow_templates.
  // Previously we hydrated `customScenarios` from `vibetide_custom_scenarios`
  // here; that state has been removed.
  useEffect(() => {
    // intentionally no-op (retained for future onboarding hooks)
  }, []);

  const effectiveEmployee: EmployeeId = activeEmployee ?? "xiaolei";

  // 2026-04-20 chips 数据源切到 workflow_templates（员工绑定的日常工作流）
  // 取 templatesByTab[employee]，按 ScenarioCardData 形状适配既有 chip handler。
  // scenarioMap 自 legacy employee_scenarios 表删除后恒为空，保留 prop 仅作签名兼容。
  void scenarioMap;
  const allEmployeeScenarios: ScenarioCardData[] = activeEmployee
    ? (templatesByTab[activeEmployee] ?? []).map((t: WorkflowTemplateRow) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? "",
        icon: t.icon ?? "",
        welcomeMessage: null,
        inputFields: (t.inputFields ?? []) as InputFieldDef[],
        toolsHint: [],
      }))
    : [];
  // 单行展示：截顶 4 个，配合 flex-nowrap + overflow-hidden 保证不换行。
  const activeScenarios = allEmployeeScenarios.slice(0, 4);

  // ── Chat stream hook ──
  const chat = useChatStream({ employeeSlug: effectiveEmployee });

  // 嵌入式对话状态持久化。chat 状态原本只存在于组件本地 useState，浏览器后台丢
  // 弃 tab、RSC 重挂、Fast Refresh 等都会让对话整段消失、UI 退回首页视图。
  // 用 sessionStorage 做轻量快照，挂载时自动还原，显式关闭/展开时清除。
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem(HOME_CHAT_STATE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        chatOpen?: boolean;
        activeEmployee?: EmployeeId | null;
        messages?: ChatMessage[];
        timestamp?: number;
      };
      if (!data || typeof data.timestamp !== "number") return;
      if (Date.now() - data.timestamp > HOME_CHAT_STATE_TTL_MS) {
        sessionStorage.removeItem(HOME_CHAT_STATE_KEY);
        return;
      }
      if (data.activeEmployee) setActiveEmployee(data.activeEmployee);
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        chat.setMessages(data.messages);
      }
      if (data.chatOpen) setChatOpen(true);
    } catch {
      // 快照损坏 — 清掉，从头开始
      try {
        sessionStorage.removeItem(HOME_CHAT_STATE_KEY);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 仅在对话面板打开、且不在流式输出中时快照；跳过流式中途的半截消息，避免
  // 还原时渲染出一条永远转圈的空 assistant 气泡。
  useEffect(() => {
    if (!chatOpen) return;
    if (chat.isStreaming || chat.loading) return;
    try {
      const last = chat.messages[chat.messages.length - 1];
      const trimmed =
        last && last.role === "assistant" && !last.content
          ? chat.messages.slice(0, -1)
          : chat.messages;
      sessionStorage.setItem(
        HOME_CHAT_STATE_KEY,
        JSON.stringify({
          chatOpen,
          activeEmployee,
          messages: trimmed,
          timestamp: Date.now(),
        }),
      );
    } catch {
      // 配额或序列化失败 — best-effort
    }
  }, [chatOpen, activeEmployee, chat.messages, chat.isStreaming, chat.loading]);

  // ── Handlers ──

  // Submit from input box → open embedded chat and send message
  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    const text = inputValue;
    setInputValue("");
    setChatOpen(true);
    // Send message after state update
    setTimeout(() => {
      chat.sendMessage(text);
    }, 0);
  }, [inputValue, chat]);

  const handleSelectEmployee = useCallback((slug: EmployeeId) => {
    setActiveEmployee(slug);
    // If already in chat, clear messages for new employee
    if (chatOpen) {
      chat.clearMessages();
    }
  }, [chatOpen, chat]);

  const handleSwitchEmployee = useCallback((slug: EmployeeId) => {
    setActiveEmployee(slug);
    chat.clearMessages();
  }, [chat]);

  const handleVoiceToggle = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  // Click employee scenario chip → open chat with inline scenario form
  const handleEmployeeScenarioClick = useCallback(
    (scenario: { id: string; name: string; icon?: string }) => {
      const fullScenario = allEmployeeScenarios.find((s) => s.id === scenario.id);
      if (!fullScenario) return;

      setChatOpen(true);

      // If the scenario has a welcome message, show it as the opening assistant
      // message when entering the scenario. Rendered with empty inputs so any
      // {{placeholder}} references remain visible (they'll resolve on submit
      // via the instruction itself, so the welcome should usually avoid
      // placeholders).
      if (fullScenario.welcomeMessage) {
        const welcome = renderScenarioTemplate(fullScenario.welcomeMessage, {});
        if (welcome.trim()) {
          chat.setMessages((prev) => [
            ...prev,
            { role: "assistant", content: welcome },
          ]);
        }
      }

      if (fullScenario.inputFields?.length > 0) {
        // Show inline scenario form in chat
        setInlineScenario(fullScenario);
      } else {
        // Execute directly (no inputs to collect)
        setTimeout(() => {
          chat.sendMessage(`执行场景：${fullScenario.name}`);
        }, 0);
      }
    },
    [allEmployeeScenarios, chat]
  );

  // Inline scenario form submit
  const handleScenarioFormSubmit = useCallback(
    (scenario: ScenarioCardData, inputs: Record<string, string>) => {
      setInlineScenario(null);
      // 关键：select/multiselect 字段把英文 value（如 "national" / "urgent"）
      // 映射回中文 label（"全国" / "紧急"）。否则发给 chat 的消息里混着英
      // 文 enum，下游 web_search 拼出 query 带英文词会把 Tavily 偏向英文
      // 结果。经验事故：每日时政热点场景里 region=national + urgency=urgent
      // 导致搜索返回白宫 / Google / Gemini 等英文新闻。
      const labelForValue = (
        field: (typeof scenario.inputFields)[number] | undefined,
        rawValue: string
      ): string => {
        if (!field || !Array.isArray(field.options)) return rawValue;
        // multiselect 传来的是逗号串
        const values = rawValue.split(",").map((v) => v.trim()).filter(Boolean);
        const mapped = values.map((v) => {
          const match = field.options?.find((opt) =>
            typeof opt === "string" ? opt === v : opt.value === v
          );
          if (!match) return v;
          return typeof match === "string" ? match : match.label;
        });
        return mapped.join("、");
      };

      // 技术字段（如 time_range）的 select 值必须保留原值，因为下游
      // intent-execute/route.ts 会按 "1h/24h/7d/30d" 解析出 Tavily timeRange。
      // 被 label 映射成"过去 24 小时"之后，parseExplicitTimeRange 会匹配失败，
      // 又退化成 inferTimeRange 的文本猜测。
      const RAW_VALUE_FIELD_NAMES = new Set(["time_range"]);

      const summary = Object.entries(inputs)
        .filter(([, v]) => v)
        .map(([k, v]) => {
          const field = scenario.inputFields.find((f) => f.name === k);
          const isRawValueField = RAW_VALUE_FIELD_NAMES.has(k);
          const displayValue =
            !isRawValueField &&
            (field?.type === "select" || field?.type === "multiselect")
              ? labelForValue(field, v)
              : v;
          return `${field?.label ?? k}: ${displayValue}`;
        })
        .join("\n");
      chat.sendMessage(`场景：${scenario.name}\n${summary}`);
    },
    [chat]
  );

  const handleCancelScenario = useCallback(() => {
    setInlineScenario(null);
  }, []);

  const handleCloseChat = useCallback(() => {
    setChatOpen(false);
    setChatInput("");
    chat.clearMessages();
    try {
      sessionStorage.removeItem(HOME_CHAT_STATE_KEY);
    } catch {
      // ignore
    }
  }, [chat]);

  // Send message from chat-mode input box
  const handleChatSend = useCallback(() => {
    if (!chatInput.trim() || chat.isStreaming) return;
    const text = chatInput;
    setChatInput("");
    // Reset textarea height
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = "auto";
    }
    chat.sendMessage(text);
  }, [chatInput, chat]);

  const handleChatKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleChatSend();
      }
    },
    [handleChatSend]
  );

  // `router` retained for future scenario-level navigation hooks (e.g. the
  // per-employee chat panel may push to `/missions/:id`). Silence unused-var
  // warning if no current call path reaches router.push() here.
  void router;

  // ── Shared input box (used in both normal and chat modes) ──
  const renderInputBox = () => (
    <div className="w-full">
      <div
        className={cn(
          "gemini-border rounded-2xl",
          "bg-white dark:bg-white/[0.06]",
          "transition-shadow duration-300 ease-out"
        )}
      >
        {/* Textarea */}
        <div className="px-5 pt-4 pb-2">
          <textarea
            ref={chatTextareaRef}
            value={chatOpen ? chatInput : inputValue}
            onChange={(e) => chatOpen ? setChatInput(e.target.value) : setInputValue(e.target.value)}
            onKeyDown={chatOpen ? handleChatKeyDown : (e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={chatOpen ? "继续对话..." : "有什么想法？告诉 AI 团队…"}
            rows={chatOpen ? 1 : 2}
            className={cn(
              "w-full bg-transparent text-[15px] leading-relaxed",
              "text-foreground placeholder:text-muted-foreground/50",
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

        {/* Scenario chips — only when an employee is actively selected.
            Source: templatesByTab[employee] (员工绑定的日常工作流)，单行展示。 */}
        {activeEmployee && activeScenarios.length > 0 && (
          <div className="px-4 pb-2 flex flex-nowrap gap-1.5 overflow-hidden">
            {activeScenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => handleEmployeeScenarioClick(scenario)}
                title={scenario.description || scenario.name}
                className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer whitespace-nowrap max-w-[10rem] truncate"
              >
                {scenario.name}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-1">
            <button
              onClick={handleVoiceToggle}
              className={cn(
                "p-2 rounded-xl transition-all duration-200",
                isRecording
                  ? "bg-red-500/20 text-red-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Mic size={16} />
            </button>
            <button
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
            >
              <Paperclip size={16} />
            </button>
            <span className="mx-1 h-4 w-px bg-border" />
            <ModelSwitcher
              value={selectedModel}
              onChange={setSelectedModel}
              size="sm"
            />
          </div>
          <button
            onClick={chatOpen ? handleChatSend : handleSubmit}
            disabled={chatOpen ? (!chatInput.trim() || chat.isStreaming) : !inputValue.trim()}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200",
              (chatOpen ? (chatInput.trim() && !chat.isStreaming) : inputValue.trim())
                ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.4)] hover:scale-105 cursor-pointer"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render: Chat mode ──
  if (chatOpen) {
    return (
      <div className="relative h-full flex flex-col overflow-hidden">
        {/* Background */}
        <ParticleBackground
          particleCount={40}
          className="fixed inset-0 z-0 pointer-events-none dark:opacity-30 opacity-10"
        />

        {/* Chat messages — fills all available space, scrolls internally */}
        <div className="relative z-10 flex-1 min-h-0 flex justify-center overflow-hidden">
          <div className="w-full max-w-3xl min-h-0 flex flex-col">
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
        </div>

        {/* Input box — fixed at absolute bottom of the page */}
        <div className="relative z-10 flex-shrink-0 px-4 pb-4 pt-2 flex justify-center">
          <div className="w-full max-w-3xl">
            {renderInputBox()}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Homepage mode ──
  return (
    <div className="relative h-full overflow-y-auto scrollbar-thin">
      {/* Particle background */}
      <ParticleBackground
        particleCount={60}
        className="fixed inset-0 z-0 pointer-events-none dark:opacity-50 opacity-20"
      />

      {/* Four-layer content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-12">
        {/* Layer 1: Hero title + badge */}
        <HeroSection />

        {/* Layer 1.5: Shared input box */}
        <div className="max-w-[820px] mx-auto mt-2">
          {renderInputBox()}
        </div>

        {/* Layer 2: Employee quick panel */}
        <div className="max-w-[820px] mx-auto mt-4">
          <EmployeeQuickPanel
            activeEmployee={activeEmployee}
            onEmployeeClick={handleSelectEmployee}
          />
        </div>

        {/* Layer 3: Scenario grid — Task 2.3: 9-tab view driven by
            `templatesByTab` (8 employees + "我的工作流"). Each card either
            opens <WorkflowLaunchDialog> (template has input fields) or starts
            the mission directly via `startMissionFromTemplate`. */}
        <div className="px-4 mt-6">
          <ScenarioGrid
            templatesByTab={templatesByTab}
            canManageHomepage={canManageHomepage}
          />
        </div>

        {/* Layer 4: Recent missions & conversations */}
        {(recentMissions.length > 0 || recentConversations.length > 0) && (
          <div className="px-4 mt-6">
            <RecentSection
              missions={recentMissions}
              conversations={recentConversations}
            />
          </div>
        )}
      </div>
    </div>
  );
}
