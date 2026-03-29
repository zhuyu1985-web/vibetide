"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Play,
  Trophy,
  Clock,
  Hash,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { ChannelAdvisor } from "@/lib/types";
import {
  runAdvisorComparison,
  selectComparisonWinner,
} from "@/app/actions/advisor-tests";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompareResult {
  advisorId: string;
  advisorName: string;
  output: string;
  responseTime: number;
  tokenCount: number;
}

interface CompareTest {
  id: string;
  testInput: string;
  advisorIds: string[];
  results: CompareResult[] | null;
  selectedWinner: string | null;
  notes: string | null;
  createdAt: string;
}

interface Props {
  advisors: ChannelAdvisor[];
  history: CompareTest[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompareClient({ advisors, history }: Props) {
  const router = useRouter();
  const [testInput, setTestInput] = useState("");
  const [selectedAdvisors, setSelectedAdvisors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [currentResults, setCurrentResults] = useState<CompareResult[] | null>(
    null
  );
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [selectingWinner, setSelectingWinner] = useState(false);

  function toggleAdvisor(id: string) {
    setSelectedAdvisors((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  async function handleRun() {
    if (!testInput.trim() || selectedAdvisors.length < 2) return;
    setRunning(true);
    try {
      const { testId, results } = await runAdvisorComparison(
        testInput,
        selectedAdvisors
      );
      setCurrentTestId(testId);
      setCurrentResults(results);
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  async function handleSelectWinner(advisorId: string) {
    if (!currentTestId) return;
    setSelectingWinner(true);
    try {
      await selectComparisonWinner(currentTestId, advisorId);
      router.refresh();
    } finally {
      setSelectingWinner(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Input section */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
          对比测试输入
        </h3>
        <div className="mb-4">
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="输入测试文本，例如：请为一篇关于人工智能在教育领域应用的文章撰写推荐语"
            rows={3}
            className="w-full rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 resize-none"
          />
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            选择顾问（2-4个）
          </p>
          <div className="flex flex-wrap gap-2">
            {advisors.map((advisor) => {
              const isSelected = selectedAdvisors.includes(advisor.id);
              return (
                <button
                  key={advisor.id}
                  onClick={() => toggleAdvisor(advisor.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left",
                    isSelected
                      ? "border-blue-300 bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-200"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-200"
                  )}
                >
                  <span className="text-lg">{advisor.avatar}</span>
                  <div>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-100 block">
                      {advisor.name}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {advisor.channelType}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckCircle size={14} className="text-blue-500 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={
            !testInput.trim() || selectedAdvisors.length < 2 || running
          }
        >
          {running ? (
            <>
              <Loader2 size={14} className="mr-1 animate-spin" />
              测试中...
            </>
          ) : (
            <>
              <Play size={14} className="mr-1" />
              开始对比测试
            </>
          )}
        </Button>
      </GlassCard>

      {/* Current results */}
      {currentResults && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
            对比结果
          </h3>
          <div
            className={cn(
              "grid gap-4",
              currentResults.length === 2
                ? "grid-cols-2"
                : currentResults.length === 3
                ? "grid-cols-3"
                : "grid-cols-2 lg:grid-cols-4"
            )}
          >
            {currentResults.map((result) => (
              <GlassCard key={result.advisorId} variant="interactive">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100">
                    {result.advisorName}
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">
                      <Clock size={8} className="mr-0.5" />
                      {result.responseTime}ms
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">
                      <Hash size={8} className="mr-0.5" />
                      {result.tokenCount} tokens
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 mb-3 min-h-[120px]">
                  <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {result.output}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  disabled={selectingWinner}
                  onClick={() => handleSelectWinner(result.advisorId)}
                >
                  <Trophy size={12} className="mr-1 text-amber-500" />
                  选择最优
                </Button>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
            历史对比记录
          </h3>
          <div className="space-y-3">
            {history.map((test) => (
              <div
                key={test.id}
                className="p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 dark:text-gray-100 font-medium truncate">
                      {test.testInput}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(test.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  {test.selectedWinner && (
                    <Badge className="text-[9px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 shrink-0">
                      <Trophy size={8} className="mr-0.5" />
                      已选最优
                    </Badge>
                  )}
                </div>
                {test.results && (
                  <div className="flex flex-wrap gap-2">
                    {test.results.map((r) => (
                      <Badge
                        key={r.advisorId}
                        className={cn(
                          "text-[10px]",
                          r.advisorId === test.selectedWinner
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        )}
                      >
                        {r.advisorName}
                        {r.advisorId === test.selectedWinner && " (winner)"}
                        {" - "}
                        {r.responseTime}ms
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
