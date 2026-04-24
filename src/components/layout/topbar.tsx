"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
// SidebarTrigger removed — sidebar has its own expand/collapse toggle
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
  "/missions": "任务中心",
  "/channel-advisor": "频道顾问",
  "/inspiration": "热点发现",
  "/topic-compare": "同题对比",
  "/missing-topics": "漏题筛查",
  "/topic-compare/accounts": "我方账号",
  "/benchmark-accounts": "对标账号库",
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
  // 系统管理
  "/admin/organizations": "组织管理",
  "/admin/users": "用户管理",
  "/admin/roles": "角色权限",
};

const pageGroups: Record<string, string> = {
  "/missions": "工作空间",
  "/channel-advisor": "工作空间",
  "/employee-marketplace": "工作空间",
  "/inspiration": "创作者中心",
  "/topic-compare": "创作者中心",
  "/missing-topics": "创作者中心",
  "/benchmark-accounts": "创作者中心",
  "/super-creation": "创作者中心",
  "/premium-content": "创作者中心",
  "/video-batch": "创作者中心",
  "/event-auto": "创作者中心",
  "/asset-intelligence": "智能媒资",
  "/channel-knowledge": "智能媒资",
  "/asset-revive": "智能媒资",
  "/publishing": "运营分析",
  "/analytics": "运营分析",
  "/admin/organizations": "系统管理",
  "/admin/users": "系统管理",
  "/admin/roles": "系统管理",
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
      className="h-14 border-b border-[var(--glass-border)] flex items-center px-4 gap-4 sticky top-0 z-30"
      style={{
        background: 'var(--glass-panel-bg)',
        backdropFilter: 'blur(20px) saturate(130%)',
        WebkitBackdropFilter: 'blur(20px) saturate(130%)',
      }}
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="/missions"
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
            className="h-8 w-48 rounded-lg bg-[var(--glass-input-bg)] border border-[var(--glass-input-border)] backdrop-blur-sm pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
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
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.85), rgba(96,165,250,0.85))" }}>
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
