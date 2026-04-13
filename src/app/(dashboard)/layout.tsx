import { getUnreadCount } from "@/lib/dal/notifications";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { PermissionProvider } from "@/components/providers/permission-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Toaster } from "sonner";

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
      <DashboardShell
        userName={displayName}
        unreadCount={unreadCount}
        permissions={permissions}
      >
        {children}
      </DashboardShell>
      <Toaster position="top-center" richColors />
    </PermissionProvider>
  );
}
