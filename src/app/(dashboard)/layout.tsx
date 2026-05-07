import { getUnreadCount } from "@/lib/dal/notifications";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { PermissionProvider } from "@/components/providers/permission-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Toaster } from "sonner";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 默认值 = 加载中 / 未识别状态。如果 getCurrentUserProfile 完全失败（DB
  // 宕机或网络断开），保底显示「未登录」让用户知道异常；不再用「演示用户」
  // 因为它在慢网下被频繁误触发，让用户误以为登录身份不对。
  let displayName = "未登录";
  let unreadCount = 0;
  let permissions: string[] = [];
  let superAdmin = false;

  try {
    // 30s timeout — Supabase ap-northeast-2 跨区冷启动 + 多 join 查询
    // (user_profiles + user_roles + roles) 在国内访问下 5-10s 常见。
    // 之前 3s 太短导致 fallback 频繁触发显示「演示用户」+ 空 permissions，
    // 用户体验:登录后 UI 行为像访客模式。
    const profile = await Promise.race([
      getCurrentUserProfile(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000)),
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
        // 通知数失败不影响页面 — 默认 0
      }
    }
  } catch {
    // getCurrentUserProfile 已经 try/catch 内部容错返 null，
    // 这里 catch 是防御性 — 走到这里说明 Promise.race 自身抛错（极少见）
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
