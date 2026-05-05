"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  getCollectionItemDetailAction,
  type ItemDetailPayload,
} from "@/app/actions/collection-items";
import { correctItemOutlet } from "@/app/actions/media-outlet-dictionary";
import { OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

interface ItemDetailDrawerProps {
  itemId: string | null;
  onClose: () => void;
  outlets: MediaOutletRow[];
}

export function ItemDetailDrawer({ itemId, onClose, outlets }: ItemDetailDrawerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ItemDetailPayload | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Correct outlet dialog state
  const [showCorrectDialog, setShowCorrectDialog] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("none");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!itemId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getCollectionItemDetailAction(itemId)
      .then((d) => {
        setDetail(d);
        // Initialize selected outlet from current item
        setSelectedOutletId(d?.outletId ?? "none");
      })
      .catch((err) =>
        toast.error(
          `加载失败: ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
      .finally(() => setLoading(false));
  }, [itemId]);

  const copyUrl = () => {
    if (detail?.canonicalUrl) {
      navigator.clipboard.writeText(detail.canonicalUrl);
      toast.success("链接已复制");
    }
  };

  const handleSaveOutlet = () => {
    if (!detail) return;
    startTransition(async () => {
      try {
        const outletId = selectedOutletId === "none" ? null : selectedOutletId;
        await correctItemOutlet(detail.id, outletId);
        toast.success("已更新");
        setShowCorrectDialog(false);
        // Refresh detail to show updated outlet info
        const updated = await getCollectionItemDetailAction(detail.id);
        setDetail(updated);
        router.refresh();
      } catch (e) {
        toast.error(`失败：${(e as Error).message}`);
      }
    });
  };

  return (
    <>
      <Sheet open={Boolean(itemId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">
              {loading ? "加载中..." : detail?.title ?? "(无标题)"}
            </SheetTitle>
          </SheetHeader>

          {detail && !loading && (
            <div className="mt-4 space-y-5 px-4 pb-6">
              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {detail.publishedAt && (
                  <span>发布于 {new Date(detail.publishedAt).toLocaleString("zh-CN")}</span>
                )}
                <span>·</span>
                <span>首抓于 {new Date(detail.firstSeenAt).toLocaleString("zh-CN")}</span>
                {detail.canonicalUrl && (
                  <>
                    <span>·</span>
                    <a
                      href={detail.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      原文 <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button size="icon" variant="ghost" onClick={copyUrl} title="复制链接">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>

              {/* Category + tags */}
              <div className="flex flex-wrap gap-2">
                {detail.category && <Badge variant="secondary">{detail.category}</Badge>}
                {detail.tags?.map((t) => (
                  <Badge key={t} variant="outline">{t}</Badge>
                ))}
                <Badge
                  variant={detail.enrichmentStatus === "enriched" ? "default" : "outline"}
                  className="ml-auto"
                >
                  {detail.enrichmentStatus === "enriched"
                    ? "已富化"
                    : detail.enrichmentStatus === "failed"
                      ? "富化失败"
                      : "待富化"}
                </Badge>
              </div>

              {/* Summary */}
              {detail.summary && (
                <section>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">摘要</h4>
                  <p className="text-sm leading-relaxed">{detail.summary}</p>
                </section>
              )}

              {/* 识别信息 */}
              <section className="border-t pt-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">识别信息</h4>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">媒体：</span>
                  <span className="text-sm">{detail.outletName ?? "未分类"}</span>
                  {detail.outletTier && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                      {OUTLET_TIER_LABELS[detail.outletTier as OutletTier] ?? detail.outletTier}
                    </span>
                  )}
                  {detail.outletRegion && (
                    <span className="text-xs text-muted-foreground">{detail.outletRegion}</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowCorrectDialog(true)}>
                  修正 outlet
                </Button>
              </section>

              {/* Source channels timeline */}
              <section>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  来源轨迹 ({detail.sourceChannels.length})
                </h4>
                <div className="space-y-1.5">
                  {detail.sourceChannels
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.capturedAt).getTime() -
                        new Date(b.capturedAt).getTime(),
                    )
                    .map((c, i) => (
                      <div
                        key={`${c.runId}-${i}`}
                        className="flex items-center justify-between gap-2 rounded border bg-card/50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground">{c.channel}</span>
                          {c.url && (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline truncate max-w-[200px]"
                            >
                              {c.url}
                            </a>
                          )}
                        </div>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(c.capturedAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    ))}
                </div>
              </section>

              {/* Derived records */}
              {detail.derivedRecords.length > 0 && (
                <section>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    派生到模块
                  </h4>
                  <div className="space-y-1.5">
                    {detail.derivedRecords.map((d) => (
                      <Link
                        key={d.recordId}
                        href={d.linkHref}
                        className="flex items-center justify-between gap-2 rounded border bg-card px-3 py-2 text-sm hover:bg-accent"
                      >
                        <div>
                          <Badge variant="outline" className="mr-2">{d.module}</Badge>
                          <span>{d.title ?? d.recordId}</span>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Full content (collapsible) */}
              {detail.content && (
                <section>
                  <button
                    type="button"
                    onClick={() => setShowContent((v) => !v)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showContent ? "收起正文" : "查看正文"} ({detail.content.length} 字)
                  </button>
                  {showContent && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed rounded border bg-muted/30 p-3 max-h-96 overflow-y-auto">
                      {detail.content}
                    </pre>
                  )}
                </section>
              )}

              {/* Raw metadata (collapsible) */}
              <section>
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showRaw ? "隐藏" : "显示"} 原始元数据 (raw_metadata)
                </button>
                {showRaw && (
                  <pre className="mt-2 text-xs font-mono rounded border bg-muted/30 p-3 max-h-60 overflow-y-auto">
                    {JSON.stringify(detail.rawMetadata, null, 2)}
                  </pre>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Correct outlet dialog — rendered outside Sheet to avoid nesting issues */}
      {showCorrectDialog && detail && (
        <Dialog open onOpenChange={(open) => !open && setShowCorrectDialog(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>修正 outlet</DialogTitle>
            </DialogHeader>
            <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
              <SelectTrigger>
                <SelectValue placeholder="选择媒体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未分类</SelectItem>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.outletName}（{OUTLET_TIER_LABELS[o.outletTier as OutletTier] ?? o.outletTier}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCorrectDialog(false)}>
                取消
              </Button>
              <Button disabled={pending} onClick={handleSaveOutlet}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
