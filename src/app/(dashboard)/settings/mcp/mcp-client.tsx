"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Server,
  Trash2,
  Pencil,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
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
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createMcpServer,
  updateMcpServer,
  toggleMcpServer,
  deleteMcpServer,
  testMcpServer,
} from "@/app/actions/mcp-servers";
import type { mcpServers } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────

type McpServerRow = InferSelectModel<typeof mcpServers>;

// ── Helpers ──────────────────────────────────────────────────

function relativeTime(date: Date | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function parseHeadersJson(raw: string): Record<string, string> | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Form state ───────────────────────────────────────────────

interface McpFormState {
  name: string;
  url: string;
  headersJson: string;
  defaultToolClass: "read" | "write";
}

function defaultForm(): McpFormState {
  return {
    name: "",
    url: "",
    headersJson: "",
    defaultToolClass: "write",
  };
}

// ── Main Component ───────────────────────────────────────────

export function McpClient({
  initialServers,
}: {
  initialServers: McpServerRow[];
}) {
  const [servers, setServers] = useState<McpServerRow[]>(initialServers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<McpServerRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<McpServerRow | null>(null);
  const [form, setForm] = useState<McpFormState>(defaultForm());
  const [headersError, setHeadersError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Form helpers ───────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm());
    setHeadersError(null);
    setDialogOpen(true);
  }

  function openEdit(server: McpServerRow) {
    setEditTarget(server);
    setForm({
      name: server.name,
      url: server.url,
      headersJson: "",
      defaultToolClass: (server.defaultToolClass as "read" | "write") ?? "write",
    });
    setHeadersError(null);
    setDialogOpen(true);
  }

  function setField<K extends keyof McpFormState>(key: K, value: McpFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "headersJson") setHeadersError(null);
  }

  function validateHeaders(): Record<string, string> | null | undefined {
    // undefined = validation error occurred
    const raw = form.headersJson.trim();
    if (!raw) return null;
    const parsed = parseHeadersJson(raw);
    if (parsed === null) {
      setHeadersError("请输入合法的 JSON 对象，例如 {\"Authorization\": \"Bearer xxx\"}");
      return undefined;
    }
    return parsed;
  }

  // ── Submit ─────────────────────────────────────────────────

  function handleSubmit() {
    const headers = validateHeaders();
    if (headers === undefined) return; // validation failed

    startTransition(async () => {
      try {
        if (editTarget) {
          await updateMcpServer(editTarget.id, {
            name: form.name,
            url: form.url,
            headers: headers ?? undefined,
            defaultToolClass: form.defaultToolClass,
          });
          setServers((prev) =>
            prev.map((s) =>
              s.id === editTarget.id
                ? {
                    ...s,
                    name: form.name,
                    url: form.url,
                    defaultToolClass: form.defaultToolClass,
                  }
                : s
            )
          );
          toast.success("MCP 服务器配置已更新");
          setDialogOpen(false);
        } else {
          const result = await createMcpServer({
            name: form.name,
            url: form.url,
            headers: headers ?? undefined,
            defaultToolClass: form.defaultToolClass,
          });
          // optimistic insert — re-fetch via revalidatePath or use minimal stub
          const newRow: McpServerRow = {
            id: result.id,
            organizationId: "",
            name: form.name,
            slug: form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
            url: form.url,
            encryptedHeaders: null,
            defaultToolClass: form.defaultToolClass,
            connectTimeoutMs: 8000,
            enabled: 1,
            lastConnectedAt: null,
            lastError: null,
            toolCount: 0,
            createdAt: new Date(),
          };
          setServers((prev) => [newRow, ...prev]);
          toast.success("MCP 服务器已添加");
          setDialogOpen(false);
        }
      } catch (err) {
        toast.error((err as Error).message ?? "操作失败");
      }
    });
  }

  // ── Toggle ─────────────────────────────────────────────────

  function handleToggle(server: McpServerRow, enabled: boolean) {
    startTransition(async () => {
      try {
        await toggleMcpServer(server.id, enabled);
        setServers((prev) =>
          prev.map((s) => (s.id === server.id ? { ...s, enabled: enabled ? 1 : 0 } : s))
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
        await deleteMcpServer(id);
        setServers((prev) => prev.filter((s) => s.id !== id));
        toast.success("MCP 服务器已删除");
      } catch (err) {
        toast.error((err as Error).message ?? "删除失败");
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  // ── Test connection ────────────────────────────────────────

  async function handleTest(server: McpServerRow) {
    if (testingId) return;
    setTestingId(server.id);
    try {
      const res = await testMcpServer(server.id);
      if (res.ok) {
        toast.success("连接成功");
        setServers((prev) =>
          prev.map((s) =>
            s.id === server.id ? { ...s, lastConnectedAt: new Date(), lastError: null } : s
          )
        );
      } else {
        toast.error(res.error ?? "连接失败");
        setServers((prev) =>
          prev.map((s) =>
            s.id === server.id ? { ...s, lastError: res.error ?? "连接失败" } : s
          )
        );
      }
    } catch (err) {
      toast.error((err as Error).message ?? "测试失败");
    } finally {
      setTestingId(null);
    }
  }

  // ── Table columns ──────────────────────────────────────────

  const columns = [
    {
      key: "name",
      header: "名称",
      render: (row: McpServerRow) => (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{row.name}</span>
          <span className="text-xs text-muted-foreground font-mono truncate">{row.url}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      width: "w-24",
      render: (row: McpServerRow) => (
        <div className="flex items-center gap-1.5">
          {row.enabled ? (
            <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold px-2 py-0.5">
              启用
            </Badge>
          ) : (
            <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-semibold px-2 py-0.5">
              停用
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "toolClass",
      header: "工具类型",
      width: "w-24",
      render: (row: McpServerRow) => (
        <span className="text-xs text-muted-foreground">
          {row.defaultToolClass === "read" ? "只读" : "读写"}
        </span>
      ),
    },
    {
      key: "toolCount",
      header: "工具数",
      width: "w-20",
      align: "right" as const,
      render: (row: McpServerRow) => (
        <span className="text-sm tabular-nums text-muted-foreground">{row.toolCount}</span>
      ),
    },
    {
      key: "lastConnected",
      header: "最近连接",
      width: "120px",
      render: (row: McpServerRow) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {row.lastConnectedAt ? (
              <>
                <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                {relativeTime(row.lastConnectedAt)}
              </>
            ) : row.lastError ? (
              <>
                <XCircle size={11} className="text-destructive shrink-0" />
                <span className="truncate max-w-[90px]" title={row.lastError}>
                  {row.lastError}
                </span>
              </>
            ) : (
              <>
                <Clock size={11} className="shrink-0" />
                未测试
              </>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-40",
      align: "right" as const,
      render: (row: McpServerRow) => (
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
            onClick={() => handleTest(row)}
            disabled={testingId === row.id}
            title="测试连接"
          >
            {testingId === row.id ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Zap size={12} />
            )}
            测连
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

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title="MCP 服务器"
        description="管理外部 MCP（Model Context Protocol）服务器，让 AI 员工使用第三方工具能力"
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus size={15} />
            添加服务器
          </Button>
        }
      />

      {servers.length === 0 ? (
        <GlassCard className="p-16 text-center">
          <Server size={40} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">暂无 MCP 服务器配置</p>
          <Button variant="ghost" onClick={openCreate} className="mt-4 gap-2">
            <Plus size={14} />
            添加第一个服务器
          </Button>
        </GlassCard>
      ) : (
        <DataTable
          rows={servers}
          rowKey={(row) => row.id}
          columns={columns}
          emptyMessage={
            <div className="flex flex-col items-center gap-2 py-8">
              <Server size={32} className="text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">暂无 MCP 服务器</p>
            </div>
          }
        />
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "编辑 MCP 服务器" : "添加 MCP 服务器"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="mcp-name">服务器名称</Label>
              <Input
                id="mcp-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="例如：GitHub MCP"
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="mcp-url">服务器 URL</Label>
              <Input
                id="mcp-url"
                value={form.url}
                onChange={(e) => setField("url", e.target.value)}
                placeholder="https://mcp.example.com/sse"
              />
              <p className="text-xs text-muted-foreground">支持 HTTP/HTTPS MCP 端点（SSE 或 Streamable HTTP）</p>
            </div>

            {/* Headers */}
            <div className="space-y-2">
              <Label htmlFor="mcp-headers">
                请求头
                <span className="ml-1 text-muted-foreground font-normal text-xs">（可选，JSON 格式）</span>
              </Label>
              <Textarea
                id="mcp-headers"
                value={form.headersJson}
                onChange={(e) => setField("headersJson", e.target.value)}
                placeholder={'{\n  "Authorization": "Bearer your-token"\n}'}
                className="font-mono text-xs h-[100px]"
              />
              {headersError && (
                <p className="text-xs text-destructive">{headersError}</p>
              )}
              {editTarget && (
                <p className="text-xs text-muted-foreground">
                  留空则保留现有请求头；填写则替换为新值
                </p>
              )}
            </div>

            {/* Default tool class */}
            <div className="space-y-2">
              <Label htmlFor="mcp-toolclass">工具权限类型</Label>
              <Select
                value={form.defaultToolClass}
                onValueChange={(v) => setField("defaultToolClass", v as "read" | "write")}
              >
                <SelectTrigger id="mcp-toolclass">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="write">读写（write）— 允许执行写操作</SelectItem>
                  <SelectItem value="read">只读（read）— 仅允许查询操作</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">决定 AI 员工可调用该服务器上的哪类工具</p>
            </div>

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
                disabled={isPending || !form.name.trim() || !form.url.trim()}
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {editTarget ? "保存修改" : "添加服务器"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除 MCP 服务器？"
        description={`将永久删除「${deleteTarget?.name ?? ""}」的配置，此操作不可撤销。`}
        confirmText="确认删除"
        variant="danger"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
