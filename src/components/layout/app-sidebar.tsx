"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Bot,
  Workflow,
  ListTodo,
  SearchX,
  PenLine,
  FolderOpen,
  BarChart3,
  MoreHorizontal,
  Settings,
  Bell,
  Lightbulb,
  PenTool,
  Gem,
  Film,
  FileStack,
  Radio,
  CalendarDays,
  Package,
  FileText,
  Brain as BrainIcon,
  BookMarked,
  Star,
  TrendingUp,
  Award,
  Building2,
  Users,
  Shield,
  CheckSquare,
  ShieldCheck,
  ChevronDown,
  Wrench,
  Telescope,
  Compass,
  Plus,
  Database,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MENU_PERMISSION_MAP } from "@/lib/rbac-constants";

/* ─── Optical size compensation ─────────────────────────────
   Lucide icons all use a 24×24 viewBox, but the drawn content
   varies in density. A few icons (Bot / ShieldCheck / Radio …)
   have inner padding, making them look smaller than siblings
   like Home / FolderOpen. This map bumps those up by 2px.
   ──────────────────────────────────────────────────────────── */
const OPTICAL_ICON_SIZE: Record<string, number> = {
  智能体: 22,
  审核中心: 22,
  渠道集成: 22,
  任务: 22,
  数据: 22,
};
function iconSizeFor(label: string, base = 20): number {
  return OPTICAL_ICON_SIZE[label] ?? base;
}

/* ─── Hover-controlled popover state hook ─── */
function useHoverPopover(delayClose = 120) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openNow = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(true);
  };
  const closeSoon = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), delayClose);
  };
  return { open, setOpen, openNow, closeSoon };
}

/* ─── Types ─── */

interface SubItem { label: string; href: string; icon: LucideIcon }
interface NavItem extends SubItem { children?: SubItem[] }

/* ─── Navigation Data ─── */

const NAV_ITEMS: NavItem[] = [
  { label: "首页", href: "/home", icon: Home },
  {
    label: "智能体", href: "#agents", icon: Bot,
    children: [
      { label: "AI 员工", href: "/ai-employees", icon: Users },
      { label: "技能管理", href: "/skills", icon: Wrench },
    ],
  },
  { label: "工作流", href: "/workflows", icon: Workflow },
  { label: "任务", href: "/missions", icon: ListTodo },
  { label: "审核中心", href: "/audit-center", icon: ShieldCheck },
  { label: "渠道集成", href: "/settings/channels", icon: Radio },
  { label: "数据采集", href: "/data-collection", icon: Database },
  {
    label: "创作", href: "#creation", icon: PenLine,
    children: [
      { label: "热点发现", href: "/inspiration", icon: Lightbulb },
      { label: "同题对比", href: "/topic-compare", icon: Compass },
      { label: "漏题筛查", href: "/missing-topics", icon: SearchX },
      { label: "超级创作", href: "/super-creation", icon: PenTool },
      { label: "精品聚合", href: "/premium-content", icon: Gem },
      { label: "短视频工厂", href: "/video-batch", icon: Film },
      { label: "生产模板", href: "/production-templates", icon: FileStack },
      { label: "全渠道发布", href: "/publishing", icon: Radio },
      { label: "节赛会展", href: "/event-auto", icon: CalendarDays },
    ],
  },
  {
    label: "内容", href: "#content", icon: FolderOpen,
    children: [
      { label: "媒资管理", href: "/media-assets", icon: Package },
      { label: "稿件管理", href: "/articles", icon: FileText },
      { label: "智能分析", href: "/asset-intelligence", icon: BrainIcon },
      { label: "知识库", href: "/knowledge-bases", icon: BookMarked },
      { label: "智能推荐", href: "/asset-revive", icon: Star },
      { label: "案例库", href: "/case-library", icon: Award },
    ],
  },
  {
    label: "数据", href: "#analytics", icon: BarChart3,
    children: [
      { label: "数据看板", href: "/analytics", icon: TrendingUp },
      { label: "效果激励", href: "/leaderboard", icon: Award },
      { label: "精品提升率", href: "/content-excellence", icon: Star },
    ],
  },
  {
    label: "研究", href: "/research", icon: Compass,
    children: [
      { label: "检索工作台", href: "/research", icon: Telescope },
      { label: "采集任务", href: "/research/admin/tasks", icon: FileText },
      { label: "媒体源管理", href: "/research/admin/media-outlets", icon: Radio },
      { label: "主题词库", href: "/research/admin/topics", icon: BookMarked },
    ],
  },
];

const MORE_ITEMS: SubItem[] = [
  { label: "频道顾问", href: "/channel-advisor", icon: BrainIcon },
  { label: "批量审核", href: "/batch-review", icon: CheckSquare },
];

const ADMIN_ITEMS: SubItem[] = [
  { label: "用户管理", href: "/admin/users", icon: Users },
  { label: "角色权限", href: "/admin/roles", icon: Shield },
  { label: "组织管理", href: "/admin/organizations", icon: Building2 },
];

/* ─── Helpers ─── */

function isHrefActive(pathname: string, href: string) {
  if (href.startsWith("#")) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function hasActiveChild(pathname: string, children?: SubItem[]) {
  return children?.some((c) => isHrefActive(pathname, c.href)) ?? false;
}

/* ─── Popover sub-menu (collapsed mode only) ─── */

function SubMenuList({ items, pathname }: { items: SubItem[]; pathname: string }) {
  return (
    <div className="space-y-0.5">
      {items.map((child) => {
        const ChildIcon = child.icon;
        const active = isHrefActive(pathname, child.href);
        return (
          <Link key={child.href} href={child.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150",
              active ? "nav-selected-sub font-medium"
                     : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}>
            <ChildIcon size={15} className="shrink-0" />
            <span>{child.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Settings button (hover popover when collapsed, click when expanded) ─── */

function SettingsButton({ pathname, expanded }: { pathname: string; expanded: boolean }) {
  const { open, setOpen, openNow, closeSoon } = useHoverPopover();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={expanded ? undefined : openNow}
          onMouseLeave={expanded ? undefined : closeSoon}
          className={cn(
            "flex items-center rounded-xl transition-all duration-200 ease-out",
            "hover:-translate-y-0.5 active:translate-y-0",
            !expanded && "hover:rotate-[15deg] active:rotate-0",
            "border-0 bg-transparent cursor-pointer",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            expanded ? "gap-3 px-3 py-2 w-full" : "justify-center w-11 h-11"
          )}
        >
          <Settings size={20} strokeWidth={1.7} className="shrink-0" />
          {expanded && <span className="text-[13px] font-medium">设置</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={10}
        onMouseEnter={expanded ? undefined : openNow}
        onMouseLeave={expanded ? undefined : closeSoon}
        className="w-48 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_-8px_rgba(30,58,138,0.18),0_24px_64px_-24px_rgba(30,58,138,0.22)]"
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/55">系统管理</p>
        <SubMenuList items={ADMIN_ITEMS} pathname={pathname} />
      </PopoverContent>
    </Popover>
  );
}

/* ─── "More" button (hover popover when collapsed, click when expanded) ─── */

function MoreButton({ items, pathname, expanded }: {
  items: SubItem[]; pathname: string; expanded: boolean;
}) {
  const { open, setOpen, openNow, closeSoon } = useHoverPopover();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={expanded ? undefined : openNow}
          onMouseLeave={expanded ? undefined : closeSoon}
          className={cn(
            "flex items-center rounded-xl transition-all duration-200 ease-out",
            "hover:-translate-y-0.5 active:translate-y-0",
            !expanded && "hover:rotate-[15deg] active:rotate-0",
            "border-0 bg-transparent cursor-pointer",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            expanded
              ? "flex-row gap-3 px-3 py-2 w-full"
              : "justify-center w-11 h-11"
          )}
        >
          <MoreHorizontal size={20} strokeWidth={1.7} className="shrink-0" />
          {expanded && <span className="text-[13px] font-medium whitespace-nowrap">更多</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        onMouseEnter={expanded ? undefined : openNow}
        onMouseLeave={expanded ? undefined : closeSoon}
        className="w-48 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_-8px_rgba(30,58,138,0.18),0_24px_64px_-24px_rgba(30,58,138,0.22)]"
      >
        <SubMenuList items={items} pathname={pathname} />
      </PopoverContent>
    </Popover>
  );
}

/* ─── Hover-triggered collapsed nav group (icon + flyout submenu) ─── */

function HoverNavGroup({ item, active, children, pathname, Icon }: {
  item: NavItem;
  active: boolean;
  children: SubItem[];
  pathname: string;
  Icon: LucideIcon;
}) {
  const { open, setOpen, openNow, closeSoon } = useHoverPopover();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-xl",
            "transition-all duration-200 ease-out",
            "hover:-translate-y-0.5 hover:rotate-[15deg] active:translate-y-0 active:rotate-0",
            "border-0 bg-transparent cursor-pointer",
            active ? "nav-selected"
                   : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon size={iconSizeFor(item.label)} strokeWidth={active ? 2 : 1.7} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        className="w-48 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_-8px_rgba(30,58,138,0.18),0_24px_64px_-24px_rgba(30,58,138,0.22)]"
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/55">
          {item.label}
        </p>
        <SubMenuList items={children} pathname={pathname} />
      </PopoverContent>
    </Popover>
  );
}

/* ─── Unified Nav Item (adapts between collapsed/expanded via CSS) ─── */

function NavLink({ href, icon: Icon, label, active, expanded }: {
  href: string; icon: LucideIcon; label: string; active: boolean; expanded: boolean;
}) {
  const link = (
    <Link href={href}
      className={cn(
        "flex items-center rounded-xl transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 active:translate-y-0",
        !expanded && "hover:rotate-[15deg] active:rotate-0",
        active ? "nav-selected"
               : "text-muted-foreground hover:bg-accent hover:text-foreground",
        expanded
          ? "flex-row gap-3 px-3 py-2"
          : "justify-center w-11 h-11"
      )}>
      <Icon size={iconSizeFor(label)} strokeWidth={active ? 2 : 1.7} className="shrink-0" />
      {expanded && (
        <span className="text-[13px] font-medium whitespace-nowrap">{label}</span>
      )}
    </Link>
  );

  if (expanded) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="px-2.5 py-1 text-[11px] font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Unified Nav Group (collapsed=popover, expanded=inline children) ─── */

function NavGroup({ item, pathname, canSeeItem, expanded }: {
  item: NavItem; pathname: string; canSeeItem: (h: string) => boolean; expanded: boolean;
}) {
  const children = item.children?.filter((c) => canSeeItem(c.href)) ?? [];
  if (!children.length) return null;
  const Icon = item.icon;
  const active = hasActiveChild(pathname, children);
  const [open, setOpen] = useState(active);

  if (!expanded) {
    // Collapsed: hover-triggered popover (opens on hover, closes with small delay)
    return (
      <HoverNavGroup item={item} active={active} children={children} pathname={pathname} Icon={Icon} />
    );
  }

  // Expanded: inline toggle + children
  return (
    <div>
      <button onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium w-full",
          "transition-all duration-300 ease-out border-0 bg-transparent cursor-pointer",
          "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
          active ? "text-primary dark:text-white"
                 : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}>
        <Icon size={iconSizeFor(item.label)} strokeWidth={active ? 2 : 1.7} className="shrink-0" />
        <span className="flex-1 text-left truncate">{item.label}</span>
        <ChevronDown size={14}
          className={cn("shrink-0 text-muted-foreground/50 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        open ? "max-h-[500px] opacity-100 mt-0.5" : "max-h-0 opacity-0"
      )}>
        <div className="ml-[22px] space-y-0.5">
          {children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isHrefActive(pathname, child.href);
            return (
              <Link key={child.href} href={child.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors duration-150",
                  childActive ? "nav-selected-sub font-medium"
                              : "text-muted-foreground/80 hover:bg-accent hover:text-foreground"
                )}>
                <ChildIcon size={14} className="shrink-0" />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN SIDEBAR
   ═══════════════════════════════════════════════════════════ */

export function AppSidebar({
  permissions = [],
  unreadCount = 0,
  expanded = false,
}: {
  permissions?: string[];
  unreadCount?: number;
  expanded?: boolean;
}) {
  const pathname = usePathname();
  const hasAllPerms = permissions.length === 0;
  const canAccessAdmin =
    hasAllPerms ||
    permissions.includes("system:manage_users") ||
    permissions.includes("system:manage_orgs") ||
    permissions.includes("system:manage_roles");

  function canSeeItem(href: string) {
    if (hasAllPerms) return true;
    const perm = MENU_PERMISSION_MAP[href];
    return !perm || permissions.includes(perm);
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.children) return item.children.some((c) => canSeeItem(c.href));
    return canSeeItem(item.href);
  });

  const visibleMore = MORE_ITEMS.filter((i) => canSeeItem(i.href));

  return (
    <div className={cn(
      "flex flex-col h-full glass-sidebar shrink-0",
      "transition-[width] duration-300 ease-out overflow-hidden",
      expanded ? "w-[200px]" : "w-[60px]"
    )}>
      {/* Brand */}
      <div className={cn(
        "flex items-center py-4 shrink-0 transition-all duration-300",
        expanded ? "px-4 gap-3" : "justify-center px-2"
      )}>
        <Link
          href="/home"
          className={cn(
            "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5",
            !expanded && "hover:rotate-[15deg]"
          )}
          style={{
            background:
              "linear-gradient(135deg, #0b1224 0%, #1e3a8a 45%, #0ea5e9 100%)",
            boxShadow:
              "0 8px 24px -6px rgba(14, 165, 233, 0.45), 0 4px 14px -4px rgba(30, 64, 175, 0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          {/* soft inner glow */}
          <span
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background:
                "radial-gradient(120% 80% at 30% 10%, rgba(125, 211, 252, 0.35), transparent 55%)",
            }}
          />
          <span
            className="relative font-extrabold text-[18px] leading-none tracking-tight"
            style={{
              background: "linear-gradient(180deg, #bae6fd 0%, #ffffff 85%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "0 1px 2px rgba(255,255,255,0.15)",
            }}
          >
            N
          </span>
        </Link>
        <div className={cn(
          "overflow-hidden transition-all duration-300 whitespace-nowrap",
          expanded ? "w-auto opacity-100" : "w-0 opacity-0"
        )}>
          <h1 className="text-base font-bold leading-tight">
            <span className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">Vibe</span>
            <span className="text-foreground ml-0.5">Media</span>
          </h1>
          <p className="text-[10px] text-muted-foreground/60 leading-tight tracking-wide">数智全媒平台</p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
        <nav className={cn(
          "flex flex-col gap-0.5 px-2 py-1 transition-all duration-300",
          !expanded && "items-center"
        )}>
          {visibleNav.map((item) =>
            item.children ? (
              <NavGroup key={item.href} item={item} pathname={pathname} canSeeItem={canSeeItem} expanded={expanded} />
            ) : (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label}
                active={isHrefActive(pathname, item.href)} expanded={expanded} />
            )
          )}
          {/* More */}
          {visibleMore.length > 0 && (
            <MoreButton items={visibleMore} pathname={pathname} expanded={expanded} />
          )}
        </nav>
      </div>

      {/* Bottom — Notification + Settings */}
      <div className={cn(
        "flex flex-col gap-1.5 px-2 pb-8 pt-2 shrink-0 transition-all duration-300",
        expanded ? "items-stretch" : "items-center"
      )}>
        {/* Notification */}
        {(() => {
          const notifEl = (
            <Link href="/notifications"
              className={cn(
                "relative flex items-center rounded-xl transition-all duration-200 ease-out",
                "hover:-translate-y-0.5",
                !expanded && "hover:rotate-[15deg] active:rotate-0",
                "text-muted-foreground hover:bg-accent hover:text-foreground",
                expanded ? "gap-3 px-3 py-2" : "justify-center w-11 h-11"
              )}>
              <Bell size={20} strokeWidth={1.7} className="shrink-0" />
              {expanded && <span className="text-[13px] font-medium">通知</span>}
              {unreadCount > 0 && (
                <span className={cn(
                  "w-2 h-2 rounded-full bg-red-500",
                  expanded ? "ml-auto" : "absolute top-2 right-2"
                )} />
              )}
            </Link>
          );
          return expanded ? notifEl : (
            <Tooltip>
              <TooltipTrigger asChild>{notifEl}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className="px-2.5 py-1 text-[11px] font-medium">通知</TooltipContent>
            </Tooltip>
          );
        })()}

        {/* Settings */}
        {canAccessAdmin && (
          <SettingsButton pathname={pathname} expanded={expanded} />
        )}
      </div>
    </div>
  );
}
