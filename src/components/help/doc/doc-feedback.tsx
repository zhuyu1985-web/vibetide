"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface DocFeedbackProps {
  docPath: string;
}

export function DocFeedback({ docPath: _docPath }: DocFeedbackProps) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Phase 8.2 才调 server action;现阶段只本地 setState 模拟交互
  const submitVote = (v: "up" | "down") => setVote(v);
  const submitComment = () => {
    if (comment.trim()) setSubmitted(true);
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
          onClick={() => submitVote("up")}
        >
          👍 有帮助
        </Button>
        <Button
          variant={vote === "down" ? "default" : "ghost"}
          size="sm"
          onClick={() => submitVote("down")}
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
          <Button size="sm" onClick={submitComment} disabled={!comment.trim()}>
            提交评论
          </Button>
        </div>
      )}
    </div>
  );
}
