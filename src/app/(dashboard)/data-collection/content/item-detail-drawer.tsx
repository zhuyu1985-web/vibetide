"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  getCollectionItemDetailAction,
  type ItemDetailPayload,
} from "@/app/actions/collection-items";

interface ItemDetailDrawerProps {
  itemId: string | null;
  onClose: () => void;
}

export function ItemDetailDrawer({ itemId, onClose }: ItemDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ItemDetailPayload | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getCollectionItemDetailAction(itemId)
      .then((d) => setDetail(d))
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

  return (
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
  );
}
