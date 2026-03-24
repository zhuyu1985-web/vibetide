"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "./use-ai-chat";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      {!isUser && (
        <span className="text-[10px] text-muted-foreground ml-1">✦ AI 助手</span>
      )}
      <div
        className={cn(
          "rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words max-w-[90%]",
          isUser
            ? "bg-blue-500/10 ml-6"
            : "bg-muted/50"
        )}
      >
        {message.content || "..."}
      </div>
    </div>
  );
}
