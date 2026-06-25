"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import {
  listVariantsAction,
  generateVariantAction,
} from "@/app/actions/article-channel-variants";
import type { ArticleChannelVariantItem } from "@/lib/dal/article-channel-variants";

const PLATFORM_LABELS: Record<string, string> = {
  wechat_oa: "微信",
  weibo: "微博",
  douyin: "抖音",
  xiaohongshu: "小红书",
  zhihu: "知乎",
  toutiao: "头条",
  kuaishou: "快手",
  bilibili: "B 站",
};

type PlatformStatus = "idle" | "generating" | "ready" | "failed";

/**
 * 对话内多版本生成卡：列出目标平台 + 状态，一键/单独生成各端版本。
 * 复用 generateVariantAction（同步生成）+ listVariantsAction（读现状）。
 * 注意：generateVariantAction 对 skill 失败不抛错而返回 status:"failed"；
 * 但「文章不存在 / 无正文」两种前置校验会 throw，故 genOne 仍 try/catch 兜底。
 */
export function MultiVersionCard({
  articleId,
  platforms,
}: {
  articleId: string;
  platforms: string[];
}) {
  const [variants, setVariants] = useState<
    Record<string, ArticleChannelVariantItem>
  >({});
  const [localStatus, setLocalStatus] = useState<
    Record<string, PlatformStatus>
  >({});

  useEffect(() => {
    let active = true;
    listVariantsAction(articleId)
      .then((list) => {
        if (!active) return;
        const map: Record<string, ArticleChannelVariantItem> = {};
        for (const v of list) map[v.platform] = v;
        setVariants(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [articleId]);

  function statusOf(platform: string): PlatformStatus {
    if (localStatus[platform]) return localStatus[platform];
    const v = variants[platform];
    if (!v) return "idle";
    if (v.status === "ready") return "ready";
    if (v.status === "failed") return "failed";
    if (v.status === "generating") return "generating";
    return "idle";
  }

  async function genOne(platform: string) {
    setLocalStatus((s) => ({ ...s, [platform]: "generating" }));
    try {
      const item = await generateVariantAction({ articleId, platform });
      setVariants((m) => ({ ...m, [platform]: item }));
      setLocalStatus((s) => ({
        ...s,
        [platform]: item.status === "failed" ? "failed" : "ready",
      }));
    } catch {
      // 前置 throw（文章不存在 / 无正文）—— action 内部不 catch 这两种
      setLocalStatus((s) => ({ ...s, [platform]: "failed" }));
    }
  }

  async function genAll() {
    const todo = platforms.filter((p) => {
      const st = statusOf(p);
      return st !== "ready" && st !== "generating";
    });
    await Promise.all(todo.map(genOne));
  }

  const anyGenerating = platforms.some((p) => statusOf(p) === "generating");
  const anyFailed = platforms.some((p) => statusOf(p) === "failed");

  return (
    <GlassCard className="max-w-md space-y-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        多版本一键分产
        <Button
          size="sm"
          className="ml-auto"
          disabled={anyGenerating}
          onClick={() => void genAll()}
        >
          {anyGenerating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          一键生成
        </Button>
      </div>
      <div className="space-y-1.5">
        {platforms.map((p) => {
          const st = statusOf(p);
          const v = variants[p];
          return (
            <div
              key={p}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="font-medium">{PLATFORM_LABELS[p] ?? p}</span>
              {st === "ready" && v?.title && (
                <span className="truncate text-xs text-muted-foreground">
                  {v.title}
                </span>
              )}
              <span className="ml-auto flex flex-none items-center gap-1.5">
                <StatusBadge status={st} />
                {st === "ready" && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/articles/${articleId}`}>查看</Link>
                  </Button>
                )}
                {st === "failed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void genOne(p)}
                  >
                    <RotateCw className="size-3.5" /> 重试
                  </Button>
                )}
                {st === "idle" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void genOne(p)}
                  >
                    生成
                  </Button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {anyFailed && (
        <p className="text-xs text-destructive">部分平台生成失败，可单独重试。</p>
      )}
    </GlassCard>
  );
}

function StatusBadge({ status }: { status: PlatformStatus }) {
  if (status === "generating")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <Loader2 className="size-3 animate-spin" />
        生成中
      </span>
    );
  if (status === "ready")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="size-3" />
        已就绪
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="size-3" />
        失败
      </span>
    );
  return <span className="text-xs text-muted-foreground">未生成</span>;
}
