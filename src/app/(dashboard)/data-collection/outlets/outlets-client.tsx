"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PageHeader } from "@/components/shared/page-header";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { OutletEditDialog } from "./outlet-edit-dialog";
import { OutletDeleteConfirmDialog } from "./outlet-delete-confirm-dialog";
import { reseedDictionary, batchRecognizeOutlets } from "@/app/actions/media-outlet-dictionary";

interface Props {
  initialOutlets: MediaOutletRow[];
  isAdmin: boolean;
}

export function OutletsClient({ initialOutlets, isAdmin }: Props) {
  const [outlets] = useState(initialOutlets);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<OutletTier | "all">("all");
  const [editing, setEditing] = useState<MediaOutletRow | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [deletingOutlet, setDeletingOutlet] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = outlets.filter((o) => {
    if (tierFilter !== "all" && o.outletTier !== tierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hit =
        o.outletName.toLowerCase().includes(q) ||
        (o.publicAccountNames ?? []).some((n) => n.toLowerCase().includes(q)) ||
        (o.domains ?? []).some((d) => d.toLowerCase().includes(q));
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
          placeholder="搜索媒体名 / 公众号 / 域名"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as OutletTier | "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分级</SelectItem>
            {OUTLET_TIER_VALUES.map((t) => (
              <SelectItem key={t} value={t}>{OUTLET_TIER_LABELS[t]}</SelectItem>
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
          { key: "outletName", header: "媒体名", render: (r) => r.outletName },
          { key: "outletTier", header: "分级", width: "w-32", render: (r) => OUTLET_TIER_LABELS[r.outletTier as OutletTier] ?? r.outletTier },
          { key: "outletRegion", header: "区域", width: "w-24", render: (r) => r.outletRegion ?? "-" },
          { key: "outletDistrict", header: "区县", width: "w-24", render: (r) => r.outletDistrict ?? "-" },
          { key: "industryTag", header: "行业", width: "w-24", render: (r) => r.industryTag ?? "-" },
          { key: "domains", header: "域名", render: (r) => {
            const arr = r.domains ?? [];
            const head = arr.slice(0, 2).join(", ");
            return arr.length > 2 ? `${head}...` : head || "-";
          }},
          { key: "publicAccountNames", header: "公众号", render: (r) => {
            const arr = r.publicAccountNames ?? [];
            const head = arr.slice(0, 2).join(", ");
            return arr.length > 2 ? `${head}...` : head || "-";
          }},
          { key: "isActive", header: "状态", width: "w-20", render: (r) => r.isActive ? "启用" : "停用" },
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
