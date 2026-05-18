"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SUB_TABS = [
  { href: "/data-collection/sources", label: "源管理" },
  { href: "/data-collection/outlets", label: "媒体字典" },
];

export function ConfigSubtabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-2 mb-4">
      {SUB_TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors border-0",
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
