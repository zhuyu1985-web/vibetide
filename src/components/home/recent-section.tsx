"use client";

import Link from "next/link";
import { Target, MessageSquare, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface RecentMission {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sourceModule?: string;
}

interface RecentConversation {
  id: string;
  title: string;
  employeeSlug: string;
  updatedAt: string;
}

interface RecentSectionProps {
  missions: RecentMission[];
  conversations: RecentConversation[];
}

function RelativeTime({ isoString }: { isoString: string }) {
  const date = new Date(isoString);
  return (
    <span className="text-[10px] text-gray-300 dark:text-white/30 shrink-0">
      {formatDistanceToNow(date, { addSuffix: true, locale: zhCN })}
    </span>
  );
}

export function RecentSection({ missions, conversations }: RecentSectionProps) {
  const recentMissions = missions.slice(0, 5);
  const recentConversations = conversations.slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 最近任务 */}
      <div className="rounded-2xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.06] p-4 flex flex-col gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.03)]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-gray-600 dark:text-white/60" />
            <span className="text-sm font-medium text-gray-800 dark:text-white/80">最近任务</span>
          </div>
          <Link
            href="/missions"
            className={cn(
              "flex items-center gap-1 text-xs text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
            )}
          >
            查看全部
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Mission list */}
        <div className="flex flex-col gap-0.5">
          {recentMissions.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-xs text-gray-200 dark:text-white/20">暂无任务</span>
            </div>
          ) : (
            recentMissions.map((mission) => (
              <Link
                key={mission.id}
                href={`/missions/${mission.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-300"
              >
                <span className="text-sm text-gray-800 dark:text-white/80 truncate">{mission.title}</span>
                <RelativeTime isoString={mission.createdAt} />
              </Link>
            ))
          )}
        </div>
      </div>

      {/* 最近对话 */}
      <div className="rounded-2xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.06] p-4 flex flex-col gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.03)]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-gray-600 dark:text-white/60" />
            <span className="text-sm font-medium text-gray-800 dark:text-white/80">最近对话</span>
          </div>
          <Link
            href="/chat"
            className={cn(
              "flex items-center gap-1 text-xs text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
            )}
          >
            查看全部
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Conversation list */}
        <div className="flex flex-col gap-0.5">
          {recentConversations.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-xs text-gray-200 dark:text-white/20">暂无对话</span>
            </div>
          ) : (
            recentConversations.map((conv) => {
              const slug = conv.employeeSlug as EmployeeId;
              const emp = EMPLOYEE_META[slug] as typeof EMPLOYEE_META[EmployeeId] | undefined;
              const Icon = emp?.icon;

              return (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-300"
                >
                  {/* Employee icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: emp?.bgColor ?? "rgba(107,114,128,0.15)" }}
                  >
                    {Icon ? (
                      <Icon size={14} style={{ color: emp?.color ?? "#6b7280" }} />
                    ) : (
                      <MessageSquare size={14} className="text-gray-500 dark:text-white/50" />
                    )}
                  </div>

                  {/* Title + time */}
                  <span className="text-sm text-gray-800 dark:text-white/80 truncate flex-1">{conv.title}</span>
                  <RelativeTime isoString={conv.updatedAt} />
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
