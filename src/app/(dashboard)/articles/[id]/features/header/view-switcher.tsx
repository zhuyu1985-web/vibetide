"use client";

import { useArticlePageStore } from "../../store";
import type { ActiveView } from "../../types";
import { cn } from "@/lib/utils";

const views: { key: ActiveView; label: string }[] = [
  { key: "immersive", label: "沉浸阅读" },
  { key: "web", label: "原始网页" },
  { key: "brief", label: "AI速览" },
  { key: "archive", label: "网页存档" },
];

export function ViewSwitcher() {
  const activeView = useArticlePageStore((s) => s.activeView);
  const setActiveView = useArticlePageStore((s) => s.setActiveView);

  return (
    <div className="flex items-center rounded-lg bg-muted/50 p-0.5">
      {views.map((v) => (
        <button
          key={v.key}
          onClick={() => setActiveView(v.key)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            activeView === v.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
