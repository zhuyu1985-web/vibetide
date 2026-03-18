"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  Info,
  FlaskConical,
} from "lucide-react";
import { testSkillExecution } from "@/app/actions/employee-advanced";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/types";

interface SkillTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skills: Skill[];
}

interface TestResult {
  skillName: string;
  skillCategory: string;
  skillVersion: string;
  description: string;
  testInput: string;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  runtimeInfo: {
    type: string;
    estimatedLatency: string;
    maxConcurrency: number;
    modelDependency: string;
  };
  expectedBehavior: string;
  executionResult?: {
    success: boolean;
    output?: string;
    error?: string;
    durationMs: number;
  };
  validationChecks: {
    check: string;
    status: string;
    detail: string;
  }[];
}

const statusIcons: Record<string, React.ReactNode> = {
  pass: <CheckCircle size={12} className="text-green-500" />,
  fail: <XCircle size={12} className="text-red-500" />,
  info: <Info size={12} className="text-blue-500" />,
};

export function SkillTestDialog({
  open,
  onOpenChange,
  skills,
}: SkillTestDialogProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [testInput, setTestInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!selectedSkillId || !testInput.trim()) return;
    setTesting(true);
    setResult(null);
    setError(null);
    try {
      const res = await testSkillExecution(selectedSkillId, testInput);
      setResult(res as TestResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setResult(null);
      setSelectedSkillId("");
      setTestInput("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-panel sm:max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical size={18} className="text-purple-500" />
            技能在线测试
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
            选择技能并输入测试参数，查看技能的执行计划和预期行为
          </DialogDescription>
        </DialogHeader>

        {/* Skill selector */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              选择技能
            </label>
            <Select
              value={selectedSkillId}
              onValueChange={setSelectedSkillId}
            >
              <SelectTrigger className="glass-input">
                <SelectValue placeholder="请选择要测试的技能..." />
              </SelectTrigger>
              <SelectContent>
                {skills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name} (v{skill.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Test input */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              测试输入
            </label>
            <textarea
              className={cn(
                "w-full min-h-[80px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 px-3 py-2",
                "text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200",
                "resize-none"
              )}
              placeholder="输入测试参数或文本内容..."
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
            />
          </div>

          {/* Run test button */}
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={handleTest}
            disabled={!selectedSkillId || !testInput.trim() || testing}
          >
            {testing ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Play size={14} className="mr-1" />
            )}
            {testing ? "分析中..." : "测试"}
          </Button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
            <div className="flex items-center gap-2 mb-1 font-medium">
              <XCircle size={14} />
              测试失败
            </div>
            <p className="text-xs">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="flex-1 overflow-y-auto space-y-3 mt-2 pr-1">
            {/* Skill info */}
            <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/25 border border-purple-100/50 dark:border-purple-800/30">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {result.skillName}
                </h4>
                <Badge variant="outline" className="text-[10px]">
                  v{result.skillVersion}
                </Badge>
                <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px]">
                  {result.skillCategory}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{result.description}</p>
            </div>

            {/* Runtime info */}
            <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/25 border border-blue-100/50 dark:border-blue-800/30">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                运行时信息
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">执行类型</span>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    {result.runtimeInfo.type}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    预估延迟
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    {result.runtimeInfo.estimatedLatency}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    最大并发
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    {result.runtimeInfo.maxConcurrency}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    模型依赖
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    {result.runtimeInfo.modelDependency}
                  </p>
                </div>
              </div>
            </div>

            {/* Expected behavior */}
            <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/25 border border-green-100/50 dark:border-green-800/30">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                预期行为
              </h4>
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                {result.expectedBehavior}
              </pre>
            </div>

            {/* Execution result */}
            {result.executionResult && (
              <div className={`p-3 rounded-lg border ${
                result.executionResult.success
                  ? "bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-100/50 dark:border-emerald-800/30"
                  : "bg-red-50/50 dark:bg-red-950/25 border-red-100/50 dark:border-red-800/30"
              }`}>
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  执行结果 {result.executionResult.durationMs > 0 && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal">
                      ({result.executionResult.durationMs}ms)
                    </span>
                  )}
                </h4>
                {result.executionResult.success && result.executionResult.output ? (
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed max-h-[300px] overflow-y-auto">
                    {result.executionResult.output}
                  </pre>
                ) : result.executionResult.error ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {result.executionResult.error}
                  </p>
                ) : null}
              </div>
            )}

            {/* Validation checks */}
            <div className="p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/25 border border-gray-100/50 dark:border-gray-700/30">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                验证检查
              </h4>
              <div className="space-y-2">
                {result.validationChecks.map((check, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {statusIcons[check.status] || statusIcons.info}
                    <div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {check.check}
                      </span>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {check.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* I/O Schema */}
            {(Object.keys(result.inputSchema).length > 0 ||
              Object.keys(result.outputSchema).length > 0) && (
              <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/25 border border-amber-100/50 dark:border-amber-800/30">
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  输入/输出模式
                </h4>
                {Object.keys(result.inputSchema).length > 0 && (
                  <div className="mb-2">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      输入字段
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(result.inputSchema).map(
                        ([key, type]) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {key}: {type}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}
                {Object.keys(result.outputSchema).length > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      输出字段
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(result.outputSchema).map(
                        ([key, type]) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="text-[10px] border-green-200 dark:border-green-700/50 text-green-700 dark:text-green-400"
                          >
                            {key}: {type}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
