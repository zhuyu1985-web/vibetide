"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HeroSearchProps {
  hotTerms: string[];
}

export function HeroSearch({ hotTerms }: HeroSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submitQuery = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/help/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitQuery(query);
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950" />
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          你好,需要什么帮助?
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground">
          搜索使用文档、AI 员工指南、工作流配置与常见问题
        </p>
        <form onSubmit={handleSubmit} className="mt-8">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文档、AI 员工、工作流…"
            className="h-12 text-base px-4"
            aria-label="搜索帮助中心"
          />
        </form>
        {hotTerms.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">热门搜索:</span>
            {hotTerms.map((term) => (
              <Button
                key={term}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery(term);
                  submitQuery(term);
                }}
              >
                {term}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
