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

/* ─── Types ─── */

interface MorePanelItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface MorePanelProps {
  canSeeItem: (href: string) => boolean;
  canAccessAdmin: boolean;
}

/* ─── Data ─── */

const regularItems: MorePanelItem[] = [
  { label: "频道顾问", href: "/channel-advisor", icon: Brain },
  { label: "节赛会展", href: "/event-auto", icon: CalendarDays },
  { label: "批量审核", href: "/batch-review", icon: CheckSquare },
  { label: "案例库", href: "/case-library", icon: BookOpen },
];

const adminItems: MorePanelItem[] = [
  { label: "组织管理", href: "/admin/organizations", icon: Building2 },
  { label: "用户管理", href: "/admin/users", icon: Users },
  { label: "角色权限", href: "/admin/roles", icon: Shield },
];

/* ─── Helper ─── */

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/* ─── Component ─── */

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
            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium",
            "transition-all duration-200 ease-out",
            "glass-nav-item",
            "border-0 outline-none",
            "group/nav-item",
            anyActive && "active",
            anyActive
              ? "text-blue-400/80 dark:text-blue-300/80"
              : "text-muted-foreground/70 hover:text-foreground"
          )}
        >
          <MoreHorizontal
            size={18}
            className={cn(
              "shrink-0 transition-colors duration-200",
              anyActive
                ? "text-blue-400/80 dark:text-blue-300/80"
                : "text-muted-foreground/50 group-hover/nav-item:text-blue-400/80 dark:group-hover/nav-item:text-blue-300/80"
            )}
          />
          <span className="overflow-hidden transition-[opacity,width] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            更多
          </span>
          {anyActive && (
            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-blue-400/80 to-indigo-400/80" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-64 rounded-xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-black/80 p-3 shadow-2xl backdrop-blur-xl"
      >
        {/* Regular items */}
        <div className="grid grid-cols-2 gap-1">
          {visibleRegular.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium",
                  "transition-all duration-150 border-0",
                  active
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                    : "text-gray-700 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {visibleAdmin.length > 0 && (
          <>
            <div className="my-2 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300 dark:text-white/30">
              系统管理
            </p>
            <div className="grid grid-cols-2 gap-1">
              {visibleAdmin.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium",
                      "transition-all duration-150 border-0",
                      active
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                        : "text-gray-700 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
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
