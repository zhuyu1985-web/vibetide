"use client";

/**
 * AI 助手输入框 —— 对齐「对话中心」(/chat) 风格：
 *   - 统一边框圆角盒子，textarea 占顶部 3 行
 *   - 底部操作栏：联网搜索 toggle + 35x35 发送按钮（彩虹光环 + 渐变 + 呼吸动画）
 *   - 默认 min-h-[72px]，自动扩展到 max-h-[192px]
 *
 * Send button 动画引用 globals.css 中的 send-halo-spin / send-pulse / send-breathe keyframes。
 */

import { useState, useRef, KeyboardEvent } from "react";
import { Send, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "向 AI 助手提问…" }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 192)}px`;
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="px-3 pt-2 pb-4 shrink-0">
      <div className="rounded-2xl border border-[var(--glass-border)] bg-white/80 dark:bg-white/[0.04] shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-400/30 transition-all">
        <textarea
          ref={textareaRef}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm leading-relaxed outline-none border-0",
            "placeholder:text-muted-foreground/50",
            "min-h-[72px] max-h-[192px] overflow-y-auto",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
        <div className="flex items-center justify-between px-3 pb-2 pt-1">
          <button
            type="button"
            onClick={() => setWebSearch(!webSearch)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
              webSearch
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <Globe size={12} />
            联网搜索
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="发送"
            className={cn(
              "send-btn group relative shrink-0 w-[35px] h-[35px] rounded-[10px] flex items-center justify-center transition-all duration-300 border-0",
              canSend
                ? "cursor-pointer text-white shadow-[0_6px_18px_-6px_rgba(79,70,229,0.55)] hover:shadow-[0_10px_26px_-8px_rgba(139,92,246,0.7)] hover:scale-[1.08] active:scale-95"
                : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed",
            )}
          >
            {canSend && (
              <>
                {/* 旋转彩虹光环 */}
                <span
                  className="pointer-events-none absolute inset-0 rounded-[10px] opacity-85 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #38bdf8, #6366f1, #a855f7, #ec4899, #f59e0b, #10b981, #06b6d4, #38bdf8)",
                    animation: "send-halo-spin 4s linear infinite",
                  }}
                />
                {/* 内部渐变填充（盖住光环只剩边缘） */}
                <span className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600" />
                {/* 呼吸高光 */}
                <span className="pointer-events-none absolute inset-[2px] rounded-[8px] bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.5),transparent_65%)] animate-[send-breathe_2.6s_ease-in-out_infinite]" />
                {/* 脉冲环 */}
                <span className="pointer-events-none absolute inset-0 rounded-[10px] animate-[send-pulse_1.8s_ease-in-out_infinite]" />
              </>
            )}
            <span className="relative z-10 flex items-center justify-center">
              {disabled ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} className="-translate-x-[1px]" />
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
