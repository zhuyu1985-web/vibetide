"use client";

import { useState, useTransition } from "react";
import { submitDocFeedback } from "@/app/actions/help-feedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface DocFeedbackProps {
  docPath: string;
}

export function DocFeedback({ docPath }: DocFeedbackProps) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submitVote = (helpful: boolean) => {
    setVote(helpful ? "up" : "down");
    startTransition(async () => {
      await submitDocFeedback({ docPath, helpful });
    });
  };

  const submitComment = () => {
    if (!comment.trim() || !vote) return;
    startTransition(async () => {
      await submitDocFeedback({
        docPath,
        helpful: vote === "up",
        comment,
      });
      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <div className="my-12 text-center text-sm text-muted-foreground">
        感谢反馈,我们会持续改进。
      </div>
    );
  }

  return (
    <div className="my-12 rounded-lg border border-border/60 p-6">
      <div className="text-sm font-medium mb-3">这篇文档对你有帮助吗?</div>
      <div className="flex gap-3">
        <Button
          variant={vote === "up" ? "default" : "ghost"}
          size="sm"
          onClick={() => submitVote(true)}
          disabled={isPending}
        >
          👍 有帮助
        </Button>
        <Button
          variant={vote === "down" ? "default" : "ghost"}
          size="sm"
          onClick={() => submitVote(false)}
          disabled={isPending}
        >
          👎 没帮助
        </Button>
      </div>
      {vote && (
        <div className="mt-4 space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="怎么改进?(可选,最多 500 字)"
            maxLength={500}
          />
          <Button
            size="sm"
            onClick={submitComment}
            disabled={isPending || !comment.trim()}
          >
            提交评论
          </Button>
        </div>
      )}
    </div>
  );
}
