"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  setMessageFeedbackAction,
  type MessageFeedback,
} from "@/app/actions/cowork-conversations";

/**
 * AI 回答下方的操作工具栏:复制 / 重新生成 / 喜欢 / 不喜欢 / 分享。
 * - 复制、分享走客户端(剪贴板 / Web Share API,后者不可用则退化到复制)
 * - 喜欢/不喜欢乐观切换 + 持久化到消息 meta.feedback(传 messageId 才持久化)
 * - 重新生成由父级提供(文本回答=重发上一条用户消息;交付结果=重跑该任务)
 */
export function MessageActions({
  text,
  messageId,
  initialFeedback = null,
  onRegenerate,
  className,
}: {
  text: string;
  messageId?: string;
  initialFeedback?: MessageFeedback;
  onRegenerate?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<MessageFeedback>(initialFeedback);
  const [, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默
    }
  }

  async function share() {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // 用户取消或不支持 → 退化到复制
      }
    }
    void copy();
  }

  function vote(v: Exclude<MessageFeedback, null>) {
    const next: MessageFeedback = feedback === v ? null : v; // 再点同值 = 取消
    setFeedback(next);
    if (messageId) {
      startTransition(() => {
        void setMessageFeedbackAction(messageId, next);
      });
    }
  }

  return (
    <div className={cn("flex items-center gap-0.5 text-muted-foreground", className)}>
      <IconBtn label="复制" onClick={copy}>
        {copied ? (
          <Check className="size-3.5 text-emerald-500" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </IconBtn>
      {onRegenerate && (
        <IconBtn label="重新生成" onClick={onRegenerate}>
          <RefreshCw className="size-3.5" />
        </IconBtn>
      )}
      <IconBtn label="喜欢" onClick={() => vote("like")}>
        <ThumbsUp
          className={cn(
            "size-3.5",
            feedback === "like" && "fill-current text-primary",
          )}
        />
      </IconBtn>
      <IconBtn label="不喜欢" onClick={() => vote("dislike")}>
        <ThumbsDown
          className={cn(
            "size-3.5",
            feedback === "dislike" && "fill-current text-red-500",
          )}
        />
      </IconBtn>
      <IconBtn label="分享" onClick={share}>
        <Share2 className="size-3.5" />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="size-7 hover:text-foreground"
    >
      {children}
    </Button>
  );
}
