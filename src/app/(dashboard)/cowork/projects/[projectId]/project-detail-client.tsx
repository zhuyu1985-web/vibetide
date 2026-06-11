"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowLeft,
  Folder,
  MessageSquare,
  ArrowUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startCoworkConversation } from "@/app/actions/cowork-start";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";

export function ProjectDetailClient({
  project,
  conversations,
}: {
  project: Project;
  conversations: Conversation[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    startTransition(async () => {
      const res = await startCoworkConversation(text, { projectId: project.id });
      if (res.ok) router.push(`/cowork/${res.conversationId}`);
      else setInput(text);
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Link
        href="/cowork/projects"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> 全部项目
      </Link>

      <div className="mb-5 flex items-center gap-2.5">
        <span
          className="flex size-10 flex-none items-center justify-center rounded-xl"
          style={{ background: `${project.color ?? "#6b7280"}1f` }}
        >
          <Folder className="size-5" style={{ color: project.color ?? "#6b7280" }} />
        </span>
        <h1 className="truncate text-2xl font-medium">{project.name}</h1>
      </div>

      {/* 项目内新对话输入 */}
      <div className="gemini-border rounded-2xl bg-card transition-shadow duration-300 ease-out dark:bg-white/[0.06]">
        <div className="px-4 pb-1.5 pt-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
            }}
            placeholder="在此项目下开始新对话…"
            rows={1}
            className="max-h-[160px] min-h-[24px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex items-center justify-end px-3 pb-2.5 pt-0.5">
          <button
            onClick={submit}
            disabled={pending || !input.trim()}
            aria-label="发送"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-all duration-200",
              input.trim() && !pending
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "cursor-not-allowed bg-muted text-muted-foreground/40",
            )}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {/* 项目会话 */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          项目会话 · {conversations.length}
        </h2>
        {conversations.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            这个项目还没有会话,在上方输入开始
          </p>
        ) : (
          <div className="space-y-1.5">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/cowork/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 transition-colors hover:border-primary/30 hover:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <MessageSquare className="size-3.5 flex-none text-muted-foreground" />
                  <span className="truncate text-sm">{c.title}</span>
                </span>
                <span className="flex-none text-[11px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(c.lastMessageAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
