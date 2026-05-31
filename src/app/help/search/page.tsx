"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchResults } from "@/components/help/search/search-results";

function SearchPageContent() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  return <SearchResults initialQuery={q} />;
}

export default function SearchPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">搜索结果</h1>
      <Suspense fallback={<div className="text-sm text-muted-foreground">加载中…</div>}>
        <SearchPageContent />
      </Suspense>
    </div>
  );
}
