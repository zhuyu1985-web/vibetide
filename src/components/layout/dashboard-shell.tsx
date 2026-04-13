"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";

interface DashboardShellProps {
  userName: string;
  unreadCount: number;
  permissions: string[];
  children: React.ReactNode;
}

export function DashboardShell({
  userName,
  unreadCount,
  permissions,
  children,
}: DashboardShellProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="flex h-svh overflow-hidden">
      <AppSidebar
        permissions={permissions}
        unreadCount={unreadCount}
        expanded={sidebarExpanded}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          userName={userName}
          unreadCount={unreadCount}
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-page bg-glow">
          <div className="relative z-10 p-6 h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
