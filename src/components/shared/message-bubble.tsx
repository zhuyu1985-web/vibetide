"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { EmployeeAvatar } from "./employee-avatar";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, GitPullRequest, Activity, FileText, Loader2 } from "lucide-react";
import { approveWorkflowStep } from "@/app/actions/workflow-engine";
import { markMessageRead } from "@/app/actions/notifications";
import type { TeamMessage, MessageAction } from "@/lib/types";

const typeConfig = {
  alert: { icon: AlertTriangle, label: "预警", className: "border-l-red-400" },
  decision_request: { icon: GitPullRequest, label: "决策", className: "border-l-purple-400" },
  status_update: { icon: Activity, label: "进度", className: "border-l-blue-400" },
  work_output: { icon: FileText, label: "产出", className: "border-l-green-400" },
};

interface MessageBubbleProps {
  message: TeamMessage;
  isRead?: boolean;
}

export function MessageBubble({ message, isRead = false }: MessageBubbleProps) {
  const router = useRouter();
  const meta = EMPLOYEE_META[message.employeeId];
  const config = typeConfig[message.type];
  const TypeIcon = config.icon;
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionsHandled, setActionsHandled] = useState(false);
  const [read, setRead] = useState(isRead);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Mark as read when message becomes visible via IntersectionObserver
  useEffect(() => {
    if (read) return;
    const el = bubbleRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRead(true);
            markMessageRead(message.id).catch(() => {});
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [read, message.id]);

  const timeStr = new Date(message.timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleAction = async (action: MessageAction) => {
    if (!message.workflowInstanceId) return;

    const stepId = action.stepId || message.workflowStepId || "";
    setActionLoading(action.label);

    try {
      if (action.label === "批准") {
        await approveWorkflowStep({
          workflowInstanceId: message.workflowInstanceId,
          stepId,
          approved: true,
        });
      } else if (action.label === "驳回") {
        await approveWorkflowStep({
          workflowInstanceId: message.workflowInstanceId,
          stepId,
          approved: false,
          feedback: "人工驳回",
        });
      }
      setActionsHandled(true);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      ref={bubbleRef}
      className={cn(
        "glass-card p-4 border-l-4 transition-opacity duration-300",
        config.className,
        !read && "ring-1 ring-blue-200/60"
      )}
    >
      <div className="flex items-start gap-3">
        {!read && (
          <span className="mt-2 flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
        )}
        <EmployeeAvatar
          employeeId={message.employeeId}
          size="sm"
          showStatus
          status="working"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold" style={{ color: meta?.color }}>
              {meta?.nickname}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              <TypeIcon size={10} className="mr-0.5" />
              {config.label}
            </Badge>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{timeStr}</span>
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
            {message.content}
          </div>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.attachments.map((att, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-xs"
                >
                  <FileText size={12} className="text-gray-400 dark:text-gray-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">{att.title}</span>
                  {att.description && (
                    <span className="text-gray-400 dark:text-gray-500">{att.description}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {message.actions && message.actions.length > 0 && !actionsHandled && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.actions.map((action, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={
                    action.variant === "primary"
                      ? "default"
                      : action.variant === "destructive"
                      ? "destructive"
                      : "outline"
                  }
                  className="text-xs h-7"
                  disabled={actionLoading !== null}
                  onClick={() => handleAction(action)}
                >
                  {actionLoading === action.label && (
                    <Loader2 size={12} className="mr-1 animate-spin" />
                  )}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
          {actionsHandled && (
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">已处理</div>
          )}
        </div>
      </div>
    </div>
  );
}
