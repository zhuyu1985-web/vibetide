"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TocEntry } from "@/lib/help/types";

export function DocToc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (e) => {
        const visible = e
          .filter((x) => x.isIntersecting)
          .sort(
            (a, b) =>
              a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top
          );
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" }
    );
    entries.forEach((e) => {
      const el = document.getElementById(e.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="本页目录" className="text-xs">
      <p className="font-semibold mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        本页内容
      </p>
      <ul className="space-y-1.5">
        {entries.map((e) => (
          <li key={e.id} className={cn(e.depth === 3 && "ml-3")}>
            <a
              href={`#${e.id}`}
              className={cn(
                "block py-0.5 transition-colors",
                e.id === activeId
                  ? "text-sky-700 dark:text-sky-300 font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
