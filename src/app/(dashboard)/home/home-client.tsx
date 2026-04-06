"use client";

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import { RecentSection } from "@/components/home/recent-section";
import { useSearchParams } from "next/navigation";
import { useChatStream } from "@/hooks/use-chat-stream";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { Send, Paperclip, Sparkles } from "lucide-react";
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

      {/* ── Unified input box (iOS 26 liquid glass) ── */}
      <div className="w-full max-w-2xl mb-6">
        <div
          className={cn(
            "rounded-2xl overflow-hidden",
            "bg-black/[0.03] dark:bg-white/[0.06] backdrop-blur-2xl",
            "border border-black/[0.08] dark:border-white/[0.08]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]",
            "focus-within:border-black/[0.12] dark:focus-within:border-white/[0.15]",
            "focus-within:shadow-[0_8px_40px_rgba(59,130,246,0.12),0_0_60px_rgba(59,130,246,0.06),inset_0_1px_0_rgba(255,255,255,0.1)]",
            "transition-all duration-500 ease-out"
          )}
        >
          <div className="flex items-end gap-2 p-3">
            {/* Paperclip attachment button (disabled) */}
            <button
              disabled
              className="p-2 rounded-lg text-gray-200 dark:text-white/20 cursor-not-allowed shrink-0 border-0"
              title="附件功能即将上线"
            >
              <Paperclip size={18} />
            </button>

            {/* Active employee indicator */}
            {activeMeta && ActiveIcon && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg shrink-0"
                style={{ backgroundColor: activeMeta.bgColor }}
              >
                <ActiveIcon
                  size={14}
                  style={{ color: activeMeta.color }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: activeMeta.color }}
                >
                  {activeMeta.nickname}
                </span>
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的需求，AI 团队为你协作完成..."
              rows={1}
              className={cn(
                "flex-1 bg-transparent text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/25",
                "resize-none outline-none min-h-[36px] max-h-[120px] py-2",
                "scrollbar-thin scrollbar-thumb-white/10"
              )}
              style={{
                height: "auto",
                overflowY: inputValue.split("\n").length > 3 ? "auto" : "hidden",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || chat.loading || chat.isStreaming}
              className={cn(
                "p-2 rounded-lg shrink-0 transition-all duration-200 border-0",
                inputValue.trim() && !chat.loading && !chat.isStreaming
                  ? "bg-blue-500 text-white hover:bg-blue-400"
                  : "text-gray-200 dark:text-white/15 cursor-not-allowed"
              )}
            >
              <Send size={18} />
            </button>
          </div>

          {/* Subtle hint */}
          {!chatOpen && (
            <div className="flex items-center gap-1.5 px-4 pb-2 -mt-1">
              <Sparkles size={10} className="text-gray-300 dark:text-white/15" />
              <span className="text-[10px] text-gray-300 dark:text-white/15">
                Enter 发送 / Shift+Enter 换行
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Employee quick panel ── */}
      {!chatOpen && (
        <div className="w-full max-w-2xl mb-8 flex justify-center">
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
