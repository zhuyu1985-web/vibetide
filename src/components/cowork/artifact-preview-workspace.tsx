"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ExternalLink,
  Download,
  Save,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { saveCoworkArtifactDraft } from "@/app/actions/cowork-submit";
import { labelForKind } from "@/components/cowork/artifact-card";
import type { ArtifactPreviewItem } from "@/lib/cowork/artifact-preview";

interface ArtifactPreviewWorkspaceProps {
  artifact: ArtifactPreviewItem;
  onClose: () => void;
  onSaved?: (artifact: ArtifactPreviewItem) => void;
}

export function ArtifactPreviewWorkspace({
  artifact,
  onClose,
  onSaved,
}: ArtifactPreviewWorkspaceProps) {
  return (
    <aside className="flex min-w-0 flex-1 flex-col border-l border-border bg-background">
      <div className="flex h-12 flex-none items-center gap-2 border-b border-border/60 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{artifact.title}</div>
        </div>
        <Badge variant="secondary" className="flex-none text-[11px]">
          {labelForKind(artifact.kind)}
          {artifact.version && artifact.version > 1 ? ` · v${artifact.version}` : ""}
        </Badge>
        {artifact.fileUrl && (
          <Button asChild variant="ghost" size="icon-sm" aria-label="在新窗口打开">
            <a href={artifact.fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="关闭产物预览"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {artifact.kind === "image" ? (
          <ImagePreview artifact={artifact} />
        ) : artifact.kind === "video" ? (
          <VideoPreview artifact={artifact} />
        ) : artifact.kind === "document" ? (
          <DocumentPreview artifact={artifact} />
        ) : artifact.kind === "draft" || artifact.kind === "markdown" ? (
          <DraftPreview key={artifact.id} artifact={artifact} onSaved={onSaved} />
        ) : (
          <TextPreview artifact={artifact} />
        )}
      </div>
    </aside>
  );
}

function DraftPreview({
  artifact,
  onSaved,
}: {
  artifact: ArtifactPreviewItem;
  onSaved?: (artifact: ArtifactPreviewItem) => void;
}) {
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">(
    "saved",
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const initialHtml = useMemo(() => toEditorHtml(artifact.content), [artifact.content]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: artifact.editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: "开始编辑稿件…" }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[520px] focus:outline-none",
      },
    },
    onUpdate: () => {
      setStatus("dirty");
      setError("");
    },
  });

  function save() {
    if (!editor || !artifact.editable || isPending) return;
    const content = editor.getHTML();
    setStatus("saving");
    startTransition(async () => {
      const res = await saveCoworkArtifactDraft({
        missionId: artifact.missionId,
        artifactId: artifact.id,
        content,
      });
      if (!res.ok) {
        setStatus("error");
        setError(res.error);
        return;
      }
      setStatus("saved");
      onSaved?.({
        ...artifact,
        content,
        version: res.version,
        edited: true,
        metadata: {
          ...artifact.metadata,
          edited: true,
          editedAt: new Date().toISOString(),
        },
      });
    });
  }

  return (
    <div className="flex min-h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
        <ToolbarButton
          disabled={!editor || !artifact.editable}
          active={editor?.isActive("bold") ?? false}
          label="加粗"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          disabled={!editor || !artifact.editable}
          active={editor?.isActive("italic") ?? false}
          label="斜体"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          disabled={!editor || !artifact.editable}
          active={editor?.isActive("bulletList") ?? false}
          label="无序列表"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          disabled={!editor || !artifact.editable}
          active={editor?.isActive("orderedList") ?? false}
          label="有序列表"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {artifact.editable ? statusLabel(status) : "当前产物暂不可保存"}
          </span>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            disabled={!artifact.editable || !editor || status === "saving"}
            onClick={save}
          >
            {status === "saving" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            保存
          </Button>
        </div>
      </div>
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 flex-none" />
          <span>{error}</span>
        </div>
      )}
      <div
        className={cn(
          "flex-1 rounded-lg border border-border bg-card px-5 py-4 shadow-sm",
          !artifact.editable && "bg-muted/20",
        )}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ImagePreview({ artifact }: { artifact: ArtifactPreviewItem }) {
  if (!artifact.fileUrl) return <Unavailable artifact={artifact} label="图片地址缺失" />;
  return (
    <div className="flex min-h-full flex-col p-4">
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-muted/20 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artifact.fileUrl}
          alt={artifact.title}
          className="max-h-[70vh] max-w-full rounded-md object-contain shadow-sm"
        />
      </div>
      <ArtifactFooter artifact={artifact} />
    </div>
  );
}

function VideoPreview({ artifact }: { artifact: ArtifactPreviewItem }) {
  if (!artifact.fileUrl) return <Unavailable artifact={artifact} label="视频地址缺失" />;
  return (
    <div className="flex min-h-full flex-col p-4">
      <div className="rounded-lg border border-border bg-black p-2">
        <video controls src={artifact.fileUrl} className="aspect-video w-full rounded-md" />
      </div>
      <ArtifactFooter artifact={artifact} />
    </div>
  );
}

function DocumentPreview({ artifact }: { artifact: ArtifactPreviewItem }) {
  if (!artifact.fileUrl) return <Unavailable artifact={artifact} label="文档地址缺失" />;
  return (
    <div className="flex min-h-full flex-col p-4">
      <iframe
        title={artifact.title}
        src={artifact.fileUrl}
        className="min-h-[68vh] w-full rounded-lg border border-border bg-card"
      />
      <ArtifactFooter artifact={artifact} />
    </div>
  );
}

function TextPreview({ artifact }: { artifact: ArtifactPreviewItem }) {
  return (
    <div className="p-4">
      <div className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed whitespace-pre-wrap">
        {artifact.content || "该产物没有可预览内容。"}
      </div>
      <ArtifactFooter artifact={artifact} />
    </div>
  );
}

function ArtifactFooter({ artifact }: { artifact: ArtifactPreviewItem }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {artifact.mimeType && <span>{artifact.mimeType}</span>}
      {artifact.content && <span>{artifact.content.length} 字</span>}
      {artifact.version && artifact.version > 1 && <span>v{artifact.version}</span>}
      {artifact.fileUrl && (
        <>
          <Button asChild variant="secondary" size="sm" className="ml-auto h-8 gap-1.5">
            <a href={artifact.fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              打开
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <a href={artifact.fileUrl} download>
              <Download className="size-3.5" />
              下载
            </a>
          </Button>
        </>
      )}
    </div>
  );
}

function Unavailable({
  artifact,
  label,
}: {
  artifact: ArtifactPreviewItem;
  label: string;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <AlertCircle className="size-8 text-muted-foreground/50" />
      <div className="text-sm font-medium">{label}</div>
      <p className="max-w-sm text-xs text-muted-foreground">
        {artifact.content || "系统已记录该产物，但当前没有可直接预览的文件地址。"}
      </p>
    </div>
  );
}

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="size-8 rounded-md"
    >
      {children}
    </Button>
  );
}

function statusLabel(status: "saved" | "dirty" | "saving" | "error"): string {
  const labels = {
    saved: "已保存",
    dirty: "有未保存修改",
    saving: "保存中",
    error: "保存失败",
  };
  return labels[status];
}

function toEditorHtml(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "<p></p>";
  if (/^<[\s\S]+>$/.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
