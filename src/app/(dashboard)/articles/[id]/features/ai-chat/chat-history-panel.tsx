"use client";

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { getChatHistory } from "@/app/actions/ai-analysis";

interface ChatHistoryItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatHistoryPanelProps {
  articleId: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d.getTime() === today.getTime()) return "今天";
  if (d.getTime() === yesterday.getTime()) return "昨天";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function ChatHistoryPanel({ articleId }: ChatHistoryPanelProps) {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getChatHistory(articleId);
        setHistory(data);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [articleId]);

  // Only show user messages (they represent the "question" side of a conversation turn)
  const userMessages = useMemo(
    () => history.filter((m) => m.role === "user"),
    [history]
  );

  const filtered = useMemo(() => {
    if (!keyword.trim()) return userMessages;
    const lower = keyword.toLowerCase();
    return userMessages.filter((m) =>
      m.content.toLowerCase().includes(lower)
    );
  }, [userMessages, keyword]);

  // Group by date label
  const grouped = useMemo(() => {
    const map = new Map<string, ChatHistoryItem[]>();
    for (const item of filtered) {
      const label = formatDate(item.createdAt);
      const arr = map.get(label) ?? [];
      arr.push(item);
      map.set(label, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2.5 py-1.5">
          <Search size={12} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索对话记录…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 min-w-0"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            加载中…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1.5 text-center px-4">
            <span className="text-lg opacity-40">🗂</span>
            <p className="text-xs text-muted-foreground">
              {keyword ? "未找到匹配记录" : "暂无对话历史"}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {grouped.map(([dateLabel, items]) => (
              <div key={dateLabel}>
                {/* Date header */}
                <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide sticky top-0 bg-[var(--glass-panel-bg)]/80 backdrop-blur-sm">
                  {dateLabel}
                </div>
                {/* Items */}
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="mx-2 px-2.5 py-2 rounded-lg hover:bg-muted/50 cursor-default transition-colors"
                  >
                    <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
                      {truncate(item.content, 50)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {formatTime(item.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
