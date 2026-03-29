"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Medal,
  Star,
  TrendingUp,
  Award,
  User,
  Crown,
  Zap,
  Clock,
} from "lucide-react";

interface EditorScoreItem {
  id: string;
  userId: string;
  userName: string;
  totalPoints: number;
  level: number;
  achievements: Array<{ name: string; icon: string; earnedAt: string }>;
  monthlyPoints: number;
  weeklyPoints: number;
}

interface PointTransactionItem {
  id: string;
  userId: string;
  points: number;
  reason: string;
  referenceId: string | null;
  createdAt: string;
}

interface LeaderboardClientProps {
  leaderboard: EditorScoreItem[];
  currentUser: EditorScoreItem | null;
  transactions: PointTransactionItem[];
}

const reasonLabels: Record<string, { label: string; icon: typeof Trophy }> = {
  publish_content: { label: "发布内容", icon: Zap },
  high_quality: { label: "精品内容", icon: Star },
  trending: { label: "爆款内容", icon: TrendingUp },
  consistency: { label: "持续创作", icon: Award },
};

const levelBadges: Record<number, { label: string; color: string }> = {
  1: { label: "Lv.1 新手", color: "text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700" },
  2: { label: "Lv.2 进阶", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-700/50" },
  3: { label: "Lv.3 能手", color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-700/50" },
  4: { label: "Lv.4 高手", color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-700/50" },
  5: { label: "Lv.5 大师", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-700/50" },
};

function getLevelBadge(level: number) {
  if (level >= 5) return levelBadges[5];
  return levelBadges[level] || levelBadges[1];
}

export default function LeaderboardClient({
  leaderboard,
  currentUser,
  transactions,
}: LeaderboardClientProps) {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "all">("all");

  const getPoints = (editor: EditorScoreItem) => {
    switch (period) {
      case "weekly":
        return editor.weeklyPoints;
      case "monthly":
        return editor.monthlyPoints;
      default:
        return editor.totalPoints;
    }
  };

  // Sort by the selected period
  const sorted = [...leaderboard].sort(
    (a, b) => getPoints(b) - getPoints(a)
  );

  // Find current user's rank
  const currentUserRank = currentUser
    ? sorted.findIndex((e) => e.userId === currentUser.userId) + 1
    : 0;

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="效果激励看板"
        description="编辑个人积分排行榜，激励团队持续创作优质内容"
        actions={
          <Tabs
            value={period}
            onValueChange={(v) => setPeriod(v as "weekly" | "monthly" | "all")}
          >
            <TabsList className="h-8">
              <TabsTrigger value="weekly" className="text-xs h-6 px-3">
                本周
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs h-6 px-3">
                本月
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs h-6 px-3">
                总榜
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* Personal Stats Card */}
      {currentUser && (
        <GlassCard
          variant="blue"
          padding="md"
          className="mb-6"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold">
              {currentUser.userName.slice(0, 1)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                  {currentUser.userName}
                </h3>
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", getLevelBadge(currentUser.level).color)}
                >
                  {getLevelBadge(currentUser.level).label}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                当前排名 第{currentUserRank > 0 ? currentUserRank : "--"}名
              </p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">总积分</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {currentUser.totalPoints}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">本月</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {currentUser.monthlyPoints}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">本周</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {currentUser.weeklyPoints}
                </p>
              </div>
            </div>
          </div>

          {/* Achievements */}
          {currentUser.achievements.length > 0 && (
            <div className="mt-4 pt-3 border-t border-blue-200/50 dark:border-blue-700/30">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">成就徽章</p>
              <div className="flex gap-2 flex-wrap">
                {currentUser.achievements.map((ach, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[10px] bg-white/60 dark:bg-gray-900/60"
                  >
                    <span className="mr-1">{ach.icon}</span>
                    {ach.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" />
            积分排行榜
          </h3>

          {sorted.length === 0 ? (
            <GlassCard className="text-center py-12">
              <Trophy size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                暂无排行数据
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                发布内容获得积分，即可上榜
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {sorted.map((editor, idx) => {
                const rank = idx + 1;
                const points = getPoints(editor);
                const isTopThree = rank <= 3;
                const isCurrentUser = currentUser?.userId === editor.userId;

                return (
                  <GlassCard
                    key={editor.id}
                    variant={isCurrentUser ? "blue" : "interactive"}
                    padding="sm"
                    className={cn(
                      isTopThree && rank === 1 && "ring-1 ring-amber-300",
                      isTopThree && rank === 2 && "ring-1 ring-gray-300",
                      isTopThree && rank === 3 && "ring-1 ring-orange-300"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="w-8 text-center">
                        {rank === 1 ? (
                          <Crown size={22} className="text-amber-500 mx-auto" />
                        ) : rank === 2 ? (
                          <Medal size={20} className="text-gray-400 mx-auto" />
                        ) : rank === 3 ? (
                          <Medal size={20} className="text-orange-400 mx-auto" />
                        ) : (
                          <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
                            {rank}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold",
                          rank === 1
                            ? "bg-gradient-to-br from-amber-400 to-amber-600"
                            : rank === 2
                            ? "bg-gradient-to-br from-gray-300 to-gray-500"
                            : rank === 3
                            ? "bg-gradient-to-br from-orange-300 to-orange-500"
                            : "bg-gradient-to-br from-blue-400 to-blue-600"
                        )}
                      >
                        {editor.userName.slice(0, 1)}
                      </div>

                      {/* Name & Level */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {editor.userName}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] h-4",
                              getLevelBadge(editor.level).color
                            )}
                          >
                            {getLevelBadge(editor.level).label}
                          </Badge>
                          {isCurrentUser && (
                            <Badge className="text-[9px] h-4 bg-blue-500">
                              我
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-base font-bold",
                            rank === 1
                              ? "text-amber-600 dark:text-amber-400"
                              : rank === 2
                              ? "text-gray-600 dark:text-gray-400"
                              : rank === 3
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-gray-700 dark:text-gray-300"
                          )}
                        >
                          {points}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">积分</p>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock size={16} className="text-blue-500" />
            积分记录
          </h3>

          {transactions.length === 0 ? (
            <GlassCard className="text-center py-8">
              <Clock size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-xs text-gray-400 dark:text-gray-500">暂无积分记录</p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const reasonConfig = reasonLabels[tx.reason] || {
                  label: tx.reason,
                  icon: Zap,
                };
                const ReasonIcon = reasonConfig.icon;

                return (
                  <GlassCard key={tx.id} padding="sm">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-950/50 flex items-center justify-center">
                        <ReasonIcon size={14} className="text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                          {reasonConfig.label}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString("zh-CN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        +{tx.points}
                      </span>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
