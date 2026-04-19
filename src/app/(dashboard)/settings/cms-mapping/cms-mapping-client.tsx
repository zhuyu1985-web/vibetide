"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import {
  triggerCatalogSyncAction,
  updateAppChannelBindingAction,
} from "@/app/actions/cms";

// ---------------------------------------------------------------------------
// View-model contracts（Server Component 传入的序列化数据）
// ---------------------------------------------------------------------------

interface AppChannelVm {
  id: string;
  slug: string;
  displayName: string;
  reviewTier: "strict" | "relaxed";
  icon: string | null;
  sortOrder: number;
  isEnabled: boolean;
  defaultCatalogId: string | null;
  defaultCatalogName: string | null;
  defaultCoverUrl: string | null;
}

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
  appChannels: AppChannelVm[];
  cmsCatalogs: CmsCatalogVm[];
  recentLogs: SyncLogVm[];
}

type TabKey = "bindings" | "catalogs" | "logs";

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function CmsMappingClient({ appChannels, cmsCatalogs, recentLogs }: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabKey>("bindings");
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
        description="把 APP 的 9 个栏目绑定到华栖云 CMS 的对应栏目，决定 cms_publish 将稿件落到哪里。"
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

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        className="mb-4"
      >
        <TabsList variant="line">
          <TabsTrigger value="bindings">APP 栏目映射</TabsTrigger>
          <TabsTrigger value="catalogs">CMS 栏目树</TabsTrigger>
          <TabsTrigger value="logs">同步日志</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "bindings" && (
        <BindingsTab appChannels={appChannels} cmsCatalogs={cmsCatalogs} />
      )}
      {activeTab === "catalogs" && <CatalogsTab cmsCatalogs={cmsCatalogs} />}
      {activeTab === "logs" && <LogsTab recentLogs={recentLogs} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bindings Tab
// ---------------------------------------------------------------------------

function BindingsTab({
  appChannels,
  cmsCatalogs,
}: {
  appChannels: AppChannelVm[];
  cmsCatalogs: CmsCatalogVm[];
}) {
  const [isPending, startTransition] = useTransition();
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const handleBind = (slug: string, catalogId: string) => {
    startTransition(async () => {
      const res = await updateAppChannelBindingAction({ slug, catalogId });
      setRowMsg((m) => ({
        ...m,
        [slug]: res.success ? "✓ 绑定成功" : `✗ ${res.error ?? "绑定失败"}`,
      }));
    });
  };

  if (appChannels.length === 0) {
    return (
      <GlassCard variant="secondary" padding="md">
        <p className="text-sm text-muted-foreground">
          当前组织还未初始化 9 个 APP 栏目。请先运行种子脚本或联系管理员。
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {appChannels
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ch) => (
          <GlassCard key={ch.slug} variant="secondary" padding="sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {ch.icon && <span className="text-2xl">{ch.icon}</span>}
                <div>
                  <div className="font-medium">{ch.displayName}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {ch.slug} · 审核档位：
                    {ch.reviewTier === "strict" ? "严" : "松"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Select
                  value={ch.defaultCatalogId ?? ""}
                  onValueChange={(v) => {
                    if (v) handleBind(ch.slug, v);
                  }}
                  disabled={isPending || cmsCatalogs.length === 0}
                >
                  <SelectTrigger className="min-w-[260px]">
                    <SelectValue
                      placeholder={
                        cmsCatalogs.length === 0
                          ? "暂无 CMS 栏目，请先同步"
                          : "— 选择 CMS 栏目 —"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cmsCatalogs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {"—".repeat(Math.max(0, (c.treeLevel ?? 1) - 1))}
                        {(c.treeLevel ?? 1) > 1 ? " " : ""}
                        {c.name} (id {c.cmsCatalogId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rowMsg[ch.slug] && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {rowMsg[ch.slug]}
                  </span>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalogs Tab — 本地已同步 CMS 栏目的扁平化只读视图
// ---------------------------------------------------------------------------

function CatalogsTab({ cmsCatalogs }: { cmsCatalogs: CmsCatalogVm[] }) {
  if (cmsCatalogs.length === 0) {
    return (
      <GlassCard variant="secondary" padding="md">
        <p className="text-sm text-muted-foreground">
          本地未同步到任何 CMS 栏目。请先点“立即同步”。
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

// ---------------------------------------------------------------------------
// Logs Tab — 最近 5 条同步日志
// ---------------------------------------------------------------------------

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
