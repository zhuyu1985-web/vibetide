"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Sparkles as SparklesIcon,
  GitBranch,
  Target,
  SearchX,
  Wand2,
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
  Plus,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MENU_PERMISSION_MAP } from "@/lib/rbac-constants";

/* ─── Types ─── */

interface SubItem { label: string; href: string; icon: LucideIcon }
interface NavItem extends SubItem { children?: SubItem[] }

/* ─── Navigation Data ─── */

const NAV_ITEMS: NavItem[] = [
  { label: "首页", href: "/home", icon: Home },
  {
    label: "智能体", href: "#agents", icon: SparklesIcon,
    children: [
      { label: "AI 员工", href: "/ai-employees", icon: Users },
      { label: "技能管理", href: "/skills", icon: Wrench },
    ],
  },
  { label: "工作流", href: "/workflows", icon: GitBranch },
  { label: "任务", href: "/missions", icon: Target },
  { label: "审核中心", href: "/audit-center", icon: ShieldCheck },
  {
    label: "创作", href: "#creation", icon: Wand2,
    children: [
      { label: "热点发现", href: "/inspiration", icon: Lightbulb },
      { label: "同题对比", href: "/topic-compare", icon: Target },
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
    label: "研究", href: "/research", icon: Telescope,
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
              active ? "bg-primary/10 text-primary font-medium dark:bg-white/10 dark:text-white"
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

/* ─── Unified Nav Item (adapts between collapsed/expanded via CSS) ─── */

function NavLink({ href, icon: Icon, label, active, expanded }: {
  href: string; icon: LucideIcon; label: string; active: boolean; expanded: boolean;
}) {
  return (
    <Link href={href}
      className={cn(
        "flex items-center rounded-xl transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
        active ? "bg-primary/12 text-primary shadow-sm dark:bg-white/12 dark:text-white"
               : "text-muted-foreground hover:bg-accent hover:text-foreground",
        expanded
          ? "flex-row gap-3 px-3 py-2"
          : "flex-col gap-1.5 justify-center w-12 py-2"
      )}>
      <Icon size={18} strokeWidth={active ? 2 : 1.5} className="shrink-0" />
      <span className={cn(
        "font-medium transition-all duration-300 whitespace-nowrap",
        expanded ? "text-[13px] opacity-100" : "text-[10px] leading-none text-center opacity-100"
      )}>{label}</span>
    </Link>
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
    // Collapsed: popover
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            "flex flex-col items-center justify-center gap-1.5 w-12 py-2 rounded-xl",
            "transition-all duration-300 ease-out",
            "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
            "border-0 bg-transparent cursor-pointer",
            active ? "bg-primary/12 text-primary shadow-sm dark:bg-white/12 dark:text-white"
                   : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}>
            <Icon size={18} strokeWidth={active ? 2 : 1.5} />
            <span className="text-[10px] leading-none font-medium">{item.label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8}
          className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">{item.label}</p>
          <SubMenuList items={children} pathname={pathname} />
        </PopoverContent>
      </Popover>
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
        <Icon size={18} strokeWidth={active ? 2 : 1.5} className="shrink-0" />
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
                  childActive ? "bg-primary/10 text-primary font-medium dark:bg-white/10 dark:text-white"
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
      "flex flex-col h-full border-r border-border/50 bg-gray-50 dark:bg-[#0a0f1a] shrink-0",
      "transition-[width] duration-300 ease-out overflow-hidden",
      expanded ? "w-[200px]" : "w-[68px]"
    )}>
      {/* Brand */}
      <div className={cn(
        "flex items-center py-4 shrink-0 transition-all duration-300",
        expanded ? "px-4 gap-3" : "justify-center px-2"
      )}>
        <Link href="/home"
          className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30">
          <SparklesIcon size={20} className="text-white" />
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "flex items-center rounded-xl transition-all duration-300 ease-out",
                  "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
                  "border-0 bg-transparent cursor-pointer",
                  "text-muted-foreground hover:bg-accent hover:text-foreground",
                  expanded ? "flex-row gap-3 px-3 py-2 w-full" : "flex-col gap-1.5 justify-center w-12 py-2"
                )}>
                  <MoreHorizontal size={18} strokeWidth={1.5} className="shrink-0" />
                  <span className={cn("font-medium whitespace-nowrap", expanded ? "text-[13px]" : "text-[10px] leading-none")}>更多</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" sideOffset={8}
                className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                <SubMenuList items={visibleMore} pathname={pathname} />
              </PopoverContent>
            </Popover>
          )}
        </nav>
      </div>

      {/* Bottom — Notification + Settings */}
      <div className={cn(
        "flex flex-col gap-1.5 px-2 pb-8 pt-2 shrink-0 transition-all duration-300",
        expanded ? "items-stretch" : "items-center"
      )}>
        {/* Notification */}
        <Link href="/notifications"
          className={cn(
            "relative flex items-center rounded-xl transition-all duration-300 ease-out",
            "hover:-translate-y-0.5 hover:shadow-md",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            expanded ? "gap-3 px-3 py-2" : "justify-center w-10 h-10"
          )}>
          <Bell size={18} strokeWidth={1.5} className="shrink-0" />
          {expanded && <span className="text-[13px] font-medium">通知</span>}
          {unreadCount > 0 && (
            <span className={cn(
              "w-2 h-2 rounded-full bg-red-500",
              expanded ? "ml-auto" : "absolute top-1.5 right-1.5 ring-2 ring-gray-50 dark:ring-[#0a0f1a]"
            )} />
          )}
        </Link>

        {/* Settings */}
        {canAccessAdmin && (
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "flex items-center rounded-xl transition-all duration-300 ease-out",
                "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
                "border-0 bg-transparent cursor-pointer",
                "text-muted-foreground hover:bg-accent hover:text-foreground",
                expanded ? "gap-3 px-3 py-2 w-full" : "justify-center w-10 h-10"
              )}>
                <Settings size={18} strokeWidth={1.5} className="shrink-0" />
                {expanded && <span className="text-[13px] font-medium">设置</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" sideOffset={8}
              className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
              <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">系统管理</p>
              <SubMenuList items={ADMIN_ITEMS} pathname={pathname} />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
