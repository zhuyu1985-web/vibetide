"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HelpHeader() {
  const router = useRouter();
  return (
    <header className="h-14 border-b border-border/60 sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto h-full px-4 flex items-center gap-4">
        <Link href="/help" className="flex items-center gap-2.5 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0b1224] via-[#1e3a8a] to-[#0ea5e9] flex items-center justify-center text-white font-extrabold text-sm">M</span>
          <span className="text-[15px] font-semibold text-foreground">Vibe Media 帮助中心</span>
        </Link>
        <div className="flex-1 max-w-md mx-auto">
          {/* 搜索 trigger - Phase 6 接 SearchDialog,目前先跳 /help/search */}
          <Button
            data-help-search-input
            variant="ghost"
            onClick={() => router.push("/help/search")}
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
  );
}
