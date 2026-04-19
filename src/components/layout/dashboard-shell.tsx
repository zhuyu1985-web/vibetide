"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ChatLauncher } from "@/components/shared/chat-launcher";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  userName: string;
  unreadCount: number;
  permissions: string[];
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED = 60;
const SIDEBAR_EXPANDED = 200;

export function DashboardShell({
  userName,
  unreadCount,
  permissions,
  children,
}: DashboardShellProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const buttonLeft = (sidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED) - 12;

  return (
    <div className="relative flex h-svh overflow-hidden">
      <AppSidebar
        permissions={permissions}
        unreadCount={unreadCount}
        expanded={sidebarExpanded}
      />

      {/* Floating collapse/expand toggle — sits on the seam between sidebar and main */}
      <button
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
        aria-label={sidebarExpanded ? "收起菜单" : "展开菜单"}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-30",
          "w-6 h-12 rounded-full flex items-center justify-center",
          "bg-white/85 dark:bg-slate-800/85 backdrop-blur-md",
          "border border-white/80 dark:border-slate-600/50",
          "shadow-[0_4px_16px_-4px_rgba(30,58,138,0.2),0_8px_24px_-8px_rgba(30,58,138,0.15)]",
          "dark:shadow-[0_4px_16px_-4px_rgba(2,6,23,0.5),0_8px_24px_-8px_rgba(2,6,23,0.6)]",
          "hover:scale-110 hover:bg-white dark:hover:bg-slate-700",
          "active:scale-95",
          "cursor-pointer border-0"
        )}
        style={{
          left: buttonLeft,
          transition:
            "left 300ms cubic-bezier(0.22, 0.68, 0.35, 1), transform 200ms ease-out, background-color 200ms ease-out, box-shadow 200ms ease-out",
        }}
      >
        <ChevronLeft
          size={14}
          strokeWidth={2.2}
          className="text-slate-600 dark:text-slate-200"
          style={{
            transform: sidebarExpanded ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 300ms cubic-bezier(0.22, 0.68, 0.35, 1)",
          }}
        />
      </button>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar userName={userName} unreadCount={unreadCount} />
        <main className="flex-1 overflow-hidden bg-page bg-glow">
          <div className="relative z-10 p-6 h-full overflow-y-auto scrollbar-thin">{children}</div>
        </main>
      </div>

      <ChatLauncher />
    </div>
  );
}
