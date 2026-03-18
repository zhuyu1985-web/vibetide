import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GlassCard } from "./glass-card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  suffix?: string;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, change, suffix, icon }: StatCardProps) {
  return (
    <GlassCard padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {value}
            {suffix && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                {suffix}
              </span>
            )}
          </p>
          {typeof change === "number" && (
            <div
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                change > 0
                  ? "text-green-600 dark:text-green-400"
                  : change < 0
                  ? "text-red-500 dark:text-red-400"
                  : "text-gray-400 dark:text-gray-500"
              )}
            >
              {change > 0 ? (
                <TrendingUp size={12} />
              ) : change < 0 ? (
                <TrendingDown size={12} />
              ) : (
                <Minus size={12} />
              )}
              {change > 0 ? "+" : ""}
              {change}%
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-500">{icon}</div>
        )}
      </div>
    </GlassCard>
  );
}
