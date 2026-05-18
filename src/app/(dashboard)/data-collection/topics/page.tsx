import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export default async function TopicsPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) redirect("/home");
  return (
    <div className="px-2 py-4">
      <h2 className="text-lg font-semibold">主题监测</h2>
      <p className="mt-2 text-sm text-muted-foreground">Phase 3 实现。</p>
    </div>
  );
}
