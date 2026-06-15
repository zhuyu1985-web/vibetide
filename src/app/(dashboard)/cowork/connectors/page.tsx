import Link from "next/link";
import { Database, Send, Radio, Search } from "lucide-react";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { getOrgCollectionSummary } from "@/lib/dal/collection";
import { listCmsCatalogsForBindingDropdown } from "@/lib/dal/cms-catalogs";
import { listChannelConfigs } from "@/lib/dal/channels";
import {
  getActiveSearchProvider,
  isSearchProviderConfigured,
} from "@/lib/search/config";
import { cn } from "@/lib/utils";
import { ReturnToPreviousButton } from "@/components/shared/return-to-previous-button";

export const dynamic = "force-dynamic";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function CoworkConnectorsPage() {
  const ctx = await getCurrentUserAndOrg();
  const orgId = ctx?.organizationId;

  const [collection, cmsCatalogs, channels] = orgId
    ? await Promise.all([
        safe(getOrgCollectionSummary(orgId), {
          totalSources: 0,
          enabledSources: 0,
          totalItemsLast24h: 0,
          failedRunsLast24h: 0,
        }),
        safe(listCmsCatalogsForBindingDropdown(orgId), []),
        safe(listChannelConfigs(orgId), []),
      ])
    : [
        { totalSources: 0, enabledSources: 0, totalItemsLast24h: 0, failedRunsLast24h: 0 },
        [],
        [],
      ];

  const enabledChannels = channels.filter((c) => c.isEnabled).length;
  const searchProvider = getActiveSearchProvider();
  const searchConfigured = isSearchProviderConfigured();

  const connectors = [
    {
      icon: <Database className="size-4" />,
      title: "内容采集",
      ok: collection.enabledSources > 0,
      status:
        collection.enabledSources > 0
          ? `${collection.enabledSources} 个采集源已启用`
          : "未配置采集源",
      detail: `共 ${collection.totalSources} 个源 · 近 24h 采集 ${collection.totalItemsLast24h} 条`,
      href: "/data-collection/sources",
      cta: "管理采集源",
    },
    {
      icon: <Send className="size-4" />,
      title: "CMS 发布(华栖云)",
      ok: cmsCatalogs.length > 0,
      status:
        cmsCatalogs.length > 0 ? `已同步 ${cmsCatalogs.length} 个栏目` : "未同步栏目",
      detail: "把成稿一键入库到华栖云 CMS 栏目",
      href: "/settings/cms-mapping",
      cta: "配置 CMS 映射",
    },
    {
      icon: <Radio className="size-4" />,
      title: "渠道分发",
      ok: enabledChannels > 0,
      status: enabledChannels > 0 ? `${enabledChannels} 个渠道已启用` : "未配置渠道",
      detail: "钉钉 / 企业微信等消息分发渠道",
      href: "/settings/channels",
      cta: "管理渠道",
    },
    {
      icon: <Search className="size-4" />,
      title: "搜索服务",
      ok: searchConfigured,
      status: searchConfigured
        ? `已接入 ${searchProvider}`
        : `${searchProvider} 未配置 API Key`,
      detail: "AI 团队联网检索的 provider(bocha / tavily)",
      href: null as string | null,
      cta: null as string | null,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-medium">连接器</h1>
        <ReturnToPreviousButton />
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        接入内容源、发布渠道与外部服务,供 AI 团队在任务执行中调用。
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {connectors.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                {c.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <span
                    className={cn(
                      "size-1.5 flex-none rounded-full",
                      c.ok ? "bg-emerald-500" : "bg-muted-foreground/40",
                    )}
                  />
                  <span
                    className={
                      c.ok
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    {c.status}
                  </span>
                </div>
              </div>
            </div>
            {c.detail && (
              <p className="mt-2.5 text-xs text-muted-foreground">{c.detail}</p>
            )}
            {c.href && c.cta && (
              <Link
                href={c.href}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {c.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
