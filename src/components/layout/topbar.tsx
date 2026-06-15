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
import { MountGate } from "@/components/shared/mount-gate";

const pageTitles: Record<string, string> = {
  "/home": "首页",
  "/ai-employees": "AI员工",
  "/workflows": "工作流",
  "/missions": "任务",
  "/inspiration": "热点发现",
  "/topic-compare": "同题对比",
  "/missing-topics": "漏题筛查",
  "/account-analytics": "账号分析",
  "/case-library": "优秀案例",
  "/articles": "稿件库",
  "/media-assets": "素材库",
  "/audit-center": "审核",
  "/settings/channels": "渠道",
  "/data-collection/content": "内容池",
  "/data-collection/topics": "主体监测",
  "/data-collection/sources": "采集配置",
  "/data-collection/reports": "研究报告",
  "/data-collection/monitoring": "监控面板",
  "/analytics": "数据",
  "/skills": "SKILLS",
  "/cowork/connectors": "连接器",
  "/cowork/plugins": "个人插件",
  "/hot-topics": "热点看板",
  // 系统管理
  "/admin/organizations": "组织管理",
  "/admin/users": "用户管理",
  "/admin/roles": "角色权限",
};

const pageGroups: Record<string, string> = {
  "/home": "对话",
  "/ai-employees": "智能体",
  "/workflows": "智能体",
  "/missions": "智能体",
  "/inspiration": "应用",
  "/topic-compare": "应用",
  "/missing-topics": "应用",
  "/account-analytics": "应用",
  "/case-library": "应用",
  "/articles": "内容",
  "/media-assets": "内容",
  "/audit-center": "审核",
  "/settings/channels": "渠道",
  "/data-collection/content": "采集",
  "/data-collection/topics": "采集",
  "/data-collection/sources": "采集",
  "/data-collection/reports": "采集",
  "/data-collection/monitoring": "采集",
  "/analytics": "数据",
  "/skills": "定制",
  "/cowork/connectors": "定制",
  "/cowork/plugins": "定制",
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
        // 顶栏全宽贴在动画粒子画布上,blur 每帧随画布重算;20→14 明显降 GPU,
        // 玻璃观感几乎无损。其余 .glass-* 大半径模糊也已在 globals.css 同步下调。
        background: 'var(--glass-panel-bg)',
        backdropFilter: 'blur(14px) saturate(130%)',
        WebkitBackdropFilter: 'blur(14px) saturate(130%)',
      }}
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="/home"
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

        {(() => {
          const userTrigger = (
            <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.85), rgba(96,165,250,0.85))" }}>
                <User size={12} className="text-white" />
              </div>
              <span className="text-sm text-foreground">{userName}</span>
            </Button>
          );
          return (
            <MountGate fallback={userTrigger}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>{userTrigger}</DropdownMenuTrigger>
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
            </MountGate>
          );
        })()}
      </div>
    </header>
  );
}
