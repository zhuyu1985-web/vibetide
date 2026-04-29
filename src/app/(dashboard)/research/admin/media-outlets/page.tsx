import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac-constants";
import { listMediaOutlets } from "@/lib/dal/research/media-outlets";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { MediaOutletsClient } from "./media-outlets-client";

export default async function MediaOutletsAdminPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");

  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.RESEARCH_MEDIA_OUTLET_MANAGE,
  );
  if (!allowed) redirect("/research");

  const [outlets, districts] = await Promise.all([
    listMediaOutlets({ organizationId: ctx.organizationId }),
    listCqDistricts(),
  ]);

  return <MediaOutletsClient outlets={outlets} districts={districts} />;
}
