"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, ListChecks, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitCoworkMessage } from "@/app/actions/cowork-submit";
import type { Conversation, ConversationMessage } from "@/db/schema/conversations";

interface Props {
  active: { conversation: Conversation; messages: ConversationMessage[] } | null;
  focusedMissionId: string | null;
  onMissionFocus: (missionId: string) => void;
}

export function ConversationThread({ active, focusedMissionId, onMissionFocus }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text || !active || pending) return;
    const conversationId = active.conversation.id;
    setInput("");
    startTransition(async () => {
      const res = await submitCoworkMessage(conversationId, text);
      if (res.ok && res.kind === "mission") onMissionFocus(res.missionId);
      router.refresh();
    });
  }

  if (!active) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background text-center">
        <Sparkles className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          新建或选择一个对话，开始 cowork
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-background">
      {/* 顶栏 */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="truncate text-sm font-medium">{active.conversation.title}</span>
      </div>

      {/* 消息流 */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {active.messages.length === 0 ? (
          <p className="pt-10 text-center text-xs text-muted-foreground">
            说点什么，我会解析意图并安排任务执行
          </p>
        ) : (
          active.messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              focused={m.missionId != null && m.missionId === focusedMissionId}
              onMissionFocus={onMissionFocus}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入需求，回车发送（Shift+Enter 换行）…"
            className="max-h-32 min-h-10 flex-1 resize-none"
            rows={1}
          />
          <Button
            size="icon"
            disabled={pending || !input.trim()}
            onClick={handleSend}
            aria-label="发送"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </main>
  );
}

function MessageBubble({
  message,
  focused,
  onMissionFocus,
}: {
  message: ConversationMessage;
  focused: boolean;
  onMissionFocus: (missionId: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.kind === "mission_card" && message.missionId) {
    const missionId = message.missionId;
    return (
      <div className="flex justify-start">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onMissionFocus(missionId)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onMissionFocus(missionId);
            }
          }}
          className={cn(
            "flex max-w-[90%] cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
            focused ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted hover:bg-muted/70",
          )}
        >
          <ListChecks className="size-4 flex-none text-primary" />
          <div className="min-w-0">
            <div className="text-sm font-medium">{message.content || "已启动任务"}</div>
            <div className="text-[11px] text-muted-foreground">点击在右侧查看执行过程</div>
          </div>
          <ArrowRight className="size-4 flex-none text-muted-foreground" />
        </div>
      </div>
    );
  }

  // assistant text
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-muted px-3.5 py-2 text-sm text-foreground">
        {message.content}
      </div>
    </div>
  );
}
