"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import {
  CHANNEL_TYPE_LABELS,
  getChannelDisplayName,
  getChannelIdentifier,
  type Channel,
  type ChannelType,
} from "@/lib/media-outlet/channels";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { OutletEditDialog } from "./outlet-edit-dialog";
import { OutletDeleteConfirmDialog } from "./outlet-delete-confirm-dialog";
import { OutletHardDeleteDialog } from "./outlet-hard-delete-dialog";
import { reseedDictionary, batchRecognizeOutlets, reactivateOutlet } from "@/app/actions/media-outlet-dictionary";

const PAGE_SIZE = 30;

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

interface ChannelRow {
  key: string;
  outletId: string;
  outletName: string;
  groupName: string | null;
  outletTier: string;
  outletRegion: string | null;
  outletDistrict: string | null;
  isActive: boolean;
  channel: Channel;
}

export function OutletsClient({ initialOutlets, isAdmin }: Props) {
  const [outlets] = useState(initialOutlets);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<OutletTier | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<ChannelType | "all">("all");
  const [viewMode, setViewMode] = useState<"outlets" | "channels">("outlets");
  const [editing, setEditing] = useState<MediaOutletRow | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [deletingOutlet, setDeletingOutlet] = useState<{ id: string; name: string } | null>(null);
  const [hardDeletingOutlet, setHardDeletingOutlet] = useState<{ id: string; name: string } | null>(null);
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

  // 把 filtered outlets 摊平成 channel 行(账号视图用)。
  // 同一个 outlet 的多个 channel 会展开为多行;无 channel 的 outlet 不出现在账号视图里。
  const channelRows = useMemo<ChannelRow[]>(() => {
    const rows: ChannelRow[] = [];
    for (const o of filtered) {
      const channels = (o.channels ?? []) as Channel[];
      for (let i = 0; i < channels.length; i++) {
        const c = channels[i]!;
        // 平台过滤同样作用在账号视图(filtered 已经过滤了 outlet 级,但要进一步过滤 channel 级)
        if (platformFilter !== "all" && c.type !== platformFilter) continue;
        rows.push({
          key: `${o.id}__${i}`,
          outletId: o.id,
          outletName: o.outletName,
          groupName: o.groupName,
          outletTier: o.outletTier,
          outletRegion: o.outletRegion,
          outletDistrict: o.outletDistrict,
          isActive: o.isActive,
          channel: c,
        });
      }
    }
    return rows;
  }, [filtered, platformFilter]);

  const emptyHint =
    viewMode === "outlets"
      ? "字典为空，点击右上角「重新初始化字典」灌入默认 113 条"
      : "当前条件下没有任何账号 — 试试调整筛选,或去编辑 outlet 补全各平台账号";

  // outletId → outlet 反查表(账号视图打开"编辑"用)
  const outletById = useMemo(
    () => new Map(outlets.map((o) => [o.id, o])),
    [outlets],
  );

  // 当前视图的"总条数"(过滤后,未分页)
  const totalCount = viewMode === "outlets" ? filtered.length : channelRows.length;

  // 增量分页:首屏 PAGE_SIZE 条,触底加载下一批,序号继续累计。
  // 过滤 key 变化时通过派生 visibleCount 回到首屏,避免 effect 内同步 setState。
  const resultKey = `${search}\0${tierFilter}\0${platformFilter}\0${viewMode}`;
  const [visibleState, setVisibleState] = useState({ key: resultKey, count: PAGE_SIZE });
  const visibleCount = visibleState.key === resultKey ? visibleState.count : PAGE_SIZE;

  // 总数收缩时夹住 visibleCount,避免显示空白尾巴
  const effectiveVisible = Math.min(visibleCount, totalCount);

  const visibleOutlets = useMemo(
    () => filtered.slice(0, effectiveVisible),
    [filtered, effectiveVisible],
  );
  const visibleChannels = useMemo(
    () => channelRows.slice(0, effectiveVisible),
    [channelRows, effectiveVisible],
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = effectiveVisible < totalCount;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleState((prev) => {
            const current = prev.key === resultKey ? prev.count : PAGE_SIZE;
            return { key: resultKey, count: current + PAGE_SIZE };
          });
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, resultKey]);

  const tableFooter = totalCount === 0 ? null : (
    <div className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground">
      <div>
        已加载 <span className="tabular-nums text-foreground">{effectiveVisible}</span>
        {" / "}
        <span className="tabular-nums">{totalCount}</span>
        {viewMode === "outlets" ? " 条媒体" : " 条账号"}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="h-4 w-full text-center">
          加载中…
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-2">
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

        {/* 视图切换 */}
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            type="button"
            aria-label="按媒体视图"
            onClick={() => setViewMode("outlets")}
            variant={viewMode === "outlets" ? "default" : "ghost"}
            size="sm"
          >
            <LayoutGrid className="h-4 w-4" />
            按媒体
          </Button>
          <Button
            type="button"
            aria-label="按账号视图"
            onClick={() => setViewMode("channels")}
            variant={viewMode === "channels" ? "default" : "ghost"}
            size="sm"
          >
            <List className="h-4 w-4" />
            按账号
          </Button>
        </div>

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

      {viewMode === "outlets" ? (
        <DataTable
          rows={visibleOutlets}
          rowKey={(r) => r.id}
          className="mt-4"
          footer={tableFooter}
          columns={[
            {
              key: "index",
              header: "#",
              width: "w-12",
              align: "right",
              render: (r) => (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filtered.indexOf(r) + 1}
                </span>
              ),
            },
            { key: "outletName", header: "媒体名", width: "w-44", render: (r) => (
              <div className="min-w-0">
                <div className="text-sm text-foreground truncate">{r.outletName}</div>
                {r.groupName && (
                  <div className="text-[11px] text-muted-foreground truncate">{r.groupName}</div>
                )}
              </div>
            ) },
            { key: "outletTier", header: "分级", width: "w-24", render: (r) => OUTLET_TIER_LABELS[r.outletTier as OutletTier] ?? r.outletTier },
            { key: "outletRegion", header: "区域", width: "w-16", render: (r) => r.outletRegion ?? "-" },
            { key: "outletDistrict", header: "区县", width: "w-20", render: (r) => r.outletDistrict ?? "-" },
            {
              key: "channels",
              header: "平台账号 (具体名称)",
              render: (r) => {
                const channels = (r.channels ?? []) as Channel[];
                if (channels.length === 0) {
                  return <span className="text-xs text-muted-foreground">—</span>;
                }
                // 每个 channel 单独一个 chip,显示 type 标 + 账号显示名,鼠标 hover 看 identifier
                return (
                  <div className="flex flex-wrap gap-1">
                    {PLATFORM_ORDER.flatMap((t) =>
                      channels
                        .map((c, idx) => ({ c, idx }))
                        .filter(({ c }) => c.type === t)
                        .map(({ c, idx }) => {
                          const displayName = getChannelDisplayName(c);
                          const identifier = getChannelIdentifier(c);
                          return (
                            <Badge
                              key={`${t}-${idx}`}
                              className={cn(
                                PLATFORM_CHIP[t],
                                "text-[10px] px-1.5 py-0.5 font-normal max-w-[140px]",
                              )}
                              variant="secondary"
                              title={`${CHANNEL_TYPE_LABELS[t]}${identifier ? ` · ${identifier}` : " · (识别符未填)"}`}
                            >
                              <span className="opacity-70 mr-1">{CHANNEL_TYPE_LABELS[t]}</span>
                              <span className="truncate">{displayName}</span>
                            </Badge>
                          );
                        }),
                    )}
                  </div>
                );
              },
            },
            {
              key: "isActive",
              header: "状态",
              width: "w-20",
              render: (r) => (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 font-normal",
                    r.isActive
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                  )}
                >
                  {r.isActive ? "已启用" : "已停用"}
                </Badge>
              ),
            },
            {
              key: "actions", header: "操作", width: "w-44",
              render: (r) => (
                <div className="flex gap-1">
                  <Button variant="ghost" onClick={() => setEditing(r)}>编辑</Button>
                  {r.isActive ? (
                    <Button
                      variant="ghost"
                      onClick={() => setDeletingOutlet({ id: r.id, name: r.outletName })}
                    >
                      停用
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              await reactivateOutlet(r.id);
                              toast.success(`已启用 ${r.outletName}`);
                              router.refresh();
                            } catch (e) {
                              toast.error(`启用失败：${(e as Error).message}`);
                            }
                          })
                        }
                      >
                        启用
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setHardDeletingOutlet({ id: r.id, name: r.outletName })}
                      >
                        删除
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          emptyMessage={emptyHint}
        />
      ) : (
        <DataTable
          rows={visibleChannels}
          rowKey={(r) => r.key}
          className="mt-4"
          footer={tableFooter}
          columns={[
            {
              key: "index",
              header: "#",
              width: "w-12",
              align: "right",
              render: (r) => (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {channelRows.indexOf(r) + 1}
                </span>
              ),
            },
            {
              key: "platform",
              header: "平台",
              width: "w-28",
              render: (r) => (
                <Badge
                  className={cn(PLATFORM_CHIP[r.channel.type], "text-[10px] px-1.5 py-0.5 font-normal")}
                  variant="secondary"
                >
                  {CHANNEL_TYPE_LABELS[r.channel.type]}
                </Badge>
              ),
            },
            {
              key: "displayName",
              header: "账号名 / 域名",
              width: "w-44",
              render: (r) => (
                <span className="text-sm text-foreground truncate block">
                  {getChannelDisplayName(r.channel)}
                </span>
              ),
            },
            {
              key: "identifier",
              header: "识别符",
              render: (r) => {
                const id = getChannelIdentifier(r.channel);
                if (!id) {
                  return (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      ⚠ 未填(无法 tikhub 采集)
                    </span>
                  );
                }
                return (
                  <code className="text-[11px] font-mono text-muted-foreground truncate block max-w-full" title={id}>
                    {id}
                  </code>
                );
              },
            },
            {
              key: "outletName",
              header: "所属媒体",
              width: "w-36",
              render: (r) => (
                <div className="min-w-0">
                  <div className="text-sm text-foreground truncate">{r.outletName}</div>
                  {r.groupName && (
                    <div className="text-[11px] text-muted-foreground truncate">{r.groupName}</div>
                  )}
                </div>
              ),
            },
            {
              key: "tier",
              header: "分级",
              width: "w-24",
              render: (r) => OUTLET_TIER_LABELS[r.outletTier as OutletTier] ?? r.outletTier,
            },
            {
              key: "region",
              header: "区域",
              width: "w-20",
              render: (r) => r.outletRegion ?? "-",
            },
            {
              key: "actions",
              header: "操作",
              width: "w-20",
              render: (r) => (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const o = outletById.get(r.outletId);
                    if (o) setEditing(o);
                  }}
                >
                  编辑
                </Button>
              ),
            },
          ]}
          emptyMessage={emptyHint}
        />
      )}

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

      {hardDeletingOutlet && (
        <OutletHardDeleteDialog
          outletId={hardDeletingOutlet.id}
          outletName={hardDeletingOutlet.name}
          onClose={() => setHardDeletingOutlet(null)}
          onDeleted={() => {
            setHardDeletingOutlet(null);
            toast.success("已彻底删除");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
