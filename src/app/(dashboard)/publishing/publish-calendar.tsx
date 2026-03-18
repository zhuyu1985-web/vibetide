"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
} from "lucide-react";

interface CalendarPlanItem {
  id: string;
  title: string;
  channel: string;
  status: string;
}

interface PublishCalendarProps {
  calendarData: Record<string, CalendarPlanItem[]>;
  year: number;
  month: number;
}

const statusDotColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  published: "bg-green-500",
  failed: "bg-red-500",
  publishing: "bg-amber-500",
  draft: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  scheduled: "已排期",
  published: "已发布",
  failed: "失败",
  publishing: "发布中",
  draft: "草稿",
};

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

export function PublishCalendar({
  calendarData,
  year: initialYear,
  month: initialMonth,
}: PublishCalendarProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Calendar grid computation
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const goToPrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDate(null);
  };

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDate(todayStr);
  };

  const getDateStr = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const selectedPlans = selectedDate ? calendarData[selectedDate] || [] : [];

  // Count total plans this month
  const totalMonthPlans = useMemo(() => {
    return Object.values(calendarData).reduce((sum, plans) => sum + plans.length, 0);
  }, [calendarData]);

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToPrevMonth}>
            <ChevronLeft size={16} />
          </Button>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 min-w-[120px] text-center">
            {year}年{month}月
          </h3>
          <Button variant="ghost" size="sm" onClick={goToNextMonth}>
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            本月 {totalMonthPlans} 条发布
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={goToToday}
          >
            今天
          </Button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex items-center gap-4 px-1">
        {Object.entries(statusDotColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", color)} />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {statusLabels[status] || status}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => (
          <div
            key={d}
            className="text-center text-xs text-gray-400 dark:text-gray-500 py-2 font-medium"
          >
            {d}
          </div>
        ))}

        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-24" />;
          }

          const dateStr = getDateStr(day);
          const isToday = dateStr === todayStr;
          const dayPlans = calendarData[dateStr] || [];
          const isSelected = dateStr === selectedDate;

          return (
            <div
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={cn(
                "h-24 border rounded-lg p-1.5 text-xs cursor-pointer transition-all duration-150",
                isToday
                  ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 ring-1 ring-blue-200"
                  : "border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-600",
                isSelected && "ring-2 ring-blue-400 border-blue-400",
                dayPlans.length > 0 && !isToday && "bg-white/80 dark:bg-gray-900/80"
              )}
            >
              <span
                className={cn(
                  "font-medium text-xs",
                  isToday
                    ? "text-blue-600 dark:text-blue-400 font-bold"
                    : "text-gray-600 dark:text-gray-400"
                )}
              >
                {day}
              </span>

              {/* Plan dots/badges */}
              {dayPlans.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {dayPlans.slice(0, 3).map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center gap-1"
                    >
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          statusDotColors[plan.status] || "bg-gray-400"
                        )}
                      />
                      <span className="text-[9px] text-gray-600 dark:text-gray-400 truncate">
                        {plan.title.slice(0, 6)}
                      </span>
                    </div>
                  ))}
                  {dayPlans.length > 3 && (
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 pl-2.5">
                      +{dayPlans.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Day Detail */}
      {selectedDate && (
        <GlassCard variant="blue" padding="md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                  "zh-CN",
                  { month: "long", day: "numeric", weekday: "long" }
                )}
              </h4>
              <Badge variant="secondary" className="text-[10px]">
                {selectedPlans.length} 条发布
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSelectedDate(null)}
            >
              <X size={14} />
            </Button>
          </div>

          {selectedPlans.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
              该日期暂无发布计划
            </p>
          ) : (
            <div className="space-y-2">
              {selectedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/60 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700/50"
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      statusDotColors[plan.status] || "bg-gray-400"
                    )}
                  />
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-100 flex-1 truncate">
                    {plan.title}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {plan.channel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] shrink-0",
                      plan.status === "published"
                        ? "text-green-600 dark:text-green-400 border-green-200"
                        : plan.status === "failed"
                        ? "text-red-600 dark:text-red-400 border-red-200"
                        : plan.status === "publishing"
                        ? "text-amber-600 dark:text-amber-400 border-amber-200"
                        : "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700/50"
                    )}
                  >
                    {statusLabels[plan.status] || plan.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
