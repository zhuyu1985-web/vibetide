"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchDialog } from "./search-dialog";

export function HelpHeader() {
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K 全局监听
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="h-14 border-b border-border/60 sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center gap-4">
          <Link href="/help" className="flex items-center gap-2.5 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0b1224] via-[#1e3a8a] to-[#0ea5e9] flex items-center justify-center text-white font-extrabold text-sm">M</span>
            <span className="text-[15px] font-semibold text-foreground">Vibe Media 帮助中心</span>
          </Link>
          <div className="flex-1 max-w-md mx-auto">
            <Button
              data-help-search-input
              variant="ghost"
              onClick={() => setSearchOpen(true)}
              className="w-full h-9 justify-start gap-2 px-3 text-muted-foreground"
            >
              <Search size={14} />
              <span className="flex-1 text-left text-[13px]">搜索文档…</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-background/60">⌘K</kbd>
            </Button>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/home">返回平台 →</Link>
          </Button>
        </div>
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
