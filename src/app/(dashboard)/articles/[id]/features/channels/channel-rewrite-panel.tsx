"use client";

/**
 * 右栏「多渠道改写」面板。
 *
 * 平台 chip 切换（微信/微博/抖音/小红书/知乎/头条/快手/B 站），
 * 每个平台展开后显示该渠道字段表单 + 「一键 AI 生成本平台版本」按钮。
 *
 * 数据：article_channel_variants 表（Phase 2.1 已建）
 * Server actions：listVariantsAction / upsertVariantAction / generateVariantAction
 */

import { useEffect, useState, useTransition } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listVariantsAction,
  upsertVariantAction,
  generateVariantAction,
} from "@/app/actions/article-channel-variants";
import type { ArticleChannelVariantItem } from "@/lib/dal/article-channel-variants";

const PLATFORMS = [
  { value: "wechat_oa", label: "微信" },
  { value: "weibo", label: "微博" },
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "zhihu", label: "知乎" },
  { value: "toutiao", label: "头条" },
  { value: "kuaishou", label: "快手" },
  { value: "bilibili", label: "B 站" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  generating: "生成中",
  ready: "就绪",
  failed: "失败",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  generating: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  ready: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

interface ChannelRewritePanelProps {
  articleId: string;
  initialPlatform?: string;
  /** 隐藏内部平台 chip 行（外层 nav 已经提供平台选择时） */
  hidePlatformPicker?: boolean;
}

export function ChannelRewritePanel({
  articleId,
  initialPlatform,
  hidePlatformPicker = false,
}: ChannelRewritePanelProps) {
  const [activePlatform, setActivePlatform] = useState<string>(
    initialPlatform ?? PLATFORMS[0].value,
  );

  // 外层 nav 切平台时同步
  useEffect(() => {
    if (initialPlatform) setActivePlatform(initialPlatform);
  }, [initialPlatform]);
  const [variants, setVariants] = useState<ArticleChannelVariantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  // Local edit buffer for the active platform
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftHashtagsRaw, setDraftHashtagsRaw] = useState("");
  const [dirty, setDirty] = useState(false);

  const activeVariant = variants.find((v) => v.platform === activePlatform);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listVariantsAction(articleId)
      .then((rows) => {
        if (!cancelled) setVariants(rows);
      })
      .catch(() => {
        if (!cancelled) setVariants([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  // 切换平台时刷新 draft
  useEffect(() => {
    const v = variants.find((x) => x.platform === activePlatform);
    setDraftTitle(v?.title ?? "");
    setDraftBody(v?.body ?? "");
    setDraftSummary(v?.summary ?? "");
    setDraftHashtagsRaw((v?.hashtags ?? []).join(" "));
    setDirty(false);
  }, [activePlatform, variants]);

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const result = await generateVariantAction({
          articleId,
          platform: activePlatform,
        });
        setVariants((prev) => {
          const without = prev.filter((v) => v.platform !== activePlatform);
          return [...without, result].sort((a, b) =>
            a.platform.localeCompare(b.platform),
          );
        });
      } catch (err) {
        console.error("[ChannelRewritePanel] generate failed", err);
      }
    });
  };

  const handleSave = () => {
    const hashtags = draftHashtagsRaw
      .split(/[\s,，]+/)
      .map((w) => w.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const updated = await upsertVariantAction({
          articleId,
          platform: activePlatform,
          title: draftTitle || "(未填写标题)",
          body: draftBody,
          summary: draftSummary || undefined,
          hashtags,
        });
        setVariants((prev) => {
          const without = prev.filter((v) => v.platform !== activePlatform);
          return [...without, updated].sort((a, b) =>
            a.platform.localeCompare(b.platform),
          );
        });
        setDirty(false);
      } catch (err) {
        console.error("[ChannelRewritePanel] save failed", err);
      }
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Platform chips（外层 nav 已选时可隐藏） */}
      {!hidePlatformPicker && (
      <div className="flex flex-wrap gap-1.5 px-4 pt-4 pb-3 border-b border-[var(--glass-border)]">
        {PLATFORMS.map((p) => {
          const v = variants.find((x) => x.platform === p.value);
          const status = v?.status ?? null;
          return (
            <button
              key={p.value}
              onClick={() => setActivePlatform(p.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                activePlatform === p.value
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium"
                  : "bg-muted/30 dark:bg-white/5 text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
              {status && (
                <span
                  className={cn(
                    "px-1 py-0 rounded text-[9px] font-medium",
                    STATUS_COLOR[status] ?? STATUS_COLOR.draft,
                  )}
                >
                  {STATUS_LABEL[status] ?? status}
                </span>
              )}
            </button>
          );
        })}
      </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            加载中…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {PLATFORMS.find((p) => p.value === activePlatform)?.label} 版本
              </span>
              <button
                onClick={handleGenerate}
                disabled={pending}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : activeVariant ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {activeVariant ? "重新生成" : "AI 一键生成"}
              </button>
            </div>

            <input
              type="text"
              value={draftTitle}
              onChange={(e) => {
                setDraftTitle(e.target.value);
                setDirty(true);
              }}
              placeholder="标题（每个平台风格不同）"
              className="rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/30"
            />

            <textarea
              value={draftBody}
              onChange={(e) => {
                setDraftBody(e.target.value);
                setDirty(true);
              }}
              placeholder="正文"
              rows={8}
              className="resize-y rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/30 leading-relaxed"
            />

            <textarea
              value={draftSummary}
              onChange={(e) => {
                setDraftSummary(e.target.value);
                setDirty(true);
              }}
              placeholder="摘要（可选）"
              rows={2}
              className="resize-none rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/30"
            />

            <input
              type="text"
              value={draftHashtagsRaw}
              onChange={(e) => {
                setDraftHashtagsRaw(e.target.value);
                setDirty(true);
              }}
              placeholder="hashtags（空格或逗号分隔）"
              className="rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/30"
            />

            <button
              onClick={handleSave}
              disabled={pending || !dirty}
              className={cn(
                "mt-2 h-9 rounded-lg text-sm font-medium transition-colors",
                dirty && !pending
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-muted/40 text-muted-foreground",
              )}
            >
              {pending ? "保存中…" : dirty ? "保存本平台版本" : "无更改"}
            </button>

            {activeVariant?.status === "failed" && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                上次生成失败，点上方「重新生成」试试。
              </div>
            )}
            {activeVariant?.generatedAt && (
              <div className="text-[10px] text-muted-foreground text-right">
                AI 生成时间：{new Date(activeVariant.generatedAt).toLocaleString("zh-CN")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
