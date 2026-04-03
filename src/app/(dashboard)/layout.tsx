import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/dal/notifications";
import { db } from "@/db";
import { userProfiles } from "@/db/schema/users";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let displayName = "演示用户";
  let unreadCount = 0;
  let authenticated = false;

  try {
    // Race auth check against a 3-second timeout to avoid hanging
    const authResult = await Promise.race([
      (async () => {
        const supabase = await createClient();
        return supabase.auth.getUser();
      })(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    const user = authResult && "data" in authResult ? authResult.data.user : null;

    if (user) {
      authenticated = true;
      displayName = user.user_metadata?.display_name || user.email || "用户";

      try {
        const profile = await db.query.userProfiles.findFirst({
          where: eq(userProfiles.id, user.id),
        });
        if (profile?.organizationId) {
          unreadCount = await getUnreadCount(profile.organizationId, user.id);
        }
      } catch {
        // Gracefully degrade if DB is unavailable
      }
    }
  } catch {
    // Supabase unavailable — allow demo access
  }

  // Demo mode: allow access without auth
  void authenticated;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Topbar userName={displayName} unreadCount={unreadCount} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-page bg-glow">
          <div className="relative z-10 p-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
