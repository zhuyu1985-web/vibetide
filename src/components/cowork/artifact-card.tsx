"use client";

import {
  FileText,
  Image,
  PlaySquare,
  File,
  Database,
  FileQuestion,
  PencilLine,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ArtifactPreviewItem,
  ArtifactPreviewKind,
} from "@/lib/cowork/artifact-preview";

interface ArtifactListProps {
  artifacts: ArtifactPreviewItem[];
  selectedArtifactId: string | null;
  onSelect: (artifact: ArtifactPreviewItem) => void;
}

export function ArtifactList({
  artifacts,
  selectedArtifactId,
  onSelect,
}: ArtifactListProps) {
  if (artifacts.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {artifacts.map((artifact) => (
        <ArtifactCard
          key={artifact.id}
          artifact={artifact}
          selected={artifact.id === selectedArtifactId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ArtifactCard({
  artifact,
  selected,
  onSelect,
}: {
  artifact: ArtifactPreviewItem;
  selected: boolean;
  onSelect: (artifact: ArtifactPreviewItem) => void;
}) {
  const Icon = iconForKind(artifact.kind);
  const label = labelForKind(artifact.kind);
  const excerpt = artifactExcerpt(artifact);
  const meta = artifactMeta(artifact);

  return (
    <Button
      type="button"
      variant="ghost"
      data-artifact-card
      data-selected={selected ? "true" : "false"}
      onClick={() => onSelect(artifact)}
      aria-label={`打开产物：${artifact.title}`}
      className={cn(
        "group h-auto w-full items-start justify-start gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors",
        selected
          ? "border-primary/45 bg-primary/5 ring-1 ring-inset ring-primary/25"
          : "border-border/70 hover:border-primary/35 hover:bg-muted/30",
      )}
    >
      <PreviewThumb artifact={artifact} icon={Icon} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {artifact.title}
          </span>
          <Badge
            variant="secondary"
            className="h-5 flex-none px-1.5 text-[10px]"
          >
            {label}
          </Badge>
          {artifact.editable && (
            <Badge
              variant="outline"
              className="h-5 flex-none px-1.5 text-[10px] text-primary"
            >
              <PencilLine className="size-3" />
              可编辑
            </Badge>
          )}
          {artifact.edited && (
            <Badge
              variant="outline"
              className="h-5 flex-none px-1.5 text-[10px] text-amber-600 dark:text-amber-400"
            >
              已编辑
            </Badge>
          )}
        </div>
        {meta && <div className="mt-1 text-[11px] text-muted-foreground">{meta}</div>}
        {excerpt && (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-foreground/75">
            {excerpt}
          </p>
        )}
      </div>
    </Button>
  );
}

function PreviewThumb({
  artifact,
  icon: Icon,
}: {
  artifact: ArtifactPreviewItem;
  icon: typeof FileText;
}) {
  if (artifact.kind === "image" && artifact.fileUrl) {
    return (
      <span className="relative h-16 w-24 flex-none overflow-hidden rounded-lg border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artifact.fileUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="size-5" />
    </span>
  );
}

function iconForKind(kind: ArtifactPreviewKind) {
  switch (kind) {
    case "draft":
    case "markdown":
    case "short_text":
      return FileText;
    case "image":
      return Image;
    case "video":
      return PlaySquare;
    case "document":
      return File;
    case "data":
      return Database;
    default:
      return FileQuestion;
  }
}

export function labelForKind(kind: ArtifactPreviewKind): string {
  const labels: Record<ArtifactPreviewKind, string> = {
    short_text: "短文本",
    draft: "稿件",
    image: "图片",
    video: "视频",
    document: "文档",
    markdown: "Markdown",
    data: "数据",
    unknown: "产物",
  };
  return labels[kind];
}

function artifactMeta(artifact: ArtifactPreviewItem): string {
  const parts: string[] = [];
  if (artifact.content.trim()) parts.push(`${artifact.content.length} 字`);
  if (artifact.mimeType) parts.push(artifact.mimeType);
  if (artifact.version && artifact.version > 1) parts.push(`v${artifact.version}`);
  return parts.join(" · ");
}

function artifactExcerpt(artifact: ArtifactPreviewItem): string {
  const text = artifact.content.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 96 ? `${text.slice(0, 96)}...` : text;
}
