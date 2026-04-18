"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TabDef {
  href: string;
  label: string;
  /** Match this tab as active if pathname starts with any of these prefixes. */
  matchPrefixes: string[];
}

const TABS: TabDef[] = [
  {
    href: "/data-collection/sources",
    label: "源管理",
    matchPrefixes: ["/data-collection/sources"],
  },
  {
    href: "/data-collection/content",
    label: "内容浏览",
    matchPrefixes: ["/data-collection/content"],
  },
  {
    href: "/data-collection/monitoring",
    label: "监控面板",
    matchPrefixes: ["/data-collection/monitoring"],
  },
];

export function DataCollectionTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="relative mt-5 flex items-center gap-1 border-b border-border"
      aria-label="数据采集导航"
    >
      {TABS.map((t) => {
        const active = t.matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors",
              "-mb-px border-b-2",
              active
                ? "border-primary text-foreground bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
