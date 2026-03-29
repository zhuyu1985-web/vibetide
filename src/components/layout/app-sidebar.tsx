"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PenTool,
  Brain,
  Radio,
  BarChart3,
  Sparkles,
  Lightbulb,
  Target,
  Wand2,
  Gem,
  Video,
  CalendarCheck,
  ChevronRight,
  Database,
  Layers,
  BookOpen,
  RefreshCw,
  UserCog,
  Film,
  FileText,
  FolderTree,
  Archive,
  Trophy,
  ClipboardCheck,
  LayoutTemplate,
  MessageSquare,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

type ThemeColor = "blue" | "purple" | "emerald" | "amber" | "indigo";

interface NavGroupConfig {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  theme: ThemeColor;
  groupId: string;
}

/* ─── Color System ─── */

const themeStyles: Record<
  ThemeColor,
  {
    dot: string;
    line: string;
    activeBg: string;
    activeBar: string;
    activeIcon: string;
    activeText: string;
    hoverBg: string;
    hoverIcon: string;
    headerActive: string;
    subLine: string;
    separator: string;
  }
> = {
  blue: {
    dot: "bg-gradient-to-br from-blue-400/70 to-indigo-400/70",
    line: "from-blue-500/30 via-indigo-500/15 to-transparent",
    activeBg:
      "bg-gradient-to-r from-blue-500/8 via-indigo-500/4 to-transparent",
    activeBar: "bg-gradient-to-b from-blue-400/80 to-indigo-400/80",
    activeIcon: "text-blue-400/80 dark:text-blue-300/80",
    activeText: "text-foreground font-semibold",
    hoverBg: "hover:bg-blue-500/4 dark:hover:bg-blue-400/4",
    hoverIcon:
      "group-hover/nav-item:text-blue-400/80 dark:group-hover/nav-item:text-blue-300/80",
    headerActive: "text-blue-500/80 dark:text-blue-400/80",
    subLine: "from-blue-500/20 to-transparent",
    separator: "from-transparent via-blue-500/15 to-transparent",
  },
  purple: {
    dot: "bg-gradient-to-br from-purple-400/70 to-violet-400/70",
    line: "from-purple-500/30 via-violet-500/15 to-transparent",
    activeBg:
      "bg-gradient-to-r from-purple-500/8 via-violet-500/4 to-transparent",
    activeBar: "bg-gradient-to-b from-purple-400/80 to-violet-400/80",
    activeIcon: "text-purple-400/80 dark:text-purple-300/80",
    activeText: "text-foreground font-semibold",
    hoverBg: "hover:bg-purple-500/4 dark:hover:bg-purple-400/4",
    hoverIcon:
      "group-hover/nav-item:text-purple-400/80 dark:group-hover/nav-item:text-purple-300/80",
    headerActive: "text-purple-500/80 dark:text-purple-400/80",
    subLine: "from-purple-500/20 to-transparent",
    separator: "from-transparent via-purple-500/15 to-transparent",
  },
  emerald: {
    dot: "bg-gradient-to-br from-emerald-400/70 to-teal-400/70",
    line: "from-emerald-500/30 via-teal-500/15 to-transparent",
    activeBg:
      "bg-gradient-to-r from-emerald-500/8 via-teal-500/4 to-transparent",
    activeBar: "bg-gradient-to-b from-emerald-400/80 to-teal-400/80",
    activeIcon: "text-emerald-400/80 dark:text-emerald-300/80",
    activeText: "text-foreground font-semibold",
    hoverBg: "hover:bg-emerald-500/4 dark:hover:bg-emerald-400/4",
    hoverIcon:
      "group-hover/nav-item:text-emerald-400/80 dark:group-hover/nav-item:text-emerald-300/80",
    headerActive: "text-emerald-500/80 dark:text-emerald-400/80",
    subLine: "from-emerald-500/20 to-transparent",
    separator: "from-transparent via-emerald-500/15 to-transparent",
  },
  amber: {
    dot: "bg-gradient-to-br from-amber-400/70 to-orange-400/70",
    line: "from-amber-500/30 via-orange-500/15 to-transparent",
    activeBg:
      "bg-gradient-to-r from-amber-500/8 via-orange-500/4 to-transparent",
    activeBar: "bg-gradient-to-b from-amber-400/80 to-orange-400/80",
    activeIcon: "text-amber-400/80 dark:text-amber-300/80",
    activeText: "text-foreground font-semibold",
    hoverBg: "hover:bg-amber-500/4 dark:hover:bg-amber-400/4",
    hoverIcon:
      "group-hover/nav-item:text-amber-400/80 dark:group-hover/nav-item:text-amber-300/80",
    headerActive: "text-amber-500/80 dark:text-amber-400/80",
    subLine: "from-amber-500/20 to-transparent",
    separator: "from-transparent via-amber-500/15 to-transparent",
  },
  indigo: {
    dot: "bg-gradient-to-br from-indigo-400/70 to-purple-400/70",
    line: "from-indigo-500/30 via-purple-500/15 to-transparent",
    activeBg:
      "bg-gradient-to-r from-indigo-500/8 via-purple-500/4 to-transparent",
    activeBar: "bg-gradient-to-b from-indigo-400/80 to-purple-400/80",
    activeIcon: "text-indigo-400/80 dark:text-indigo-300/80",
    activeText: "text-foreground font-semibold",
    hoverBg: "hover:bg-indigo-500/4 dark:hover:bg-indigo-400/4",
    hoverIcon:
      "group-hover/nav-item:text-indigo-400/80 dark:group-hover/nav-item:text-indigo-300/80",
    headerActive: "text-indigo-500/80 dark:text-indigo-400/80",
    subLine: "from-indigo-500/20 to-transparent",
    separator: "from-transparent via-indigo-500/15 to-transparent",
  },
};

/* ─── Navigation Data ─── */

const workspaceItems: NavItem[] = [
  { label: "任务中心", href: "/missions", icon: Target },
  { label: "AI数字员工", href: "/employee-marketplace", icon: UserCog },
  { label: "对话中心", href: "/chat", icon: MessageSquare },
  { label: "技能管理", href: "/skills", icon: Sparkles },
  { label: "频道顾问", href: "/channel-advisor", icon: Brain },
];

const navGroups: NavGroupConfig[] = [
  {
    label: "内容管理",
    icon: Archive,
    theme: "purple",
    groupId: "cms",
    items: [
      { label: "媒资管理", href: "/media-assets", icon: Film },
      { label: "稿件管理", href: "/articles", icon: FileText },
      { label: "栏目管理", href: "/categories", icon: FolderTree },
    ],
  },
  {
    label: "智能媒资",
    icon: Database,
    theme: "emerald",
    groupId: "asset-intel",
    items: [
      { label: "媒资智能理解", href: "/asset-intelligence", icon: Layers },
      { label: "频道知识库", href: "/channel-knowledge", icon: BookOpen },
      { label: "资产盘活中心", href: "/asset-revive", icon: RefreshCw },
    ],
  },
  {
    label: "创作者中心",
    icon: PenTool,
    theme: "amber",
    groupId: "creator",
    items: [
      { label: "灵感池", href: "/inspiration", icon: Lightbulb },
      { label: "同题对标", href: "/benchmarking", icon: Target },
      { label: "超级创作", href: "/super-creation", icon: Wand2 },
      { label: "精品聚合", href: "/premium-content", icon: Gem },
      { label: "短视频工厂", href: "/video-batch", icon: Video },
      { label: "节赛会展", href: "/event-auto", icon: CalendarCheck },
      { label: "批量审核", href: "/batch-review", icon: ClipboardCheck },
      { label: "生产模板", href: "/production-templates", icon: LayoutTemplate },
    ],
  },
  {
    label: "全渠道传播",
    icon: Radio,
    theme: "indigo",
    groupId: "operations",
    items: [
      { label: "全渠道发布", href: "/publishing", icon: Radio },
      { label: "数据分析", href: "/analytics", icon: BarChart3 },
      { label: "效果激励", href: "/leaderboard", icon: Trophy },
      { label: "精品率提升", href: "/content-excellence", icon: Gem },
      { label: "优秀案例库", href: "/case-library", icon: Archive },
    ],
  },
];

/* ─── Helper ─── */

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupActive(pathname: string, items: NavItem[]) {
  return items.some((item) => isItemActive(pathname, item.href));
}

/* ─── Group Header Label ─── */

function GroupLabel({
  label,
  theme,
}: {
  label: string;
  theme: ThemeColor;
}) {
  const styles = themeStyles[theme];
  return (
    <div className="flex items-center gap-2 px-2 pt-1 pb-1.5 overflow-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0">
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)} />
      <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
        {label}
      </span>
      <div
        className={cn(
          "flex-1 h-px bg-gradient-to-r",
          styles.line
        )}
      />
    </div>
  );
}

/* ─── Gradient Separator ─── */

function NavSeparator({ theme }: { theme: ThemeColor }) {
  const styles = themeStyles[theme];
  return (
    <div className="px-3 py-0.5 overflow-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-3 group-data-[collapsible=icon]:opacity-0">
      <div className={cn("h-px bg-gradient-to-r", styles.separator)} />
    </div>
  );
}

/* ─── Collapsible Nav Group ─── */

function NavSection({
  group,
  pathname,
}: {
  group: NavGroupConfig;
  pathname: string;
}) {
  const styles = themeStyles[group.theme];
  const groupActive = isGroupActive(pathname, group.items);
  const GroupIcon = group.icon;

  return (
    <SidebarGroup className="py-0.5 px-2">
      <Collapsible defaultOpen className={`group/${group.groupId}`}>
        <SidebarMenuItem className="list-none">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "transition-all duration-200 ease-out font-medium rounded-lg",
                "glass-nav-item",
                groupActive && styles.headerActive
              )}
            >
              <GroupIcon
                size={18}
                className={cn(
                  "transition-colors duration-200",
                  groupActive
                    ? styles.activeIcon
                    : "text-muted-foreground/60"
                )}
              />
              <span className="flex-1">{group.label}</span>
              <ChevronRight
                size={14}
                className={cn(
                  "transition-all duration-200 text-muted-foreground/40",
                  `group-data-[state=open]/${group.groupId}:rotate-90`,
                  "group-data-[collapsible=icon]:opacity-0"
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {/* SidebarMenuSub provides the <ul> wrapper; override border-l with gradient */}
            <SidebarMenuSub
              className={cn(
                "relative border-l-0 ml-[1.1rem] pl-3 py-0.5",
              )}
            >
              {/* Gradient connection line */}
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-gradient-to-b pointer-events-none",
                  styles.subLine
                )}
              />
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(pathname, item.href);
                return (
                  <NavMenuItem
                    key={item.href}
                    href={item.href}
                    icon={Icon}
                    label={item.label}
                    isActive={active}
                    theme={group.theme}
                    isSub
                  />
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarGroup>
  );
}

/* ─── Menu Item (shared for top-level and sub-items) ─── */

function NavMenuItem({
  href,
  icon: Icon,
  label,
  isActive,
  theme,
  isSub = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  theme: ThemeColor;
  isSub?: boolean;
}) {
  const styles = themeStyles[theme];

  if (isSub) {
    return (
      <SidebarMenuSubItem className="group/nav-item">
        <SidebarMenuSubButton
          asChild
          isActive={isActive}
          className={cn(
            "relative transition-all duration-200 ease-out rounded-md",
            "glass-nav-item",
            isActive && "active",
            isActive && [
              styles.activeText,
            ]
          )}
        >
          <Link href={href}>
            <Icon
              size={14}
              className={cn(
                "transition-colors duration-200 shrink-0",
                isActive
                  ? styles.activeIcon
                  : cn("text-muted-foreground/50", styles.hoverIcon)
              )}
            />
            <span>{label}</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuItem className="group/nav-item">
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "relative transition-all duration-200 ease-out rounded-lg overflow-hidden",
          "glass-nav-item",
          isActive && "active",
          isActive && [
            styles.activeText,
          ]
        )}
      >
        <Link href={href}>
          {/* Active left bar indicator */}
          {isActive && (
            <span
              className={cn(
                "absolute left-0 top-1 bottom-1 w-[3px] rounded-full",
                styles.activeBar
              )}
            />
          )}
          <Icon
            size={18}
            className={cn(
              "transition-colors duration-200 shrink-0",
              isActive
                ? styles.activeIcon
                : cn("text-muted-foreground/50", styles.hoverIcon)
            )}
          />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/* ─── Main Sidebar ─── */

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 glass-sidebar">
      {/* ── Brand Header ── */}
      <SidebarHeader className="p-4 pb-3 transition-all duration-200 ease-linear group-data-[collapsible=icon]:p-2">
        <Link href="/missions" className="flex items-center gap-2.5 overflow-hidden">
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
        {/* 工作空间 - 平铺一级菜单 */}
        <SidebarGroup className="py-0.5 px-2">
          <GroupLabel label="工作空间" theme="blue" />
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => (
                <NavMenuItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={isItemActive(pathname, item.href)}
                  theme="blue"
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 可折叠分组 */}
        {navGroups.map((group, idx) => (
          <div key={group.groupId}>
            <NavSeparator theme={group.theme} />
            <NavSection group={group} pathname={pathname} />
          </div>
        ))}
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
