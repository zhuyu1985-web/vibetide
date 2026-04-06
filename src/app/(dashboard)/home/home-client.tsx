"use client";

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import { RecentSection } from "@/components/home/recent-section";
import { useSearchParams } from "next/navigation";
import { useChatStream } from "@/hooks/use-chat-stream";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { Send, Plus, Wrench, Mic, AudioLines, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeClient({
  recentMissions,
  recentConversations,
}: HomeClientProps) {
  // ── State ──
  const [inputValue, setInputValue] = useState("");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeId | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Default to xiaolei for intent recognition
  const effectiveEmployee = activeEmployee ?? "xiaolei";

  const chat = useChatStream({ employeeSlug: effectiveEmployee });

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
      textareaRef.current?.focus();
    },
    [chat]
  );

  const handleCloseChat = useCallback(() => {
    setChatOpen(false);
  }, []);

  // Active employee meta (for indicator inside input)
  const activeMeta = activeEmployee ? EMPLOYEE_META[activeEmployee] : null;
  const ActiveIcon = activeMeta?.icon;

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex flex-col items-center pt-[10vh] px-4 pb-8">
      {/* Background atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-blue-500/[0.04] blur-[120px]" />
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-purple-500/[0.03] blur-[80px]" />
      </div>

      {/* ── Title ── */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Vibetide 智媒工作空间
          </span>
        </h1>
        <p className="text-sm text-gray-400 dark:text-white/40">
          与 AI 团队协作，高效完成内容生产
        </p>
      </div>

      {/* ── Unified input box (Genspark style) ── */}
      <div className="w-full max-w-3xl mb-6">
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
              rows={2}
              className={cn(
                "w-full bg-transparent text-[15px] leading-relaxed",
                "text-gray-900 dark:text-white/90",
                "placeholder:text-gray-400 dark:placeholder:text-white/30",
                "resize-none outline-none min-h-[52px] max-h-[160px]"
              )}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
              }}
            />
          </div>

          {/* Toolbar row — Genspark style */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            {/* Left tools */}
            <div className="flex items-center gap-1">
              {/* Add button */}
              <button
                className="p-2 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border-0 bg-transparent"
                title="添加附件"
              >
                <Plus size={18} />
              </button>

              {/* Tool button */}
              <button
                className="p-2 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border-0 bg-transparent"
                title="工具"
              >
                <Wrench size={18} />
              </button>

              {/* Model/mode selector — Genspark "Ultra" style */}
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                  "text-gray-500 dark:text-white/40",
                  "hover:bg-gray-100 dark:hover:bg-white/10",
                  "transition-colors border-0 bg-transparent"
                )}
              >
                {activeMeta && ActiveIcon ? (
                  <>
                    <ActiveIcon size={14} style={{ color: activeMeta.color }} />
                    <span style={{ color: activeMeta.color }}>{activeMeta.nickname}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    <span>智能路由</span>
                  </>
                )}
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {/* Mic button */}
              <button
                className="p-2 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border-0 bg-transparent"
                title="语音输入"
              >
                <Mic size={18} />
              </button>

              {/* Send / "对话" button — Genspark style pill */}
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

      {/* ── Employee quick panel ── */}
      {!chatOpen && (
        <div className="w-full max-w-3xl mb-8 flex justify-center">
          <EmployeeQuickPanel onSelectEmployee={handleSelectEmployee} />
        </div>
      )}

      {/* ── Embedded chat panel (shown after sending) ── */}
      {chatOpen && (
        <div className="w-full max-w-3xl">
          <EmbeddedChatPanel
            activeEmployee={effectiveEmployee}
            chat={chat}
            onClose={handleCloseChat}
          />
        </div>
      )}

      {/* ── Recent section (shown when chat is NOT open) ── */}
      {!chatOpen && (recentMissions.length > 0 || recentConversations.length > 0) && (
        <div className="w-full max-w-3xl mt-4">
          <RecentSection
            missions={recentMissions}
            conversations={recentConversations}
          />
        </div>
      )}
    </div>
  );
}
