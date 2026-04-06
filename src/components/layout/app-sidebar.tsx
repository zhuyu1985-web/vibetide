"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  UserCog,
  GitBranch,
  Target,
  Wand2,
  FolderOpen,
  BarChart3,
  Sparkles,
  ChevronDown,
  Lightbulb,
  Crosshair,
  PenTool,
  Gem,
  Film,
  FileStack,
  Package,
  FileText,
  Layers,
  Brain as BrainIcon,
  BookOpen,
  RotateCcw,
  Radio,
  TrendingUp,
  Award,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { MENU_PERMISSION_MAP } from "@/lib/rbac-constants";
import { MorePanel } from "@/components/layout/more-panel";

/* ─── Types ─── */

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
}

/* ─── Navigation Data ─── */

const PRIMARY_NAV: NavItem[] = [
  { label: "首页", href: "/home", icon: Home },
  { label: "AI 员工", href: "/ai-employees", icon: UserCog },
  { label: "工作流", href: "/workflows", icon: GitBranch },
  { label: "任务中心", href: "/missions", icon: Target },
  {
    label: "创作中心",
    href: "#creation",
    icon: Wand2,
    children: [
      { label: "灵感池", href: "/inspiration", icon: Lightbulb },
      { label: "同题对标", href: "/benchmarking", icon: Crosshair },
      { label: "超级创作", href: "/super-creation", icon: PenTool },
      { label: "精品聚合", href: "/premium-content", icon: Gem },
      { label: "短视频工厂", href: "/video-batch", icon: Film },
      { label: "生产模板", href: "/production-templates", icon: FileStack },
    ],
  },
  {
    label: "内容管理",
    href: "#content",
    icon: FolderOpen,
    children: [
      { label: "媒资管理", href: "/media-assets", icon: Package },
      { label: "稿件管理", href: "/articles", icon: FileText },
      { label: "栏目管理", href: "/categories", icon: Layers },
      { label: "媒资智能理解", href: "/asset-intelligence", icon: BrainIcon },
      { label: "频道知识库", href: "/channel-knowledge", icon: BookOpen },
      { label: "资产盘活中心", href: "/asset-revive", icon: RotateCcw },
    ],
  },
  {
    label: "数据分析",
    href: "#analytics",
    icon: BarChart3,
    children: [
      { label: "全渠道发布", href: "/publishing", icon: Radio },
      { label: "数据分析", href: "/analytics", icon: TrendingUp },
      { label: "效果激励", href: "/leaderboard", icon: Award },
      { label: "精品率提升", href: "/content-excellence", icon: Star },
    ],
  },
];

/* ─── Helpers ─── */

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function isChildActive(pathname: string, children: NavItem[]) {
  return children.some((c) => isActive(pathname, c.href));
}

/* ─── Flat Nav Item (Genspark style: clean, minimal, no glass borders) ─── */

function NavLink({
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
        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium",
        "transition-colors duration-150",
        active
          ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon
        size={18}
        className={cn("shrink-0", active ? "text-primary dark:text-white" : "")}
      />
      <span className="truncate transition-[opacity,width] duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
        {label}
      </span>
    </Link>
  );
}

/* ─── Expandable Group (Genspark style: simple toggle, indent children) ─── */

function NavGroup({
  item,
  pathname,
  canSeeItem,
}: {
  item: NavItem;
  pathname: string;
  canSeeItem: (href: string) => boolean;
}) {
  const children = item.children!.filter((c) => canSeeItem(c.href));
  const groupActive = isChildActive(pathname, children);
  const [open, setOpen] = useState(groupActive);

  if (children.length === 0) return null;

  const Icon = item.icon;

  return (
    <div>
      {/* Group header — clickable toggle, not a link */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium",
          "transition-colors duration-150 cursor-pointer",
          "border-0 bg-transparent outline-none",
          groupActive
            ? "text-primary dark:text-white"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <Icon
          size={18}
          className={cn(
            "shrink-0",
            groupActive ? "text-primary dark:text-white" : ""
          )}
        />
        <span className="flex-1 text-left truncate transition-[opacity,width] duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
          {item.label}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-muted-foreground/50 transition-transform duration-200",
            open && "rotate-180",
            "group-data-[collapsible=icon]:hidden"
          )}
        />
      </button>

      {/* Children — clean indented list, no left border line */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          "group-data-[collapsible=icon]:hidden",
          open ? "max-h-[500px] opacity-100 mt-0.5" : "max-h-0 opacity-0"
        )}
      >
        <div className="ml-[18px] space-y-0.5">
          {children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px]",
                  "transition-colors duration-150",
                  childActive
                    ? "bg-primary/10 text-primary font-medium dark:bg-white/10 dark:text-white"
                    : "text-muted-foreground/80 hover:bg-accent hover:text-foreground"
                )}
              >
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

/* ─── Main Sidebar ─── */

export function AppSidebar({ permissions = [] }: { permissions?: string[] }) {
  const pathname = usePathname();
  const hasAllPerms = permissions.length === 0;
  const canAccessAdmin =
    permissions.includes("system:manage_users") ||
    permissions.includes("system:manage_orgs") ||
    permissions.includes("system:manage_roles");

  function canSeeItem(href: string) {
    if (hasAllPerms) return true;
    const perm = MENU_PERMISSION_MAP[href];
    return !perm || permissions.includes(perm);
  }

  const visibleItems = PRIMARY_NAV.filter((item) => {
    if (item.children) {
      return item.children.some((c) => canSeeItem(c.href));
    }
    return canSeeItem(item.href);
  });

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/50 glass-sidebar"
    >
      {/* Brand */}
      <SidebarHeader className="p-4 pb-3 transition-all duration-200 ease-linear group-data-[collapsible=icon]:p-2">
        <Link
          href="/home"
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <div
            className="shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center transition-all duration-200 ease-linear w-9 h-9 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8"
            style={{
              boxShadow:
                "0 0 12px rgba(59,130,246,0.3), 0 0 24px rgba(96,165,250,0.15)",
            }}
          >
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="overflow-hidden transition-[opacity,width] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            <h1 className="text-base font-bold leading-tight whitespace-nowrap">
              <span className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">
                Vibe
              </span>
              <span className="text-foreground ml-0.5">Media</span>
            </h1>
            <p className="text-[10px] text-muted-foreground/60 leading-tight tracking-wide whitespace-nowrap">
              数智全媒平台
            </p>
          </div>
        </Link>
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:opacity-0" />
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="sidebar-scroll px-3 py-1">
        <nav className="space-y-0.5">
          {visibleItems.map((item) =>
            item.children ? (
              <NavGroup
                key={item.href}
                item={item}
                pathname={pathname}
                canSeeItem={canSeeItem}
              />
            ) : (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive(pathname, item.href)}
              />
            )
          )}
        </nav>

        {/* Separator before More */}
        <div className="my-2 h-px bg-border/30" />

        {/* More panel */}
        <MorePanel
          canSeeItem={canSeeItem}
          canAccessAdmin={hasAllPerms || canAccessAdmin}
        />
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3 pt-1 overflow-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-10 group-data-[collapsible=icon]:opacity-0">
        <div className="h-px bg-border/20 mb-2" />
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-muted-foreground/40 tracking-wide">
            Vibe Media v1.0
          </span>
          <span className="text-[10px] text-muted-foreground/30">
            Powered by AI
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
