"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { triggerCatalogSyncAction } from "@/app/actions/cms";

// ---------------------------------------------------------------------------
// View-model contracts
// ---------------------------------------------------------------------------

interface CmsCatalogVm {
  id: string;
  cmsCatalogId: number;
  name: string;
  innerCode: string | null;
  treeLevel: number | null;
  appId: number;
  siteId: number;
}

interface SyncLogVm {
  id: string;
  state: string;
  triggerSource: string;
  stats: Record<string, number> | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

interface Props {
  cmsCatalogs: CmsCatalogVm[];
  recentLogs: SyncLogVm[];
  defaultTarget: { siteId: number; appId: number; catalogId: number };
}

type TabKey = "catalogs" | "logs";

export function CmsMappingClient({ cmsCatalogs, recentLogs, defaultTarget }: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabKey>("catalogs");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const handleSync = () => {
    startTransition(async () => {
      setSyncMsg("同步中...");
      const res = await triggerCatalogSyncAction({ deleteMissing: true });
      if (res.success) {
        const s = res.stats;
        setSyncMsg(
          `同步成功：渠道 ${s.channelsFetched} / 应用 ${s.appsFetched} / 栏目 ${s.catalogsFetched}（新增 ${s.catalogsInserted}，更新 ${s.catalogsUpdated}，软删 ${s.catalogsSoftDeleted}）`,
        );
      } else {
        setSyncMsg(`同步失败：${res.error?.message ?? "未知错误"}`);
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="CMS 栏目映射"
        description="查看本地同步的华栖云 CMS 栏目树与同步日志。"
        actions={
          <div className="flex items-center gap-3">
            {syncMsg && (
              <span className="text-xs text-muted-foreground">{syncMsg}</span>
            )}
            <Button variant="ghost" onClick={handleSync} disabled={isPending}>
              {isPending ? "同步中..." : "立即同步"}
            </Button>
          </div>
        }
      />

      <GlassCard variant="secondary" padding="sm" className="mb-4">
        <div className="text-xs text-muted-foreground">
          当前默认推送目标：
          <span className="font-mono text-foreground">
            {" "}siteId={defaultTarget.siteId} · appId={defaultTarget.appId} · catalogId={defaultTarget.catalogId}
          </span>
          （来自 env <span className="font-mono">CMS_DEFAULT_*</span>，缺失时回退代码默认）。
          workflow_template 在 cms_publish 步骤参数里覆盖 catalogId/appId/siteId 即可推到指定栏目。
        </div>
      </GlassCard>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        className="mb-4"
      >
        <TabsList variant="line">
          <TabsTrigger value="catalogs">CMS 栏目树</TabsTrigger>
          <TabsTrigger value="logs">同步日志</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "catalogs" && <CatalogsTab cmsCatalogs={cmsCatalogs} />}
      {activeTab === "logs" && <LogsTab recentLogs={recentLogs} />}
    </div>
  );
}

function CatalogsTab({ cmsCatalogs }: { cmsCatalogs: CmsCatalogVm[] }) {
  if (cmsCatalogs.length === 0) {
    return (
      <GlassCard variant="secondary" padding="md">
        <p className="text-sm text-muted-foreground">
          本地未同步到任何 CMS 栏目。请先点"立即同步"。
        </p>
      </GlassCard>
    );
  }
  return (
    <GlassCard variant="secondary" padding="sm">
      <div className="space-y-1 font-mono text-xs">
        {cmsCatalogs.map((c) => (
          <div
            key={c.id}
            className="flex gap-4 rounded px-3 py-1 hover:bg-muted/30"
          >
            <span className="w-20 text-muted-foreground">{c.cmsCatalogId}</span>
            <span>
              {"  ".repeat(Math.max(0, (c.treeLevel ?? 1) - 1))}
              {c.name}
            </span>
            <span className="ml-auto text-muted-foreground">
              app={c.appId} site={c.siteId} code={c.innerCode ?? "-"}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function LogsTab({ recentLogs }: { recentLogs: SyncLogVm[] }) {
  if (recentLogs.length === 0) {
    return (
      <GlassCard variant="secondary" padding="md">
        <p className="text-sm text-muted-foreground">暂无同步记录。</p>
      </GlassCard>
    );
  }
  return (
    <div className="space-y-2">
      {recentLogs.map((log) => (
        <GlassCard key={log.id} variant="secondary" padding="sm">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                log.state === "done"
                  ? "bg-emerald-500"
                  : log.state === "running"
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
            />
            <span className="font-medium">{log.state}</span>
            <span className="text-muted-foreground">
              · {log.triggerSource || "-"} ·{" "}
              {new Date(log.startedAt).toLocaleString()}
            </span>
            {log.durationMs != null && (
              <span className="ml-auto text-xs text-muted-foreground">
                {(log.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {log.stats && (
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {Object.entries(log.stats)
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")}
            </div>
          )}
          {log.errorMessage && (
            <div className="mt-1 text-xs text-rose-500">{log.errorMessage}</div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
