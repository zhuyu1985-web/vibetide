"use client";

import type { ChannelAdvisor } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, MessageSquare, Sparkles, Plus } from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  advisors: ChannelAdvisor[];
}

// ---------------------------------------------------------------------------
// UI constants
// ---------------------------------------------------------------------------

const statusConfig = {
  active: { label: "已上线", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  training: { label: "培训中", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  draft: { label: "草稿", className: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ChannelAdvisorClient({ advisors }: Props) {
  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title="频道顾问工坊"
        description="培养专属频道顾问，让每个渠道都有独特的声音"
        actions={
          <Link href="/channel-advisor/create">
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              培养新顾问
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {advisors.map((advisor) => {
          const status = statusConfig[advisor.status];
          return (
            <GlassCard key={advisor.id} variant="interactive">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-2xl font-bold text-pink-500">
                    {advisor.avatar}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
                      {advisor.name}
                    </h3>
                    <Badge className={`text-[10px] ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {advisor.channelType}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {advisor.personality}
                  </p>

                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      风格特点
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{advisor.style}</p>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      核心能力
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {advisor.strengths.map((s, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-pink-50/50 dark:bg-pink-950/30">
                    <MessageSquare size={14} className="text-pink-400 shrink-0" />
                    <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                      &ldquo;{advisor.catchphrase}&rdquo;
                    </p>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="text-xs h-7">
                      <Brain size={12} className="mr-1" />
                      查看详情
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7">
                      <Sparkles size={12} className="mr-1" />
                      继续培养
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
