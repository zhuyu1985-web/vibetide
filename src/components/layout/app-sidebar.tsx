"use client";

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
  { label: "创作中心", href: "/creation", icon: Wand2 },
  { label: "内容管理", href: "/content", icon: FolderOpen },
  { label: "数据分析", href: "/analytics", icon: BarChart3 },
];

/* ─── Helper ─── */

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/* ─── Menu Item ─── */

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
          {/* Active left bar indicator with glow */}
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

  const visiblePrimary = PRIMARY_NAV.filter((item) => canSeeItem(item.href));

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
        {/* Primary navigation — flat list */}
        <SidebarGroup className="py-0.5 px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePrimary.map((item) => (
                <NavMenuItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={isItemActive(pathname, item.href)}
                />
              ))}
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
