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
  ChevronRight,
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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

/* ─── Color System (blue theme only) ─── */

const theme = {
  activeBar: "bg-gradient-to-b from-blue-400/80 to-indigo-400/80",
  activeIcon: "text-blue-400/80 dark:text-blue-300/80",
  activeText: "text-foreground font-semibold",
  hoverIcon:
    "group-hover/nav-item:text-blue-400/80 dark:group-hover/nav-item:text-blue-300/80",
};

/* ─── Navigation Data ─── */

const PRIMARY_NAV: NavItem[] = [
  { label: "首页", href: "/home", icon: Home },
  { label: "AI 员工", href: "/ai-employees", icon: UserCog },
  { label: "工作流", href: "/workflows", icon: GitBranch },
  { label: "任务中心", href: "/missions", icon: Target },
  {
    label: "创作中心", href: "#creation", icon: Wand2,
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
    label: "内容管理", href: "#content", icon: FolderOpen,
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
    label: "数据分析", href: "#analytics", icon: BarChart3,
    children: [
      { label: "全渠道发布", href: "/publishing", icon: Radio },
      { label: "数据分析", href: "/analytics", icon: TrendingUp },
      { label: "效果激励", href: "/leaderboard", icon: Award },
      { label: "精品率提升", href: "/content-excellence", icon: Star },
    ],
  },
];

/* ─── Helper ─── */

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupActive(pathname: string, children: NavItem[]) {
  return children.some((child) => isItemActive(pathname, child.href));
}

/* ─── Simple Menu Item ─── */

function NavMenuItem({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
}) {
  return (
    <SidebarMenuItem className="group/nav-item">
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "relative transition-all duration-300 ease-out rounded-lg overflow-hidden",
          "glass-nav-item hover:backdrop-blur-sm",
          isActive && "active",
          isActive && theme.activeText
        )}
      >
        <Link href={href}>
          {isActive && (
            <span
              className={cn(
                "absolute left-0 top-1 bottom-1 w-[3px] rounded-full",
                theme.activeBar
              )}
              style={{
                boxShadow: "0 0 8px rgba(96,165,250,0.4), 0 0 16px rgba(96,165,250,0.15)",
              }}
            />
          )}
          <Icon
            size={18}
            className={cn(
              "transition-colors duration-200 shrink-0",
              isActive
                ? theme.activeIcon
                : cn("text-muted-foreground/50", theme.hoverIcon)
            )}
          />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/* ─── Expandable Group Item ─── */

function NavMenuGroup({
  item,
  pathname,
  canSeeItem,
}: {
  item: NavItem;
  pathname: string;
  canSeeItem: (href: string) => boolean;
}) {
  const children = item.children!.filter((child) => canSeeItem(child.href));
  const groupActive = isGroupActive(pathname, children);
  const [open, setOpen] = useState(groupActive);

  if (children.length === 0) return null;

  const Icon = item.icon;

  return (
    <SidebarMenuItem className="group/nav-item">
      <SidebarMenuButton
        onClick={() => setOpen(!open)}
        isActive={groupActive}
        className={cn(
          "relative transition-all duration-300 ease-out rounded-lg overflow-hidden cursor-pointer",
          "glass-nav-item hover:backdrop-blur-sm",
          groupActive && "active",
          groupActive && theme.activeText
        )}
      >
        {groupActive && (
          <span
            className={cn(
              "absolute left-0 top-1 bottom-1 w-[3px] rounded-full",
              theme.activeBar
            )}
            style={{
              boxShadow: "0 0 8px rgba(96,165,250,0.4), 0 0 16px rgba(96,165,250,0.15)",
            }}
          />
        )}
        <Icon
          size={18}
          className={cn(
            "transition-colors duration-200 shrink-0",
            groupActive
              ? theme.activeIcon
              : cn("text-muted-foreground/50", theme.hoverIcon)
          )}
        />
        <span className="flex-1">{item.label}</span>
        <ChevronRight
          size={14}
          className={cn(
            "transition-transform duration-200 text-muted-foreground/40",
            open && "rotate-90",
            "group-data-[collapsible=icon]:hidden"
          )}
        />
      </SidebarMenuButton>

      {/* Children */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          "group-data-[collapsible=icon]:hidden",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/30 pl-2">
          {children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isItemActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all duration-200",
                  childActive
                    ? "text-blue-600 dark:text-blue-300 bg-blue-500/10 font-medium"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/50"
                )}
              >
                <ChildIcon size={14} className="shrink-0" />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </SidebarMenuItem>
  );
}

/* ─── Main Sidebar ─── */

export function AppSidebar({ permissions = [] }: { permissions?: string[] }) {
  const pathname = usePathname();
  const hasAllPerms = permissions.length === 0; // no permissions = demo mode, show all
  const canAccessAdmin =
    permissions.includes("system:manage_users") ||
    permissions.includes("system:manage_orgs") ||
    permissions.includes("system:manage_roles");

  function canSeeItem(href: string) {
    if (hasAllPerms) return true;
    const perm = MENU_PERMISSION_MAP[href];
    return !perm || permissions.includes(perm);
  }

  // Filter top-level items: if an item has children, check if any child is visible
  const visiblePrimary = PRIMARY_NAV.filter((item) => {
    if (item.children) {
      return item.children.some((child) => canSeeItem(child.href));
    }
    return canSeeItem(item.href);
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 glass-sidebar">
      {/* ── Brand Header ── */}
      <SidebarHeader className="p-4 pb-3 transition-all duration-200 ease-linear group-data-[collapsible=icon]:p-2">
        <Link href="/home" className="flex items-center gap-2.5 overflow-hidden">
          <div
            className="shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center transition-all duration-200 ease-linear w-9 h-9 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8"
            style={{ boxShadow: "0 0 12px rgba(59, 130, 246, 0.3), 0 0 24px rgba(96, 165, 250, 0.15)", animation: "pulse-glow 3s ease-in-out infinite", willChange: "opacity" }}
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
        {/* Header gradient separator */}
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-blue-500/15 to-transparent transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:opacity-0" />
      </SidebarHeader>

      {/* ── Scrollable Content ── */}
      <SidebarContent className="sidebar-scroll">
        {/* Primary navigation */}
        <SidebarGroup className="py-0.5 px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePrimary.map((item) =>
                item.children ? (
                  <NavMenuGroup
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    canSeeItem={canSeeItem}
                  />
                ) : (
                  <NavMenuItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isActive={isItemActive(pathname, item.href)}
                  />
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* More panel — secondary items + admin */}
        <SidebarGroup className="py-0.5 px-2 mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <MorePanel
                  canSeeItem={canSeeItem}
                  canAccessAdmin={hasAllPerms || canAccessAdmin}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="p-3 pt-1 overflow-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-10 group-data-[collapsible=icon]:opacity-0">
        <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent mb-2" />
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
