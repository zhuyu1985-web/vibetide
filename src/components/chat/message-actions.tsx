"use client";

import { useState, useCallback } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageActionsProps {
  /** Text content of the assistant message (used for copy + feedback context). */
  messageContent: string;
  /** The employee slug who authored the message (routes feedback to the right agent). */
  employeeSlug: string;
  /** The user prompt that triggered this assistant message, for feedback context. */
  userPrompt?: string;
  /**
   * Called when the user clicks "重新生成". Parent knows how to re-run the
   * triggering user prompt (via `useChatStream.regenerate(index)`).
   */
  onRegenerate?: () => void;
  /**
   * Called when the user clicks "收藏". Parent controls what "favorite" means
   * in its context (e.g., save the whole conversation).
   */
  onFavorite?: () => void | Promise<void>;
  /**
   * External controlled favorited state — parent tells us whether the
   * enclosing conversation is currently saved so we can render the right icon.
   */
  isFavorited?: boolean;
  /**
   * Optional share URL. If omitted we share the current page.
   */
  shareUrl?: string;
  /** Tighter spacing for dense layouts (home embedded panel). */
  compact?: boolean;
  /** Hide the 重新生成 button when regeneration is in progress. */
  regenerating?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageActions({
  messageContent,
  employeeSlug,
  userPrompt,
  onRegenerate,
  onFavorite,
  isFavorited = false,
  shareUrl,
  compact = false,
  regenerating = false,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [favoriting, setFavoriting] = useState(false);

  // ── Copy ──
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  }, [messageContent]);

  // ── Feedback (like / dislike) ──
  const sendFeedback = useCallback(
    async (type: "like" | "dislike") => {
      if (submittingFeedback) return;
      // Toggle off if clicked the same button twice
      const next = feedback === type ? null : type;
      const previous = feedback;
      setFeedback(next);

      if (next === null) {
        // Local-only toggle off; don't hit API for "undo"
        return;
      }

      setSubmittingFeedback(true);
      try {
        const res = await fetch("/api/chat/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeSlug,
            feedbackType: next,
            userPrompt,
            messageContent,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success(
          next === "like"
            ? "已记录你的好评，模型会继续保持这种风格"
            : "已记录反馈，模型会在后续回复中改进"
        );
      } catch {
        // Revert on failure so the UI reflects real state
        setFeedback(previous);
        toast.error("反馈提交失败，请稍后重试");
      } finally {
        setSubmittingFeedback(false);
      }
    },
    [employeeSlug, feedback, messageContent, submittingFeedback, userPrompt]
  );

  // ── Share ──
  const handleShare = useCallback(async () => {
    const url = shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!url) {
      toast.info("暂无可分享的链接");
      return;
    }

    // Prefer native share where available (mobile + some desktop browsers)
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && "share" in nav && typeof nav.share === "function") {
      try {
        await nav.share({
          title: "Vibetide 对话分享",
          text: messageContent.slice(0, 80),
          url,
        });
        return;
      } catch {
        // User cancelled or native share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("分享链接已复制到剪贴板");
    } catch {
      toast.error("分享失败，请手动复制链接");
    }
  }, [messageContent, shareUrl]);

  // ── Favorite ──
  const handleFavorite = useCallback(async () => {
    if (favoriting || !onFavorite) return;
    setFavoriting(true);
    try {
      await onFavorite();
    } finally {
      setFavoriting(false);
    }
  }, [favoriting, onFavorite]);

  // ── Layout ──
  const btnBase = cn(
    "flex items-center gap-1 rounded-lg transition-all duration-200 border-0 cursor-pointer",
    "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50",
    compact ? "px-1.5 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
  );
  const iconSize = compact ? 11 : 12;

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 flex-wrap",
        compact ? "mt-1.5 pt-1.5" : "mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700/50"
      )}
    >
      {/* Copy */}
      <button
        onClick={handleCopy}
        className={cn(btnBase, "hover:text-blue-500")}
        title="复制"
      >
        {copied ? <Check size={iconSize} className="text-emerald-500" /> : <Copy size={iconSize} />}
        <span>{copied ? "已复制" : "复制"}</span>
      </button>

      {/* Regenerate */}
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className={cn(
            btnBase,
            "hover:text-purple-500",
            regenerating && "opacity-50 cursor-not-allowed"
          )}
          title="重新生成"
        >
          <RefreshCw
            size={iconSize}
            className={cn(regenerating && "animate-spin")}
          />
          <span>重新生成</span>
        </button>
      )}

      {/* Like */}
      <button
        onClick={() => sendFeedback("like")}
        disabled={submittingFeedback}
        className={cn(
          btnBase,
          "hover:text-emerald-500",
          feedback === "like" && "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
        )}
        title="喜欢 — 帮助模型学习你喜欢的风格"
      >
        <ThumbsUp
          size={iconSize}
          className={cn(feedback === "like" && "fill-current")}
        />
        <span>喜欢</span>
      </button>

      {/* Dislike */}
      <button
        onClick={() => sendFeedback("dislike")}
        disabled={submittingFeedback}
        className={cn(
          btnBase,
          "hover:text-orange-500",
          feedback === "dislike" && "text-orange-500 bg-orange-50 dark:bg-orange-900/20"
        )}
        title="不喜欢 — 帮助模型避免类似问题"
      >
        <ThumbsDown
          size={iconSize}
          className={cn(feedback === "dislike" && "fill-current")}
        />
        <span>不喜欢</span>
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className={cn(btnBase, "hover:text-blue-500")}
        title="分享"
      >
        <Share2 size={iconSize} />
        <span>分享</span>
      </button>

      {/* Favorite */}
      {onFavorite && (
        <button
          onClick={handleFavorite}
          disabled={favoriting}
          className={cn(
            btnBase,
            "hover:text-amber-500",
            isFavorited && "text-amber-500"
          )}
          title={isFavorited ? "已收藏" : "收藏"}
        >
          {favoriting ? (
            <Loader2 size={iconSize} className="animate-spin" />
          ) : isFavorited ? (
            <BookmarkCheck size={iconSize} />
          ) : (
            <Bookmark size={iconSize} />
          )}
          <span>{isFavorited ? "已收藏" : "收藏"}</span>
        </button>
      )}
    </div>
  );
}
