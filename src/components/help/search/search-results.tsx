"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchHelp, type PagefindResult } from "@/lib/help/search-client";

export function SearchResults({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchHelp(query, 20);
        setResults(r);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/help/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文档…"
            className="pl-10 h-11"
          />
        </div>
      </form>

      {!query.trim() ? (
        <p className="text-sm text-muted-foreground">输入关键词搜索文档</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">正在搜索…</p>
      ) : results.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">没找到 &quot;<strong className="text-foreground">{query}</strong>&quot; 的相关文档</p>
          <Button asChild variant="secondary"><Link href="/help">浏览全部分类</Link></Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">找到 {results.length} 个结果</p>
          <ul className="space-y-3">
            {results.map((r) => (
              <li key={r.url}>
                <Link href={r.url} className="block rounded-lg border border-border/60 p-4 hover:border-sky-300 hover:bg-sky-50/30 dark:hover:bg-sky-950/20 transition-colors">
                  <div className="text-sm font-semibold text-foreground">{r.meta.title}</div>
                  <div
                    className="mt-2 text-xs text-muted-foreground line-clamp-2 [&>mark]:bg-amber-200/50 [&>mark]:text-foreground [&>mark]:px-0.5 [&>mark]:rounded"
                    dangerouslySetInnerHTML={{ __html: r.excerpt }}
                  />
                  <div className="mt-2 text-[11px] text-muted-foreground/70">{r.url}</div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
