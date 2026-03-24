"use client";
import { useOutline } from "./use-outline";
import { cn } from "@/lib/utils";

interface OutlinePanelProps {
  htmlContent: string;
  activeIndex?: number;
  onItemClick?: (position: number) => void;
}

export function OutlinePanel({ htmlContent, activeIndex, onItemClick }: OutlinePanelProps) {
  const items = useOutline(htmlContent);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
        文章较短，无需导航
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <nav className="space-y-0.5">
        {items.map((item, i) => (
          <button
            key={item.id}
            className={cn(
              "block w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate",
              item.level === 1 && "font-medium",
              item.level === 2 && "pl-4",
              item.level === 3 && "pl-6 text-muted-foreground",
              activeIndex === i
                ? "bg-blue-500/10 text-blue-500"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            onClick={() => onItemClick?.(item.position)}
          >
            {item.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
