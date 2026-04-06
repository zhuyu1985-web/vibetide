"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Sparkles as SparklesIcon,
  GitBranch,
  Target,
  Wand2,
  FolderOpen,
  BarChart3,
  MoreHorizontal,
  Settings,
  Lightbulb,
  Crosshair,
  PenTool,
  Gem,
  Film,
  FileStack,
  Radio,
  CalendarDays,
  Package,
  FileText,
  Brain as BrainIcon,
  BookOpen,
  Star,
  TrendingUp,
  Award,
  Building2,
  Users,
  Shield,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { MENU_PERMISSION_MAP } from "@/lib/rbac-constants";

/* ─── Types ─── */

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string; icon: LucideIcon }[];
}

/* ─── Navigation Data ─── */

const NAV_ITEMS: NavItem[] = [
  { label: "首页", href: "/home", icon: Home },
  { label: "智能体", href: "/ai-employees", icon: SparklesIcon },
  { label: "工作流", href: "/workflows", icon: GitBranch },
  { label: "任务", href: "/missions", icon: Target },
  {
    label: "创作",
    href: "#creation",
    icon: Wand2,
    children: [
      { label: "灵感池", href: "/inspiration", icon: Lightbulb },
      { label: "同题对标", href: "/benchmarking", icon: Crosshair },
      { label: "超级创作", href: "/super-creation", icon: PenTool },
      { label: "精品聚合", href: "/premium-content", icon: Gem },
      { label: "短视频工厂", href: "/video-batch", icon: Film },
      { label: "生产模板", href: "/production-templates", icon: FileStack },
      { label: "全渠道发布", href: "/publishing", icon: Radio },
      { label: "节赛会展", href: "/event-auto", icon: CalendarDays },
    ],
  },
  {
    label: "内容",
    href: "#content",
    icon: FolderOpen,
    children: [
      { label: "媒资管理", href: "/media-assets", icon: Package },
      { label: "稿件管理", href: "/articles", icon: FileText },
      { label: "智能分析", href: "/asset-intelligence", icon: BrainIcon },
      { label: "知识库", href: "/channel-knowledge", icon: BookOpen },
      { label: "智能推荐", href: "/asset-revive", icon: Star },
      { label: "案例库", href: "/case-library", icon: Award },
    ],
  },
  {
    label: "数据",
    href: "#analytics",
    icon: BarChart3,
    children: [
      { label: "数据看板", href: "/analytics", icon: TrendingUp },
      { label: "效果激励", href: "/leaderboard", icon: Award },
      { label: "精品提升率", href: "/content-excellence", icon: Star },
    ],
  },
];

const MORE_ITEMS = [
  { label: "频道顾问", href: "/channel-advisor", icon: BrainIcon },
  { label: "批量审核", href: "/batch-review", icon: CheckSquare },
];

const ADMIN_ITEMS = [
  { label: "用户管理", href: "/admin/users", icon: Users },
  { label: "角色权限", href: "/admin/roles", icon: Shield },
  { label: "组织管理", href: "/admin/organizations", icon: Building2 },
];

/* ─── Helpers ─── */

function isActive(pathname: string, href: string) {
  if (href.startsWith("#")) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function isChildActive(pathname: string, children?: NavItem["children"]) {
  return children?.some((c) => isActive(pathname, c.href)) ?? false;
}

/* ─── Icon Button (top-level nav item) ─── */

function IconNavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl w-full",
        "transition-colors duration-150",
        active
          ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
          : "text-muted-foreground/70 hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon size={20} strokeWidth={active ? 2 : 1.5} />
      <span className="text-[10px] leading-tight font-medium">{label}</span>
    </Link>
  );
}

/* ─── Icon Button with Popover (for items with children) ─── */

function IconNavGroup({
  item,
  pathname,
  canSeeItem,
}: {
  item: NavItem;
  pathname: string;
  canSeeItem: (href: string) => boolean;
}) {
  const children = item.children?.filter((c) => canSeeItem(c.href)) ?? [];
  const groupActive = isChildActive(pathname, children);

  if (children.length === 0) return null;

  const Icon = item.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl w-full",
            "transition-colors duration-150 border-0 bg-transparent cursor-pointer",
            groupActive
              ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
              : "text-muted-foreground/70 hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon size={20} strokeWidth={groupActive ? 2 : 1.5} />
          <span className="text-[10px] leading-tight font-medium">
            {item.label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={4}
        className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
      >
        <div className="space-y-0.5">
          {children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                  "transition-colors duration-150",
                  childActive
                    ? "bg-primary/10 text-primary font-medium dark:bg-white/10 dark:text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <ChildIcon size={15} className="shrink-0" />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Main Sidebar ─── */

export function AppSidebar({ permissions = [] }: { permissions?: string[] }) {
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
    <Sidebar
      collapsible="none"
      className="!w-[68px] border-r border-border/50 glass-sidebar"
    >
      {/* Brand icon */}
      <SidebarHeader className="flex items-center justify-center py-4">
        <Link
          href="/home"
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20"
        >
          <SparklesIcon size={18} className="text-white" />
        </Link>
      </SidebarHeader>

      {/* Main nav — icon + label vertical stack */}
      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
        <nav className="flex flex-col gap-0.5">
          {visibleNav.map((item) =>
            item.children ? (
              <IconNavGroup
                key={item.href}
                item={item}
                pathname={pathname}
                canSeeItem={canSeeItem}
              />
            ) : (
              <IconNavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive(pathname, item.href)}
              />
            )
          )}

          {/* More */}
          {visibleMore.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl w-full",
                    "transition-colors duration-150 border-0 bg-transparent cursor-pointer",
                    "text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                  )}
                >
                  <MoreHorizontal size={20} strokeWidth={1.5} />
                  <span className="text-[10px] leading-tight font-medium">
                    更多
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={4}
                className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
              >
                <div className="space-y-0.5">
                  {visibleMore.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                          "transition-colors duration-150",
                          active
                            ? "bg-primary/10 text-primary font-medium dark:bg-white/10 dark:text-white"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon size={15} className="shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </nav>
      </SidebarContent>

      {/* Bottom — Admin + Settings */}
      <SidebarFooter className="px-2 pb-3 pt-1 flex flex-col gap-0.5">
        <div className="h-px bg-border/30 mb-1" />

        {/* Admin items */}
        {canAccessAdmin && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl w-full",
                  "transition-colors duration-150 border-0 bg-transparent cursor-pointer",
                  "text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                )}
              >
                <Settings size={20} strokeWidth={1.5} />
                <span className="text-[10px] leading-tight font-medium">
                  设置
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="end"
              sideOffset={4}
              className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
            >
              <div className="space-y-0.5">
                {ADMIN_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                        "transition-colors duration-150",
                        active
                          ? "bg-primary/10 text-primary font-medium dark:bg-white/10 dark:text-white"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
