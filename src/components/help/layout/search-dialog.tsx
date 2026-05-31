"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchHelp, type PagefindResult } from "@/lib/help/search-client";

const HOT_TERMS = ["第一个工作流", "AI 员工技能", "CMS 接入", "全渠道发布"];

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // 关闭时重置
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // 搜索 debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchHelp(query, 8);
        setResults(r);
        setSelectedIdx(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // 键盘上下 / Enter
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const r = results[selectedIdx];
        if (r) {
          router.push(r.url);
          onOpenChange(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selectedIdx, router, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        {/* 屏幕阅读器专用 title,Radix Dialog 强制要求(不可见但 a11y 必需) */}
        <DialogTitle className="sr-only">搜索文档</DialogTitle>
        <div className="border-b border-border/60 p-3 flex items-center gap-2">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文档…"
            className="flex-1 border-0 bg-transparent text-sm h-7 px-0 focus-visible:ring-0 shadow-none"
          />
        </div>
        {/* 固定高度!不要 max-h-X — CLAUDE.md "Dialog/Popover 内可滚动列表必须用固定高度" */}
        <div className="h-[400px] overflow-y-auto">
          {!query.trim() ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <span>试试搜:</span>
              <div className="flex gap-2 flex-wrap justify-center px-6">
                {HOT_TERMS.map((t) => (
                  <Button
                    key={t}
                    variant="secondary"
                    size="sm"
                    onClick={() => setQuery(t)}
                    className="h-7 px-3 rounded-full text-xs"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              正在搜索…
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              没有找到结果
            </div>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li
                  key={r.url}
                  onClick={() => {
                    router.push(r.url);
                    onOpenChange(false);
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`px-4 py-3 cursor-pointer border-b border-border/40 last:border-b-0 transition-colors ${
                    i === selectedIdx ? "bg-muted" : ""
                  }`}
                >
                  <div className="font-medium text-sm text-foreground">{r.meta.title}</div>
                  <div
                    className="text-xs text-muted-foreground mt-1 line-clamp-2 [&>mark]:bg-amber-200/50 [&>mark]:text-foreground [&>mark]:px-0.5 [&>mark]:rounded"
                    dangerouslySetInnerHTML={{ __html: r.excerpt }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
