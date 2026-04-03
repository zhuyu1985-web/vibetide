import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getUnreadCount } from "@/lib/dal/notifications";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { PermissionProvider } from "@/components/providers/permission-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayName = "演示用户";
  let unreadCount = 0;
  let permissions: string[] = [];
  let superAdmin = false;

  try {
    const profile = await Promise.race([
      getCurrentUserProfile(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    if (profile) {
      displayName = profile.displayName;
      permissions = profile.permissions;
      superAdmin = profile.isSuperAdmin;

      try {
        unreadCount = await getUnreadCount(
          profile.organizationId,
          profile.userId
        );
      } catch {
        // Gracefully degrade if DB is unavailable
      }
    }
  } catch {
    // Supabase unavailable — allow demo access
  }

  return (
    <PermissionProvider permissions={permissions} isSuperAdmin={superAdmin}>
      <SidebarProvider>
        <AppSidebar permissions={permissions} />
        <SidebarInset>
          <Topbar userName={displayName} unreadCount={unreadCount} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-page bg-glow">
            <div className="relative z-10 p-6">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </PermissionProvider>
  );
}
