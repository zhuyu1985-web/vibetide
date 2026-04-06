"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  CalendarDays,
  CheckSquare,
  BookOpen,
  Building2,
  Users,
  Shield,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* ─── Data ─── */

interface MoreItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const regularItems: MoreItem[] = [
  { label: "频道顾问", href: "/channel-advisor", icon: Brain },
  { label: "节赛会展", href: "/event-auto", icon: CalendarDays },
  { label: "批量审核", href: "/batch-review", icon: CheckSquare },
  { label: "案例库", href: "/case-library", icon: BookOpen },
];

const adminItems: MoreItem[] = [
  { label: "组织管理", href: "/admin/organizations", icon: Building2 },
  { label: "用户管理", href: "/admin/users", icon: Users },
  { label: "角色权限", href: "/admin/roles", icon: Shield },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/* ─── Component ─── */

interface MorePanelProps {
  canSeeItem: (href: string) => boolean;
  canAccessAdmin: boolean;
}

export function MorePanel({ canSeeItem, canAccessAdmin }: MorePanelProps) {
  const pathname = usePathname();

  const visibleRegular = regularItems.filter((item) => canSeeItem(item.href));
  const visibleAdmin = canAccessAdmin ? adminItems : [];

  if (visibleRegular.length === 0 && visibleAdmin.length === 0) return null;

  const anyActive = [...visibleRegular, ...visibleAdmin].some((item) =>
    isItemActive(pathname, item.href)
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium",
            "transition-colors duration-150 cursor-pointer",
            "border-0 bg-transparent outline-none",
            anyActive
              ? "text-primary dark:text-white"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <MoreHorizontal
            size={18}
            className={cn(
              "shrink-0",
              anyActive ? "text-primary dark:text-white" : ""
            )}
          />
          <span className="truncate transition-[opacity,width] duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            更多
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl border border-border bg-popover p-2 shadow-xl"
      >
        {/* Regular items */}
        <div className="space-y-0.5">
          {visibleRegular.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]",
                  "transition-colors duration-150",
                  active
                    ? "bg-primary/10 text-primary font-medium dark:bg-white/10 dark:text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {visibleAdmin.length > 0 && (
          <>
            <div className="my-1.5 h-px bg-border/50" />
            <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
              系统管理
            </p>
            <div className="space-y-0.5">
              {visibleAdmin.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]",
                      "transition-colors duration-150",
                      active
                        ? "bg-primary/10 text-primary font-medium dark:bg-white/10 dark:text-white"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
