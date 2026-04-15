import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export default async function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) {
    redirect("/login");
  }

  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) {
    redirect("/home");
  }

  return <div className="min-h-screen">{children}</div>;
}
