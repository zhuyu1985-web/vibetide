"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Pencil,
  Zap,
  GraduationCap,
  GitCompare,
} from "lucide-react";
import { rollbackEmployeeConfig } from "@/app/actions/employee-advanced";
import { cn } from "@/lib/utils";

interface VersionEntry {
  id: string;
  version: number;
  changedFields: string[] | null;
  changeDescription: string | null;
  createdAt: string;
  snapshot: Record<string, unknown>;
}

interface VersionHistoryProps {
  employeeId: string;
  versions: VersionEntry[];
}

const fieldLabels: Record<string, string> = {
  name: "角色名称",
  nickname: "昵称",
  title: "职称",
  motto: "座右铭",
  roleType: "角色类型",
  authorityLevel: "权限等级",
  autoActions: "自主操作",
  needApprovalActions: "需审批操作",
  workPreferences: "工作偏好",
  learnedPatterns: "学习模式",
  status: "状态",
  disabled: "禁用状态",
  rollback: "版本回滚",
};

function getChangeTypeIcon(changedFields: string[]) {
  if (changedFields.includes("rollback")) return <RotateCcw size={12} className="text-amber-500" />;
  if (changedFields.includes("learnedPatterns")) return <GraduationCap size={12} className="text-purple-500" />;
  if (changedFields.includes("authorityLevel") && changedFields.length === 1) return <Zap size={12} className="text-blue-500" />;
  return <Pencil size={12} className="text-gray-500" />;
}

export function VersionHistory({ employeeId, versions }: VersionHistoryProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<VersionEntry | null>(
    null
  );
  const [rolling, setRolling] = useState(false);

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setRolling(true);
    try {
      await rollbackEmployeeConfig(employeeId, rollbackTarget.id);
      setRollbackTarget(null);
      router.refresh();
    } catch (err) {
      console.error("Rollback failed:", err);
    } finally {
      setRolling(false);
    }
  };

  if (versions.length === 0) {
    return (
      <GlassCard>
        <div className="text-center py-12">
          <History size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            暂无版本记录
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            对员工配置进行修改后，将自动记录版本历史
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {versions.map((ver, idx) => {
          const isExpanded = expandedId === ver.id;
          const isLatest = idx === 0;
          const changedFields = ver.changedFields || [];
          const isRollbackVersion = changedFields.includes("rollback");

          return (
            <GlassCard
              key={ver.id}
              variant="interactive"
              padding="md"
              className="relative"
            >
              {/* Timeline dot */}
              <div className="absolute left-0 top-0 bottom-0 w-1">
                <div
                  className={cn(
                    "absolute left-0 top-5 w-1 rounded-full",
                    isLatest
                      ? "h-3 bg-blue-500"
                      : isRollbackVersion
                        ? "h-3 bg-amber-500"
                        : "h-3 bg-gray-300"
                  )}
                />
                {idx < versions.length - 1 && (
                  <div className="absolute left-[1.5px] top-9 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                )}
              </div>

              <div className="pl-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getChangeTypeIcon(changedFields)}
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      v{ver.version}
                    </span>
                    {isLatest && (
                      <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px]">
                        最新
                      </Badge>
                    )}
                    {isRollbackVersion && (
                      <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px]">
                        回滚
                      </Badge>
                    )}
                    {changedFields
                      .filter((f) => f !== "rollback")
                      .map((field) => (
                        <Badge
                          key={field}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {fieldLabels[field] || field}
                        </Badge>
                      ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {new Date(ver.createdAt).toLocaleString("zh-CN")}
                    </span>
                    {!isLatest && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setCompareId(compareId === ver.id ? null : ver.id)}
                        >
                          <GitCompare size={12} className="mr-1" />
                          对比
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          onClick={() => setRollbackTarget(ver)}
                        >
                          <RotateCcw size={12} className="mr-1" />
                          回滚
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : ver.id)
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Description */}
                {ver.changeDescription && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {ver.changeDescription}
                  </p>
                )}

                {/* Expanded snapshot view */}
                {isExpanded && (
                  <div className="mt-3 p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50">
                    <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      配置快照
                    </h4>
                    <div className="space-y-1.5">
                      {Object.entries(ver.snapshot).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 min-w-[80px] shrink-0">
                            {fieldLabels[key] || key}
                          </span>
                          <span className="text-[11px] text-gray-700 dark:text-gray-300 break-all">
                            {typeof value === "object"
                              ? JSON.stringify(value, null, 0)
                              : String(value ?? "-")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Version comparison with latest */}
                {compareId === ver.id && versions.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                    <h4 className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                      <GitCompare size={12} />
                      与最新版本 (v{versions[0].version}) 对比
                    </h4>
                    <div className="space-y-2">
                      {Object.keys({ ...versions[0].snapshot, ...ver.snapshot }).map((key) => {
                        const current = versions[0].snapshot[key];
                        const selected = ver.snapshot[key];
                        const currentStr = typeof current === "object" ? JSON.stringify(current) : String(current ?? "-");
                        const selectedStr = typeof selected === "object" ? JSON.stringify(selected) : String(selected ?? "-");
                        const changed = currentStr !== selectedStr;
                        if (!changed) return null;
                        return (
                          <div key={key} className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px]">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">
                              {fieldLabels[key] || key}
                            </span>
                            <div className="p-1.5 rounded bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 break-all">
                              v{ver.version}: {selectedStr}
                            </div>
                            <div className="p-1.5 rounded bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 break-all">
                              最新: {currentStr}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={!!rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
      >
        <DialogContent className="glass-panel sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              确认回滚
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              此操作将把员工配置回滚到 v{rollbackTarget?.version} 版本的状态。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            {rollbackTarget?.changeDescription && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                该版本描述: {rollbackTarget.changeDescription}
              </p>
            )}
            {rollbackTarget && versions.length > 0 && (
              <div className="text-[10px] space-y-1">
                <p className="text-gray-500 dark:text-gray-400 font-medium">将要变更的字段：</p>
                {Object.keys({ ...versions[0].snapshot, ...rollbackTarget.snapshot }).map((key) => {
                  const current = versions[0].snapshot[key];
                  const target = rollbackTarget.snapshot[key];
                  const currentStr = typeof current === "object" ? JSON.stringify(current) : String(current ?? "-");
                  const targetStr = typeof target === "object" ? JSON.stringify(target) : String(target ?? "-");
                  if (currentStr === targetStr) return null;
                  return (
                    <div key={key} className="flex items-start gap-2 text-gray-500 dark:text-gray-400">
                      <span className="font-medium min-w-[60px]">{fieldLabels[key] || key}:</span>
                      <span className="text-red-500 line-through">{currentStr.slice(0, 50)}</span>
                      <span>→</span>
                      <span className="text-green-600">{targetStr.slice(0, 50)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500">
              回滚后会生成新的版本记录，原始历史不会丢失。
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setRollbackTarget(null)}
              disabled={rolling}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="text-xs bg-amber-500 hover:bg-amber-600"
              onClick={handleRollback}
              disabled={rolling}
            >
              {rolling ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <RotateCcw size={12} className="mr-1" />
              )}
              确认回滚
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
