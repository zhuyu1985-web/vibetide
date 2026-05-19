import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import {
  listResearchTopics,
  listTopicGroups,
} from "@/lib/dal/research/research-topics";
import { listAdapterMetas } from "@/lib/collection/adapter-meta";
import { listCollectedItemFilterOptions } from "@/lib/dal/collected-items";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { PageHeader } from "@/components/shared/page-header";
import { TopicsClient } from "./topics-client";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) redirect("/home");

  const [topics, groups, baseAdapterMetas, outlets, filterOptions] = await Promise.all([
    listResearchTopics(ctx.organizationId),
    listTopicGroups(ctx.organizationId),
    Promise.resolve(listAdapterMetas()),
    listOutletsByOrg(ctx.organizationId),
    listCollectedItemFilterOptions(ctx.organizationId),
  ]);

  const adapterMetas = [
    ...baseAdapterMetas,
    {
      type: "excel_import",
      displayName: "Excel 导入",
      description: "通过界面或脚本批量导入的 Excel 数据",
      category: "url" as const,
      configFields: [],
    },
    {
      type: "json_import",
      displayName: "JSON 导入",
      description: "通过脚本批量导入的 JSON 数据",
      category: "url" as const,
      configFields: [],
    },
  ];

  return (
    <>
      <PageHeader
        title="主题监测"
        description="配置监测主题、关键词和地域条件，查看命中内容并生成研究分析。"
      />
      <TopicsClient
        topics={topics}
        groups={groups}
        adapterMetas={adapterMetas}
        outlets={outlets}
        filterOptions={filterOptions}
      />
    </>
  );
}
