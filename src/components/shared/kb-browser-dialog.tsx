"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { bindKnowledgeBaseToEmployee } from "@/app/actions/employees";
import { Loader2, Link as LinkIcon, Database, ExternalLink } from "lucide-react";
import type { KnowledgeBaseInfo } from "@/lib/types";

const kbTypeLabels: Record<string, string> = {
  general: "通用",
  channel_style: "频道风格",
  sensitive_topics: "敏感话题",
  domain: "领域专业",
};

const kbTypeColors: Record<string, string> = {
  general: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  channel_style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  sensitive_topics: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  domain: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

interface KBBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeDbId: string;
  availableKBs: KnowledgeBaseInfo[];
}

export function KBBrowserDialog({
  open,
  onOpenChange,
  employeeDbId,
  availableKBs,
}: KBBrowserDialogProps) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [bindingId, setBindingId] = useState<string | null>(null);

  const filtered = availableKBs.filter((kb) => {
    if (typeFilter !== "all" && kb.type !== typeFilter) return false;
    return true;
  });

  const handleBind = async (kbId: string) => {
    setBindingId(kbId);
    try {
      await bindKnowledgeBaseToEmployee(employeeDbId, kbId);
      router.refresh();
    } catch (err) {
      console.error("Failed to bind KB:", err);
    } finally {
      setBindingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database size={18} className="text-indigo-500" />
            知识库
          </DialogTitle>
        </DialogHeader>

        {/* Manage link */}
        <div className="flex justify-end pb-1">
          <Link
            href="/knowledge-bases"
            className="text-[11px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center gap-1"
          >
            前往知识库管理
            <ExternalLink size={10} />
          </Link>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap pb-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setTypeFilter("all")}
          >
            全部
          </Button>
          {Object.entries(kbTypeLabels).map(([type, label]) => (
            <Button
              key={type}
              variant={typeFilter === type ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setTypeFilter(type)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* KB List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
              没有可绑定的知识库
            </p>
          ) : (
            filtered.map((kb) => (
              <div
                key={kb.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/40 dark:bg-gray-900/40 border border-indigo-100/30 dark:border-indigo-800/30"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
                  <Database size={18} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {kb.name}
                    </h4>
                    <Badge className={`${kbTypeColors[kb.type] || kbTypeColors.general} text-[10px]`}>
                      {kbTypeLabels[kb.type] || kb.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{kb.description}</p>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {kb.documentCount} 篇文档
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 shrink-0"
                  onClick={() => handleBind(kb.id)}
                  disabled={bindingId === kb.id}
                >
                  {bindingId === kb.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <>
                      <LinkIcon size={12} className="mr-1" />
                      绑定
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
