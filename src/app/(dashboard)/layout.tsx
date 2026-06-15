import { getUnreadCount } from "@/lib/dal/notifications";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { PermissionProvider } from "@/components/providers/permission-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AnimationPauseGuard } from "@/components/shared/animation-pause-guard";
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
    // 8s timeout — 数据库迁到 Sealos 北京后通常 < 1s,
    // 8s 兜底足够吸收偶发慢查询(包括 postgres.js + 远端通信延迟),又不长时间等待。
    const profile = await Promise.race([
      getCurrentUserProfile(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
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
      <AnimationPauseGuard />
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
