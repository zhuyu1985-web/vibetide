"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "向 AI 助手提问…" }: ChatInputProps) {
  const [value, setValue] = useState("");
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="flex items-end gap-2 px-3 py-2 border-t border-[var(--glass-border)] shrink-0">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "flex-1 resize-none bg-muted/50 rounded-lg px-3 py-2 text-xs",
          "placeholder:text-muted-foreground/50 outline-none",
          "max-h-[120px] overflow-y-auto",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className={cn(
          "shrink-0 w-7 h-7 flex items-center justify-center rounded-lg",
          "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors",
          (disabled || !value.trim()) && "opacity-40 cursor-not-allowed"
        )}
      >
        <Send size={13} />
      </button>
    </div>
  );
}
