"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/actions/auth";
import { ThemeSwitcher } from "@/components/theme-switcher";

const pageTitles: Record<string, string> = {
  "/team-hub": "团队工作台",
  "/team-builder": "团队组建",
  "/channel-advisor": "频道顾问",
  "/inspiration": "灵感池",
  "/benchmarking": "同题对标",
  "/super-creation": "超级创作",
  "/premium-content": "精品聚合",
  "/video-batch": "短视频工厂",
  "/event-auto": "节赛会展",
  "/publishing": "全渠道发布",
  "/analytics": "数据分析",
  "/employee-marketplace": "AI员工市场",
  // 智能媒资
  "/asset-intelligence": "媒资智能理解",
  "/channel-knowledge": "频道知识库",
  "/asset-revive": "资产盘活中心",
  // legacy
  "/hot-topics": "热点看板",
  "/creation": "创作中心",
  "/competitive": "竞品对标",
};

const pageGroups: Record<string, string> = {
  "/team-hub": "工作空间",
  "/team-builder": "工作空间",
  "/channel-advisor": "工作空间",
  "/employee-marketplace": "工作空间",
  "/inspiration": "创作者中心",
  "/benchmarking": "创作者中心",
  "/super-creation": "创作者中心",
  "/premium-content": "创作者中心",
  "/video-batch": "创作者中心",
  "/event-auto": "创作者中心",
  "/asset-intelligence": "智能媒资",
  "/channel-knowledge": "智能媒资",
  "/asset-revive": "智能媒资",
  "/publishing": "运营分析",
  "/analytics": "运营分析",
};

interface TopbarProps {
  userName: string;
  unreadCount?: number;
}

export function Topbar({ userName, unreadCount = 0 }: TopbarProps) {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] || "工作台";
  const groupName = pageGroups[pathname];

  return (
    <header
      className="h-14 border-b border-border/50 flex items-center px-4 gap-4 bg-background/60 backdrop-blur-[24px]"
      style={{
        WebkitBackdropFilter: "blur(24px) saturate(150%)",
        backdropFilter: "blur(24px) saturate(150%)",
      }}
    >
      <SidebarTrigger />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="/team-hub"
              className="text-muted-foreground text-sm"
            >
              Vibe Media
            </BreadcrumbLink>
          </BreadcrumbItem>
          {groupName && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span className="text-sm text-muted-foreground">
                  {groupName}
                </span>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span className="text-sm font-medium text-foreground">
              {pageTitle}
            </span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="搜索..."
            className="h-8 w-48 rounded-lg bg-muted/50 border border-border pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>
        <ThemeSwitcher />
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative">
          <Bell size={16} className="text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold px-1 leading-none shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(10,132,255,0.85), rgba(56,189,248,0.85))" }}>
                <User size={12} className="text-white" />
              </div>
              <span className="text-sm text-foreground">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-red-600 dark:text-red-400 cursor-pointer"
            >
              <LogOut size={14} className="mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
