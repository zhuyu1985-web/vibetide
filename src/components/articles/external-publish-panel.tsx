"use client";

import { useState, useTransition } from "react";
import { Send, ExternalLink, Twitter, Instagram, Facebook, Linkedin } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { publishToAyrshareAction } from "@/app/actions/external-publish";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ExternalPublicationItem {
  platform: string;
  status: string;
  platformPostUrl?: string | null;
}

interface ExternalPublishPanelProps {
  articleId: string;
  /** 文章语种；非 en 时直接 return null（中文稿件不显示该面板）。 */
  articleLanguage: string;
  /** 已有发布记录（按 articleId 过滤，按 submittedAt desc）。 */
  existingPublications: ExternalPublicationItem[];
}

// ─── Platform metadata ────────────────────────────────────────────────────

const PLATFORMS = [
  { key: "twitter", label: "Post to X", shortLabel: "X", Icon: Twitter },
  { key: "instagram", label: "Post to Instagram", shortLabel: "Instagram", Icon: Instagram },
  { key: "facebook", label: "Post to Facebook", shortLabel: "Facebook", Icon: Facebook },
  { key: "linkedin", label: "Post to LinkedIn", shortLabel: "LinkedIn", Icon: Linkedin },
] as const;

type PlatformKey = (typeof PLATFORMS)[number]["key"];

// ─── Status badge ─────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "success":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/30";
    case "submitting":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/30";
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/30";
    case "retrying":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "success":
      return "已发布";
    case "submitting":
      return "提交中";
    case "failed":
      return "失败";
    case "retrying":
      return "重试中";
    default:
      return status;
  }
}

function platformLabel(platformKey: string): string {
  const entry = PLATFORMS.find((p) => p.key === platformKey);
  return entry?.shortLabel ?? platformKey;
}

function platformIcon(platformKey: string) {
  const entry = PLATFORMS.find((p) => p.key === platformKey);
  return entry?.Icon ?? Send;
}

// ─── Component ────────────────────────────────────────────────────────────

export function ExternalPublishPanel({
  articleId,
  articleLanguage,
  existingPublications,
}: ExternalPublishPanelProps) {
  // 中文稿件不展示面板
  if (articleLanguage !== "en") return null;

  const [selected, setSelected] = useState<Record<PlatformKey, boolean>>({
    twitter: true,
    instagram: false,
    facebook: false,
    linkedin: false,
  });
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const togglePlatform = (key: PlatformKey, next: boolean) => {
    setSelected((prev) => ({ ...prev, [key]: next }));
  };

  const selectedPlatforms = PLATFORMS.filter((p) => selected[p.key]).map((p) => p.key);
  const canSubmit = selectedPlatforms.length > 0 && !isPending;

  const handlePublish = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await publishToAyrshareAction({
          articleId,
          platforms: selectedPlatforms,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorMessage(message);
      }
    });
  };

  return (
    <GlassCard variant="panel" padding="md" className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Send className="size-4 text-sky-500" />
          发布到外站
        </h3>
        <p className="text-xs text-muted-foreground">
          通过 Ayrshare 一键投递英文稿件到海外社交平台。
        </p>
      </div>

      {/* 平台多选 */}
      <div className="space-y-2">
        {PLATFORMS.map(({ key, label, Icon }) => {
          const id = `external-platform-${key}`;
          return (
            <div key={key} className="flex items-center gap-3">
              <Checkbox
                id={id}
                checked={selected[key]}
                onCheckedChange={(v) => togglePlatform(key, v === true)}
                disabled={isPending}
              />
              <Label htmlFor={id} className="cursor-pointer text-xs">
                <Icon className="size-3.5 text-muted-foreground" />
                <span>{label}</span>
              </Label>
            </div>
          );
        })}
      </div>

      {/* 主按钮 */}
      <Button
        variant="default"
        size="sm"
        className="w-full"
        onClick={handlePublish}
        disabled={!canSubmit}
      >
        <Send className="size-3.5" />
        {isPending
          ? "发布中…"
          : selectedPlatforms.length > 0
            ? `发布到 ${selectedPlatforms.length} 个平台`
            : "发布到外站"}
      </Button>

      {errorMessage && (
        <div className="text-xs text-rose-600 dark:text-rose-400 break-words">
          {errorMessage}
        </div>
      )}

      {/* 已有发布记录 */}
      {existingPublications.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
          <p className="text-xs font-medium text-muted-foreground">发布记录</p>
          <ul className="space-y-1.5">
            {existingPublications.map((pub, idx) => {
              const Icon = platformIcon(pub.platform);
              return (
                <li
                  key={`${pub.platform}-${idx}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <Icon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">
                    {platformLabel(pub.platform)}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] px-1.5 py-0", statusBadgeClass(pub.status))}
                  >
                    {statusLabel(pub.status)}
                  </Badge>
                  {pub.platformPostUrl && (
                    <a
                      href={pub.platformPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-500 hover:text-sky-400 shrink-0"
                      title="查看原文"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}
