"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Terminal,
  Trash2,
  Pencil,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createCliTool,
  updateCliTool,
  toggleCliTool,
  deleteCliTool,
  testRunCliTool,
} from "@/app/actions/cli-tools";
import type { cliTools, cliToolRuns } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────

type CliToolRow = InferSelectModel<typeof cliTools>;
type CliToolRunRow = InferSelectModel<typeof cliToolRuns>;

// ── Helpers ──────────────────────────────────────────────────

function relativeTime(date: Date | string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function executionModeLabel(mode: string) {
  return mode === "sync" ? "同步" : "异步";
}

function toolClassLabel(cls: string) {
  return cls === "read" ? "只读" : "读写";
}

function runStatusLabel(status: string) {
  switch (status) {
    case "done":
      return { text: "成功", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
    case "failed":
      return { text: "失败", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
    case "processing":
      return { text: "执行中", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
    default:
      return { text: "排队", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
  }
}

const DEFAULT_ARGS_SCHEMA = JSON.stringify({ input: { type: "asset", required: true } }, null, 2);
const DEFAULT_ARGV_TEMPLATE = JSON.stringify([{ param: "input" }, { output: "out" }], null, 2);

// ── Form state ───────────────────────────────────────────────

interface CliFormState {
  name: string;
  description: string;
  command: string;
  argsSchemaJson: string;
  argvTemplateJson: string;
  executionMode: "sync" | "async";
  toolClass: "read" | "write";
  syncTimeoutMs: string;
}

function defaultForm(): CliFormState {
  return {
    name: "",
    description: "",
    command: "",
    argsSchemaJson: DEFAULT_ARGS_SCHEMA,
    argvTemplateJson: DEFAULT_ARGV_TEMPLATE,
    executionMode: "sync",
    toolClass: "write",
    syncTimeoutMs: "20000",
  };
}

function formFromRow(row: CliToolRow): CliFormState {
  return {
    name: row.name,
    description: row.description,
    command: row.command,
    argsSchemaJson: JSON.stringify(row.argsSchema, null, 2),
    argvTemplateJson: JSON.stringify(row.argvTemplate, null, 2),
    executionMode: (row.executionMode as "sync" | "async") ?? "sync",
    toolClass: (row.toolClass as "read" | "write") ?? "write",
    syncTimeoutMs: String(row.syncTimeoutMs ?? 20000),
  };
}

// ── Main Component ───────────────────────────────────────────

export function CliToolsClient({
  initialTools,
  initialRuns,
  allowedBinaries,
}: {
  initialTools: CliToolRow[];
  initialRuns: CliToolRunRow[];
  allowedBinaries: string[];
}) {
  const [tools, setTools] = useState<CliToolRow[]>(initialTools);
  const [runs, setRuns] = useState<CliToolRunRow[]>(initialRuns);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CliToolRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CliToolRow | null>(null);
  const [form, setForm] = useState<CliFormState>(defaultForm());
  const [jsonErrors, setJsonErrors] = useState<{ argsSchema?: string; argvTemplate?: string }>({});
  const [isPending, startTransition] = useTransition();

  // Test-run state
  const [testTarget, setTestTarget] = useState<CliToolRow | null>(null);
  const [testParamsJson, setTestParamsJson] = useState("{}");
  const [testParamsError, setTestParamsError] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    assetId?: string;
    publicUrl?: string;
    error?: string;
    stderrTail?: string;
  } | null>(null);

  // Runs panel collapsed state
  const [runsCollapsed, setRunsCollapsed] = useState(false);

  // ── Form helpers ───────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm());
    setJsonErrors({});
    setDialogOpen(true);
  }

  function openEdit(tool: CliToolRow) {
    setEditTarget(tool);
    setForm(formFromRow(tool));
    setJsonErrors({});
    setDialogOpen(true);
  }

  function openTestRun(tool: CliToolRow) {
    setTestTarget(tool);
    setTestParamsJson("{}");
    setTestParamsError(null);
    setTestResult(null);
  }

  function setField<K extends keyof CliFormState>(key: K, value: CliFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "argsSchemaJson") setJsonErrors((e) => ({ ...e, argsSchema: undefined }));
    if (key === "argvTemplateJson") setJsonErrors((e) => ({ ...e, argvTemplate: undefined }));
  }

  function validateJsonFields(): boolean {
    const errors: typeof jsonErrors = {};
    try {
      const parsed = JSON.parse(form.argsSchemaJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        errors.argsSchema = "必须是 JSON 对象";
      }
    } catch {
      errors.argsSchema = "JSON 格式错误";
    }
    try {
      const parsed = JSON.parse(form.argvTemplateJson);
      if (!Array.isArray(parsed)) {
        errors.argvTemplate = "必须是 JSON 数组";
      }
    } catch {
      errors.argvTemplate = "JSON 格式错误";
    }
    setJsonErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────

  function handleSubmit() {
    if (!validateJsonFields()) return;

    startTransition(async () => {
      try {
        const timeoutMs = parseInt(form.syncTimeoutMs, 10) || 20000;

        if (editTarget) {
          const result = await updateCliTool(editTarget.id, {
            name: form.name,
            description: form.description,
            command: form.command,
            argsSchemaJson: form.argsSchemaJson,
            argvTemplateJson: form.argvTemplateJson,
            executionMode: form.executionMode,
            toolClass: form.toolClass,
            syncTimeoutMs: timeoutMs,
          });
          setTools((prev) =>
            prev.map((t) =>
              t.id === editTarget.id
                ? {
                    ...t,
                    name: form.name,
                    description: form.description,
                    command: form.command,
                    argsSchema: JSON.parse(form.argsSchemaJson),
                    argvTemplate: JSON.parse(form.argvTemplateJson),
                    executionMode: form.executionMode,
                    toolClass: form.toolClass,
                    syncTimeoutMs: timeoutMs,
                  }
                : t
            )
          );
          toast.success("CLI 工具已更新");
          if (result.probeWarning) {
            toast.warning(`注意：${result.probeWarning}`);
          }
          setDialogOpen(false);
        } else {
          const result = await createCliTool({
            name: form.name,
            description: form.description,
            command: form.command,
            argsSchemaJson: form.argsSchemaJson,
            argvTemplateJson: form.argvTemplateJson,
            executionMode: form.executionMode,
            toolClass: form.toolClass,
            syncTimeoutMs: timeoutMs,
          });
          const newRow: CliToolRow = {
            id: result.id,
            organizationId: "",
            name: form.name,
            description: form.description,
            slug: form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
            command: form.command,
            argsSchema: JSON.parse(form.argsSchemaJson),
            argvTemplate: JSON.parse(form.argvTemplateJson),
            executionMode: form.executionMode,
            toolClass: form.toolClass,
            syncTimeoutMs: timeoutMs,
            outputKind: "media_asset",
            enabled: 1,
            createdAt: new Date(),
          };
          setTools((prev) => [newRow, ...prev]);
          toast.success("CLI 工具已添加");
          if (result.probeWarning) {
            toast.warning(`注意：${result.probeWarning}，binary 可能未安装，稍后再注册也可`);
          }
          setDialogOpen(false);
        }
      } catch (err) {
        toast.error((err as Error).message ?? "操作失败");
      }
    });
  }

  // ── Toggle ─────────────────────────────────────────────────

  function handleToggle(tool: CliToolRow, enabled: boolean) {
    startTransition(async () => {
      try {
        await toggleCliTool(tool.id, enabled);
        setTools((prev) =>
          prev.map((t) => (t.id === tool.id ? { ...t, enabled: enabled ? 1 : 0 } : t))
        );
        toast.success(enabled ? "已启用" : "已停用");
      } catch (err) {
        toast.error((err as Error).message ?? "操作失败");
      }
    });
  }

  // ── Delete ─────────────────────────────────────────────────

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      try {
        await deleteCliTool(id);
        setTools((prev) => prev.filter((t) => t.id !== id));
        toast.success("CLI 工具已删除");
      } catch (err) {
        toast.error((err as Error).message ?? "删除失败");
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  // ── Test run ──────────────────────────────────────────────

  async function handleTestRun() {
    if (!testTarget || testRunning) return;

    // Validate params JSON
    try {
      const parsed = JSON.parse(testParamsJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setTestParamsError("参数必须是 JSON 对象");
        return;
      }
    } catch {
      setTestParamsError("JSON 格式错误");
      return;
    }
    setTestParamsError(null);
    setTestResult(null);
    setTestRunning(true);

    try {
      const params = JSON.parse(testParamsJson) as Record<string, unknown>;
      const result = await testRunCliTool(testTarget.id, params);
      setTestResult(result);
      // Update runs list with any new run (reload via optimistic — result will show below)
    } catch (err) {
      setTestResult({ ok: false, error: (err as Error).message });
    } finally {
      setTestRunning(false);
    }
  }

  // ── Table columns ──────────────────────────────────────────

  const columns = [
    {
      key: "name",
      header: "名称",
      render: (row: CliToolRow) => (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{row.name}</span>
          <span className="text-xs text-muted-foreground truncate">{row.description}</span>
        </div>
      ),
    },
    {
      key: "command",
      header: "命令",
      width: "w-28",
      render: (row: CliToolRow) => (
        <span className="text-xs font-mono text-muted-foreground">{row.command}</span>
      ),
    },
    {
      key: "executionMode",
      header: "执行模式",
      width: "w-20",
      render: (row: CliToolRow) => (
        <span className="text-xs text-muted-foreground">{executionModeLabel(row.executionMode)}</span>
      ),
    },
    {
      key: "toolClass",
      header: "权限",
      width: "w-16",
      render: (row: CliToolRow) => (
        <span className="text-xs text-muted-foreground">{toolClassLabel(row.toolClass)}</span>
      ),
    },
    {
      key: "status",
      header: "状态",
      width: "w-20",
      render: (row: CliToolRow) => (
        row.enabled ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold px-2 py-0.5">
            启用
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-semibold px-2 py-0.5">
            停用
          </span>
        )
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-44",
      align: "right" as const,
      render: (row: CliToolRow) => (
        <div className="flex items-center justify-end gap-1">
          <Switch
            checked={row.enabled === 1}
            onCheckedChange={(checked) => handleToggle(row, checked)}
            className="scale-75"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => openTestRun(row)}
            title="测试运行"
          >
            <Play size={12} />
            测试
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openEdit(row)}
            title="编辑"
          >
            <Pencil size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(row)}
            title="删除"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ),
    },
  ];

  // ── Runs table columns ─────────────────────────────────────

  const runColumns = [
    {
      key: "tool",
      header: "工具",
      render: (row: CliToolRunRow) => {
        const tool = tools.find((t) => t.id === row.cliToolId);
        return (
          <span className="text-xs text-muted-foreground">{tool?.name ?? row.cliToolId.slice(0, 8)}</span>
        );
      },
    },
    {
      key: "status",
      header: "状态",
      width: "w-20",
      render: (row: CliToolRunRow) => {
        const { text, color } = runStatusLabel(row.status);
        return (
          <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${color}`}>
            {text}
          </span>
        );
      },
    },
    {
      key: "exitCode",
      header: "退出码",
      width: "w-20",
      align: "right" as const,
      render: (row: CliToolRunRow) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {row.exitCode !== null ? row.exitCode : "—"}
        </span>
      ),
    },
    {
      key: "error",
      header: "错误",
      render: (row: CliToolRunRow) => (
        <span className="text-xs text-destructive truncate max-w-[200px]" title={row.errorMessage ?? undefined}>
          {row.errorMessage ?? "—"}
        </span>
      ),
    },
    {
      key: "time",
      header: "时间",
      width: "100px",
      render: (row: CliToolRunRow) => (
        <span className="text-xs text-muted-foreground">{relativeTime(row.createdAt)}</span>
      ),
    },
  ];

  const isFormValid =
    form.name.trim() &&
    form.description.trim() &&
    form.command;

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <PageHeader
        title="CLI 工具"
        description="管理外部 CLI 工具，让 AI 员工调用本地命令行程序处理媒体资产"
        actions={
          <Button onClick={openCreate} className="gap-2" disabled={allowedBinaries.length === 0}>
            <Plus size={15} />
            注册工具
          </Button>
        }
      />

      {allowedBinaries.length === 0 && (
        <GlassCard className="p-4 border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            未配置允许的 CLI 命令。请在环境变量 <code className="font-mono text-xs">CLI_ALLOWED_BINARIES</code> 中设置允许的 binary 列表（逗号分隔），例如 <code className="font-mono text-xs">ffmpeg,yt-dlp</code>。
          </p>
        </GlassCard>
      )}

      {/* ── 工具列表 ── */}
      {tools.length === 0 ? (
        <GlassCard className="p-16 text-center">
          <Terminal size={40} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">暂无 CLI 工具配置</p>
          {allowedBinaries.length > 0 && (
            <Button variant="ghost" onClick={openCreate} className="mt-4 gap-2">
              <Plus size={14} />
              注册第一个工具
            </Button>
          )}
        </GlassCard>
      ) : (
        <DataTable
          rows={tools}
          rowKey={(row) => row.id}
          columns={columns}
          emptyMessage={
            <div className="flex flex-col items-center gap-2 py-8">
              <Terminal size={32} className="text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">暂无 CLI 工具</p>
            </div>
          }
        />
      )}

      {/* ── 执行记录 ── */}
      <GlassCard className="overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          className="w-full flex items-center justify-between px-4 py-3 h-auto text-sm font-medium"
          onClick={() => setRunsCollapsed((c) => !c)}
        >
          <span>执行记录（最近 {runs.length} 条）</span>
          {runsCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </Button>
        {!runsCollapsed && (
          <div className="border-t border-border">
            {runs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <Clock size={28} className="text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">暂无执行记录</p>
              </div>
            ) : (
              <DataTable
                rows={runs}
                rowKey={(row) => row.id}
                columns={runColumns}
              />
            )}
          </div>
        )}
      </GlassCard>

      {/* ── 创建 / 编辑 Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "编辑 CLI 工具" : "注册 CLI 工具"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="cli-name">工具名称</Label>
              <Input
                id="cli-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="例如：FFmpeg 视频转码"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="cli-desc">工具描述</Label>
              <Input
                id="cli-desc"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="简要说明工具用途，AI 员工将看到此描述"
              />
            </div>

            {/* Command */}
            <div className="space-y-2">
              <Label htmlFor="cli-command">命令</Label>
              <Select
                value={form.command}
                onValueChange={(v) => setField("command", v)}
              >
                <SelectTrigger id="cli-command">
                  <SelectValue placeholder="选择允许的命令" />
                </SelectTrigger>
                <SelectContent>
                  {allowedBinaries.map((bin) => (
                    <SelectItem key={bin} value={bin}>
                      <span className="font-mono text-xs">{bin}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                仅列出 <code className="font-mono text-[11px]">CLI_ALLOWED_BINARIES</code> 中配置的 binary
              </p>
            </div>

            {/* Args Schema */}
            <div className="space-y-2">
              <Label htmlFor="cli-args-schema">参数 Schema（JSON 对象）</Label>
              <Textarea
                id="cli-args-schema"
                value={form.argsSchemaJson}
                onChange={(e) => setField("argsSchemaJson", e.target.value)}
                className="font-mono text-xs h-[120px]"
                placeholder='{"input": {"type": "asset", "required": true}}'
              />
              {jsonErrors.argsSchema && (
                <p className="text-xs text-destructive">{jsonErrors.argsSchema}</p>
              )}
              <p className="text-xs text-muted-foreground">
                字段类型：string / number / enum / asset
              </p>
            </div>

            {/* Argv Template */}
            <div className="space-y-2">
              <Label htmlFor="cli-argv-template">Argv 模板（JSON 数组）</Label>
              <Textarea
                id="cli-argv-template"
                value={form.argvTemplateJson}
                onChange={(e) => setField("argvTemplateJson", e.target.value)}
                className="font-mono text-xs h-[100px]"
                placeholder='["-i", {"param": "input"}, {"output": "out"}]'
              />
              {jsonErrors.argvTemplate && (
                <p className="text-xs text-destructive">{jsonErrors.argvTemplate}</p>
              )}
              <p className="text-xs text-muted-foreground">
                字面量字符串 / {`{"param":"字段名"}`} / {`{"output":"扩展名"}`}
              </p>
            </div>

            {/* Execution mode + Tool class row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cli-exec-mode">执行模式</Label>
                <Select
                  value={form.executionMode}
                  onValueChange={(v) => setField("executionMode", v as "sync" | "async")}
                >
                  <SelectTrigger id="cli-exec-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sync">同步（sync）</SelectItem>
                    <SelectItem value="async">异步（async）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cli-tool-class">权限类型</Label>
                <Select
                  value={form.toolClass}
                  onValueChange={(v) => setField("toolClass", v as "read" | "write")}
                >
                  <SelectTrigger id="cli-tool-class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="write">读写（write）</SelectItem>
                    <SelectItem value="read">只读（read）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Timeout (only relevant for sync) */}
            {form.executionMode === "sync" && (
              <div className="space-y-2">
                <Label htmlFor="cli-timeout">同步超时（毫秒）</Label>
                <Input
                  id="cli-timeout"
                  type="number"
                  value={form.syncTimeoutMs}
                  onChange={(e) => setField("syncTimeoutMs", e.target.value)}
                  placeholder="20000"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={isPending || !isFormValid}
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {editTarget ? "保存修改" : "注册工具"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 测试运行 Dialog ── */}
      <Dialog
        open={!!testTarget}
        onOpenChange={(open) => {
          if (!open) {
            setTestTarget(null);
            setTestResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>测试运行：{testTarget?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="test-params">参数（JSON 对象）</Label>
              <Textarea
                id="test-params"
                value={testParamsJson}
                onChange={(e) => {
                  setTestParamsJson(e.target.value);
                  setTestParamsError(null);
                }}
                className="font-mono text-xs h-[100px]"
                placeholder='{"input": "asset-uuid-here"}'
              />
              {testParamsError && (
                <p className="text-xs text-destructive">{testParamsError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                asset 类型字段传入媒体资产 ID（UUID）
              </p>
            </div>

            {/* Result panel */}
            {testResult && (
              <div className="rounded-lg border border-border p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  {testResult.ok ? (
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-destructive shrink-0" />
                  )}
                  <span className="text-sm font-medium">
                    {testResult.ok ? "执行成功" : "执行失败"}
                  </span>
                </div>
                {testResult.assetId && (
                  <p className="text-xs text-muted-foreground font-mono">
                    输出资产 ID：{testResult.assetId}
                  </p>
                )}
                {testResult.publicUrl && (
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    公开 URL：{testResult.publicUrl}
                  </p>
                )}
                {testResult.error && (
                  <p className="text-xs text-destructive">{testResult.error}</p>
                )}
                {testResult.stderrTail && (
                  <pre className="text-[10px] font-mono bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-[80px] overflow-y-auto">
                    {testResult.stderrTail}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setTestTarget(null);
                  setTestResult(null);
                }}
                disabled={testRunning}
              >
                关闭
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleTestRun}
                disabled={testRunning}
              >
                {testRunning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                {testRunning ? "执行中..." : "运行测试"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除 CLI 工具？"
        description={`将永久删除「${deleteTarget?.name ?? ""}」的配置，此操作不可撤销。`}
        confirmText="确认删除"
        variant="danger"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
