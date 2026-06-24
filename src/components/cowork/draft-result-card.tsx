"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/glass-card";
import { reviseDraftInConversation } from "@/app/actions/cowork-content-creation";

/**
 * draft_result 消息的瘦身 meta 契约：
 * - `bodyPreview`（≤200 字）始终存在，作为内联预览。
 * - 完整 `body` 仅在降级路径（articleId 为 null、无可打开的编辑器）才透传；
 *   已入库时 body 不进 meta（文章本身才是真相源），靠「打开编辑器」精修。
 */
export interface DraftResultMeta {
  articleId: string | null;
  archived: boolean;
  title: string;
  bodyPreview: string;
  wordCount: number;
  channel: string;
  genre: string;
  illustrate: boolean;
  body?: string;
}

export function DraftResultCard({
  meta,
  conversationId,
}: {
  meta: DraftResultMeta;
  conversationId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  // 仅降级路径（meta.body 存在）才有“展开全文”的意义；已入库时走「打开编辑器」。
  const canExpand = !!meta.body && meta.body.length > meta.bodyPreview.length;
  const shown = expanded && meta.body ? meta.body : meta.bodyPreview;
  // 仅当确实能内联展开时才补省略号；归档/截断路径无“展开全文”，靠「打开编辑器精修」，不挂悬空的 …
  const truncated = canExpand && !expanded;

  const onRevise = async () => {
    if (!meta.articleId || !instruction.trim() || revising) return;
    setRevising(true);
    try {
      await reviseDraftInConversation(conversationId, meta.articleId, instruction.trim());
      setInstruction("");
    } finally {
      setRevising(false);
    }
  };

  return (
    <GlassCard className="max-w-md space-y-2 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        📄 初稿已生成
        <span
          className={`ml-auto text-xs ${meta.archived ? "text-emerald-600" : "text-amber-600"}`}
        >
          {meta.archived ? "✓ 已存入稿件库 · 草稿" : "未入库（可重试）"}
        </span>
      </div>
      <div className="text-[15px] font-semibold">{meta.title}</div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>📝 约 {meta.wordCount} 字</span>
        <span>🏷 {meta.genre}</span>
        <span>📡 {meta.channel}</span>
      </div>
      <div className="whitespace-pre-wrap text-sm text-foreground/90">
        {shown}
        {truncated ? "…" : ""}
      </div>
      {canExpand && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "收起" : "展开全文"}
        </Button>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {meta.articleId && (
          <Button asChild>
            <Link href={`/articles/${meta.articleId}`}>📝 打开编辑器精修</Link>
          </Button>
        )}
      </div>
      {/* 说一句改一版：仅在稿件已入库（有 articleId 可改写）时出现 */}
      {meta.articleId && (
        <div className="flex gap-2 pt-1">
          <Input
            value={instruction}
            placeholder="说一句改一版，如「导语短一点、加个数据」"
            disabled={revising}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onRevise();
              }
            }}
          />
          <Button
            variant="ghost"
            onClick={() => void onRevise()}
            disabled={revising || !instruction.trim()}
          >
            {revising ? "改稿中…" : "改一版"}
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
