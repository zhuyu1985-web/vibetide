"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import {
  CHANNEL_TYPE_LABELS,
  type Channel,
  type ChannelType,
} from "@/lib/media-outlet/channels";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { OutletEditDialog } from "./outlet-edit-dialog";
import { OutletDeleteConfirmDialog } from "./outlet-delete-confirm-dialog";
import { reseedDictionary, batchRecognizeOutlets } from "@/app/actions/media-outlet-dictionary";

const PLATFORM_ORDER: ChannelType[] = [
  "website",
  "wechat_oa",
  "douyin",
  "weibo",
  "kuaishou",
];

const PLATFORM_CHIP: Record<ChannelType, string> = {
  website: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  wechat_oa: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  douyin: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400",
  weibo: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  kuaishou: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

interface Props {
  initialOutlets: MediaOutletRow[];
  isAdmin: boolean;
}

export function OutletsClient({ initialOutlets, isAdmin }: Props) {
  const [outlets] = useState(initialOutlets);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<OutletTier | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<ChannelType | "all">("all");
  const [editing, setEditing] = useState<MediaOutletRow | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [deletingOutlet, setDeletingOutlet] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = outlets.filter((o) => {
    if (tierFilter !== "all" && o.outletTier !== tierFilter) return false;
    if (platformFilter !== "all") {
      const has = (o.channels as Channel[] | null)?.some((c) => c.type === platformFilter);
      if (!has) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hit =
        o.outletName.toLowerCase().includes(q) ||
        (o.groupName ?? "").toLowerCase().includes(q) ||
        (o.publicAccountNames ?? []).some((n) => n.toLowerCase().includes(q)) ||
        (o.domains ?? []).some((d) => d.toLowerCase().includes(q)) ||
        ((o.channels ?? []) as Channel[]).some((c) =>
          JSON.stringify(c).toLowerCase().includes(q),
        );
      if (!hit) return false;
    }
    return true;
  });

  const emptyHint = "字典为空，点击右上角「重新初始化字典」灌入默认 113 条";

  return (
    <>
      <PageHeader title="媒体字典" description="维护采集源的媒体身份字典，用于自动识别采集项的媒体分级" />

      <div className="mt-4 flex items-center gap-2">
        <SearchInput
          className="w-64"
          placeholder="搜索媒体名 / 集团 / 账号"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as OutletTier | "all")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分级</SelectItem>
            {OUTLET_TIER_VALUES.map((t) => (
              <SelectItem key={t} value={t}>{OUTLET_TIER_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={platformFilter}
          onValueChange={(v) => setPlatformFilter(v as ChannelType | "all")}
        >
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            {PLATFORM_ORDER.map((p) => (
              <SelectItem key={p} value={p}>{CHANNEL_TYPE_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <>
              <Button variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
                try {
                  const r = await reseedDictionary();
                  toast.success(`字典初始化完成：新增 ${r.inserted} 条 / 跳过 ${r.skipped} 条`);
                  router.refresh();
                } catch (e) {
                  toast.error(`失败：${(e as Error).message}`);
                }
              })}>重新初始化字典</Button>
              <Button variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
                try {
                  await batchRecognizeOutlets();
                  toast.success("批量回填已触发，去 Inngest 监控查看进度");
                } catch (e) {
                  toast.error(`失败：${(e as Error).message}`);
                }
              })}>批量回填历史采集项</Button>
            </>
          )}
          <Button onClick={() => setCreatingNew(true)}>+ 新增媒体</Button>
        </div>
      </div>

      <DataTable
        rows={filtered}
        rowKey={(r) => r.id}
        className="mt-4"
        columns={[
          { key: "outletName", header: "媒体名", render: (r) => (
            <div className="min-w-0">
              <div className="text-sm text-foreground truncate">{r.outletName}</div>
              {r.groupName && (
                <div className="text-[11px] text-muted-foreground truncate">{r.groupName}</div>
              )}
            </div>
          ) },
          { key: "outletTier", header: "分级", width: "w-28", render: (r) => OUTLET_TIER_LABELS[r.outletTier as OutletTier] ?? r.outletTier },
          { key: "outletRegion", header: "区域", width: "w-20", render: (r) => r.outletRegion ?? "-" },
          { key: "outletDistrict", header: "区县", width: "w-20", render: (r) => r.outletDistrict ?? "-" },
          { key: "industryTag", header: "行业", width: "w-20", render: (r) => r.industryTag ?? "-" },
          {
            key: "channels",
            header: "平台账号",
            render: (r) => {
              const channels = (r.channels ?? []) as Channel[];
              if (channels.length === 0) {
                return <span className="text-xs text-muted-foreground">—</span>;
              }
              // 按平台分组,徽章显示"平台 ×N"
              const byType = new Map<ChannelType, number>();
              for (const c of channels) {
                byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
              }
              return (
                <div className="flex flex-wrap gap-1">
                  {PLATFORM_ORDER.filter((t) => byType.has(t)).map((t) => (
                    <Badge
                      key={t}
                      className={`${PLATFORM_CHIP[t]} text-[10px] px-1.5 py-0.5 font-normal`}
                      variant="secondary"
                    >
                      {CHANNEL_TYPE_LABELS[t]}
                      {(byType.get(t) ?? 0) > 1 && ` ×${byType.get(t)}`}
                    </Badge>
                  ))}
                </div>
              );
            },
          },
          { key: "isActive", header: "状态", width: "w-16", render: (r) => r.isActive ? "启用" : "停用" },
          {
            key: "actions", header: "操作", width: "w-32",
            render: (r) => (
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => setEditing(r)}>编辑</Button>
                <Button variant="ghost" onClick={() => setDeletingOutlet({ id: r.id, name: r.outletName })}>停用</Button>
              </div>
            ),
          },
        ]}
        emptyMessage={emptyHint}
      />

      {(editing || creatingNew) && (
        <OutletEditDialog
          outlet={editing}
          onClose={() => { setEditing(null); setCreatingNew(false); }}
          onSaved={() => {
            setEditing(null);
            setCreatingNew(false);
            toast.success("保存成功");
            router.refresh();
          }}
        />
      )}

      {deletingOutlet && (
        <OutletDeleteConfirmDialog
          outletId={deletingOutlet.id}
          outletName={deletingOutlet.name}
          onClose={() => setDeletingOutlet(null)}
          onDeleted={() => {
            setDeletingOutlet(null);
            toast.success("已停用");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
