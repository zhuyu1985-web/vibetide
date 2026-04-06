"use client";

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { MENU_PERMISSION_MAP } from "@/lib/rbac-constants";

/* ─── Types ─── */

interface SubItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: SubItem[];
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

/* ─── Shared icon button styles ─── */

const iconBtnBase = cn(
  "relative flex items-center justify-center w-10 h-10 rounded-xl",
  "transition-all duration-200 ease-out",
  "hover:-translate-y-0.5 hover:shadow-md",
  "active:translate-y-0 active:shadow-none",
  "border-0 bg-transparent cursor-pointer"
);

const iconBtnActive = "bg-primary/12 text-primary shadow-sm dark:bg-white/12 dark:text-white";
const iconBtnIdle = "text-muted-foreground/60 hover:bg-accent hover:text-foreground";

/* ─── Popover sub-menu list ─── */

function SubMenuList({
  items,
  pathname,
}: {
  items: SubItem[];
  pathname: string;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((child) => {
        const ChildIcon = child.icon;
        const active = isHrefActive(pathname, child.href);
        return (
          <Link
            key={child.href}
            href={child.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
              "transition-colors duration-150",
              active
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
  );
}

/* ─── Simple icon link ─── */

function IconLink({
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(iconBtnBase, active ? iconBtnActive : iconBtnIdle)}
        >
          <Icon size={20} strokeWidth={active ? 2 : 1.5} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Icon with popover children ─── */

function IconPopover({
  item,
  pathname,
  canSeeItem,
}: {
  item: NavItem;
  pathname: string;
  canSeeItem: (href: string) => boolean;
}) {
  const children = item.children?.filter((c) => canSeeItem(c.href)) ?? [];
  if (children.length === 0) return null;

  const Icon = item.icon;
  const active = hasActiveChild(pathname, children);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className={cn(iconBtnBase, active ? iconBtnActive : iconBtnIdle)}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          {item.label}
        </p>
        <SubMenuList items={children} pathname={pathname} />
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
    <TooltipProvider delayDuration={150}>
      <Sidebar
        collapsible="none"
        className="!w-16 border-r border-border/50 glass-sidebar"
      >
        {/* Brand */}
        <SidebarHeader className="flex items-center justify-center py-4">
          <Link
            href="/home"
            className={cn(
              "w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600",
              "flex items-center justify-center shadow-lg shadow-blue-500/20",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30"
            )}
          >
            <SparklesIcon size={20} className="text-white" />
          </Link>
        </SidebarHeader>

        {/* Main nav */}
        <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="flex flex-col items-center gap-1 px-2 py-1">
            {visibleNav.map((item) =>
              item.children ? (
                <IconPopover
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  canSeeItem={canSeeItem}
                />
              ) : (
                <IconLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={isHrefActive(pathname, item.href)}
                />
              )
            )}

            {/* More */}
            {visibleMore.length > 0 && (
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button className={cn(iconBtnBase, iconBtnIdle)}>
                        <MoreHorizontal size={20} strokeWidth={1.5} />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    更多
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
                >
                  <SubMenuList items={visibleMore} pathname={pathname} />
                </PopoverContent>
              </Popover>
            )}
          </nav>
        </SidebarContent>

        {/* Bottom — Settings */}
        <SidebarFooter className="flex flex-col items-center gap-1 px-2 pb-4 pt-1">
          <div className="w-8 h-px bg-border/30 mb-1" />

          {canAccessAdmin && (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button className={cn(iconBtnBase, iconBtnIdle)}>
                      <Settings size={20} strokeWidth={1.5} />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  设置
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                side="right"
                align="end"
                sideOffset={8}
                className="w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
              >
                <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  系统管理
                </p>
                <SubMenuList items={ADMIN_ITEMS} pathname={pathname} />
              </PopoverContent>
            </Popover>
          )}
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
