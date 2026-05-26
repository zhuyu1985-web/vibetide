// src/app/(dashboard)/data-collection/reports/resources/page.tsx
//
// 研究报告资源管理页 - server component
// 双 tab: 媒体名单 / 活动数据集
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §7.2

import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listMediaScopesByOrg } from "@/lib/dal/research/media-scopes";
import { listActivityDatasetsByOrg } from "@/lib/dal/research/activity-datasets";
import { ResourcesClient } from "./resources-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ReportsResourcesPage({ searchParams }: PageProps) {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) redirect("/home");

  const { tab } = await searchParams;
  const initialTab = tab === "datasets" ? "datasets" : "scopes";

  const [scopes, datasets] = await Promise.all([
    listMediaScopesByOrg(ctx.organizationId),
    listActivityDatasetsByOrg(ctx.organizationId),
  ]);

  // Date 对象不能直接跨 server/client 边界 (Date 会被序列化成 string 但
  // TS 类型会失配),序列化成 ISO string 再让 client 自己解析
  const scopeRows = scopes.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
  const datasetRows = datasets.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }));

  return (
    <ResourcesClient
      initialTab={initialTab}
      scopes={scopeRows}
      datasets={datasetRows}
    />
  );
}
