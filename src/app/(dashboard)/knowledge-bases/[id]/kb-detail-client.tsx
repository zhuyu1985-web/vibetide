"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  FileText,
  Globe,
  Upload,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Database,
  Users,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  addKnowledgeItem,
  crawlUrlIntoKB,
  deleteKnowledgeItem,
  reindexKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
} from "@/app/actions/knowledge-bases";
import type {
  KBDetail,
  KBItemListResult,
  KBSyncLogRow,
  KBBindingRow,
  KBVectorizationStatus,
} from "@/lib/types";

const KB_TYPE_LABELS: Record<string, string> = {
  general: "通用",
  channel_style: "频道风格",
  sensitive_topics: "敏感话题",
  domain_specific: "领域专业",
};

const STATUS_LABELS: Record<KBVectorizationStatus, { label: string; color: string }> = {
  pending: { label: "待向量化", color: "text-gray-500 dark:text-white/50" },
  processing: { label: "向量化中", color: "text-blue-500 dark:text-blue-400" },
  done: { label: "已就绪", color: "text-emerald-500 dark:text-emerald-400" },
  failed: { label: "失败", color: "text-red-500 dark:text-red-400" },
};

interface Props {
  kb: KBDetail;
  initialItems: KBItemListResult;
  bindings: KBBindingRow[];
  syncLogs: KBSyncLogRow[];
}

export function KBDetailClient({ kb, initialItems, bindings, syncLogs }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("documents");

  // Derive directly from props (no local state sync needed — server re-renders pass new kb)
  const currentStatus = kb.vectorizationStatus;
  const chunkCount = kb.chunkCount;

  // Poll status while processing/pending — just refresh the server component, no local setState
  useEffect(() => {
    if (currentStatus !== "processing" && currentStatus !== "pending") return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [currentStatus, router]);

  const statusCfg = STATUS_LABELS[currentStatus];
  const StatusIcon =
    currentStatus === "done"
      ? CheckCircle2
      : currentStatus === "failed"
      ? AlertTriangle
      : currentStatus === "processing"
      ? Sparkles
      : Clock;

  return (
    <div className="max-w-[1200px] mx-auto px-1">
      {/* ── Header ── */}
      <div className="mb-6">
        <Link
          href="/knowledge-bases"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          返回知识库列表
        </Link>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-foreground">{kb.name}</h1>
              <Badge variant="outline" className="text-[10px]">
                {KB_TYPE_LABELS[kb.type] || kb.type}
              </Badge>
              <div className={`flex items-center gap-1 text-xs ${statusCfg.color}`}>
                <StatusIcon
                  className={`w-3.5 h-3.5 ${
                    currentStatus === "processing" ? "animate-pulse" : ""
                  }`}
                />
                <span>{statusCfg.label}</span>
              </div>
            </div>
            {kb.description && (
              <p className="text-sm text-muted-foreground mb-2">{kb.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
              <span>{kb.documentCount} 文档</span>
              <span>·</span>
              <span>{chunkCount} chunks</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {kb.boundEmployeeCount} 名员工已绑定
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 bg-transparent border-0 p-0 h-auto gap-2">
          <TabsTrigger value="documents" className="border-0 data-[state=active]:bg-accent">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            文档 ({initialItems.total})
          </TabsTrigger>
          <TabsTrigger value="bindings" className="border-0 data-[state=active]:bg-accent">
            <Users className="w-3.5 h-3.5 mr-1.5" />
            绑定员工 ({bindings.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="border-0 data-[state=active]:bg-accent">
            <ScrollText className="w-3.5 h-3.5 mr-1.5" />
            同步日志
          </TabsTrigger>
          <TabsTrigger value="settings" className="border-0 data-[state=active]:bg-accent">
            <SettingsIcon className="w-3.5 h-3.5 mr-1.5" />
            设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentsTab kbId={kb.id} initialItems={initialItems} />
        </TabsContent>

        <TabsContent value="bindings">
          <BindingsTab bindings={bindings} />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab syncLogs={syncLogs} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab kb={kb} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents Tab
// ---------------------------------------------------------------------------

function DocumentsTab({
  kbId,
  initialItems,
}: {
  kbId: string;
  initialItems: KBItemListResult;
}) {
  const router = useRouter();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteKnowledgeItem(id);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          共 {initialItems.total} 个 chunks
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="border-0">
              <Plus className="w-4 h-4 mr-1.5" />
              添加文档
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setPasteOpen(true)}>
              <FileText className="w-4 h-4 mr-2" />
              粘贴文本
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              上传 .md / .txt 文件
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setUrlOpen(true)}>
              <Globe className="w-4 h-4 mr-2" />
              URL 爬取
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {initialItems.items.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-xl p-10 text-center">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            还没有文档，点击上方按钮添加第一份内容
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialItems.items.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-3 flex items-start gap-3 hover:border-border/80 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-foreground truncate">
                    {item.title || `Chunk #${item.chunkIndex}`}
                  </h4>
                  {item.hasEmbedding ? (
                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      已向量化
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-white/40 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      待向量化
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                  {item.snippet}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                  {item.sourceDocument && <span>来源：{item.sourceDocument}</span>}
                  {item.tags.length > 0 && (
                    <span>标签：{item.tags.join(", ")}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="border-0 text-muted-foreground hover:text-red-500"
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
              >
                {deletingId === item.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <PasteDialog
        kbId={kbId}
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onSuccess={() => router.refresh()}
      />
      <UploadDialog
        kbId={kbId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => router.refresh()}
      />
      <UrlDialog
        kbId={kbId}
        open={urlOpen}
        onOpenChange={setUrlOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bindings Tab
// ---------------------------------------------------------------------------

function BindingsTab({ bindings }: { bindings: KBBindingRow[] }) {
  if (bindings.length === 0) {
    return (
      <div className="bg-card border border-border border-dashed rounded-xl p-10 text-center">
        <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          还没有 AI 员工绑定此知识库
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          前往员工资料页的「知识库」Tab 完成绑定
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bindings.map((b) => (
        <Link
          key={b.employeeDbId}
          href={`/employee/${b.employeeSlug}`}
          className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:border-border/80 transition-colors block"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {b.employeeNickname}
              </span>
              <span className="text-xs text-muted-foreground">{b.employeeName}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sync Logs Tab
// ---------------------------------------------------------------------------

function LogsTab({ syncLogs }: { syncLogs: KBSyncLogRow[] }) {
  if (syncLogs.length === 0) {
    return (
      <div className="bg-card border border-border border-dashed rounded-xl p-10 text-center">
        <ScrollText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">暂无同步日志</p>
      </div>
    );
  }

  const statusColors = {
    success: "text-emerald-500",
    error: "text-red-500",
    warning: "text-amber-500",
  };

  return (
    <div className="space-y-2">
      {syncLogs.map((log) => (
        <div
          key={log.id}
          className="bg-card border border-border rounded-xl p-3 flex items-start gap-3"
        >
          <div className={`text-xs font-medium ${statusColors[log.status]} shrink-0 w-12`}>
            {log.status === "success" ? "成功" : log.status === "error" ? "失败" : "警告"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium text-foreground">{log.action}</span>
              <span className="text-[10px] text-muted-foreground/60">
                {new Date(log.createdAt).toLocaleString("zh-CN")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{log.detail}</p>
            {(log.documentsProcessed > 0 || log.chunksGenerated > 0) && (
              <div className="text-[10px] text-muted-foreground/60 mt-1">
                文档 {log.documentsProcessed} · chunks {log.chunksGenerated}
                {log.errorsCount > 0 && ` · 错误 ${log.errorsCount}`}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Tab
// ---------------------------------------------------------------------------

function SettingsTab({ kb }: { kb: KBDetail }) {
  const router = useRouter();
  const [name, setName] = useState(kb.name);
  const [description, setDescription] = useState(kb.description);
  const [type, setType] = useState(kb.type);
  const [reindexOpen, setReindexOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reindexing, setReindexing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateKnowledgeBase(kb.id, { name, description, type });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "保存失败");
      }
    });
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await reindexKnowledgeBase(kb.id);
      setReindexOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重建失败");
    } finally {
      setReindexing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteKnowledgeBase(kb.id);
      router.push("/knowledge-bases");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[640px]">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground">基本信息</h3>
        <div className="space-y-2">
          <Label htmlFor="edit-name">名称</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-desc">描述</Label>
          <Textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-type">类型</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="edit-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">通用</SelectItem>
              <SelectItem value="channel_style">频道风格</SelectItem>
              <SelectItem value="sensitive_topics">敏感话题</SelectItem>
              <SelectItem value="domain_specific">领域专业</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={pending} className="border-0">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存修改"}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground">索引管理</h3>
        <p className="text-xs text-muted-foreground">
          重建索引会清空所有文档的现有向量并重新生成。适用于切换 embedding 模型或修复异常状态。
        </p>
        <Button
          variant="outline"
          onClick={() => setReindexOpen(true)}
          className="border-0 bg-accent"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          重建索引
        </Button>
      </div>

      <div className="bg-card border border-red-200 dark:border-red-900/40 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-red-600 dark:text-red-400">危险区</h3>
        <p className="text-xs text-muted-foreground">
          删除知识库会同时清理所有文档、向量和员工绑定关系。此操作不可恢复。
        </p>
        <Button
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          className="border-0 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60"
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          删除知识库
        </Button>
      </div>

      {/* Reindex confirm */}
      <AlertDialog open={reindexOpen} onOpenChange={setReindexOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重建索引？</AlertDialogTitle>
            <AlertDialogDescription>
              将清空 {kb.chunkCount} 个 chunks 的向量并重新生成。期间该知识库不可被检索。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-0">取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReindex} disabled={reindexing} className="border-0">
              {reindexing ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认重建"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除知识库？</AlertDialogTitle>
            <AlertDialogDescription>
              将同时删除 {kb.documentCount} 个文档、{kb.chunkCount} 个 chunks，
              并解除 {kb.boundEmployeeCount} 名员工的绑定。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-0">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="border-0 bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingestion Dialogs
// ---------------------------------------------------------------------------

function PasteDialog({
  kbId,
  open,
  onOpenChange,
  onSuccess,
}: {
  kbId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    if (!title.trim()) return setError("标题不能为空");
    if (content.trim().length < 10) return setError("内容太短（至少 10 字符）");

    startTransition(async () => {
      try {
        await addKnowledgeItem(kbId, { title, content });
        setTitle("");
        setContent("");
        onOpenChange(false);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "添加失败");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>粘贴文本</DialogTitle>
          <DialogDescription>
            直接粘贴一段文本作为新的文档。系统会自动按段落切分成 chunks。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="paste-title">标题</Label>
            <Input
              id="paste-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：品牌口吻指南 v2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paste-content">内容</Label>
            <Textarea
              id="paste-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="粘贴文本内容..."
              rows={10}
              className="font-mono text-xs"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="border-0"
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={pending} className="border-0">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  kbId,
  open,
  onOpenChange,
  onSuccess,
}: {
  kbId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const accepted: File[] = [];
    for (const f of Array.from(fileList)) {
      if (/\.(md|txt|markdown)$/i.test(f.name)) {
        accepted.push(f);
      }
    }
    if (accepted.length === 0) {
      setError("仅支持 .md / .txt / .markdown 文件");
      return;
    }
    setError(null);
    setFiles(accepted);
  };

  const handleSubmit = () => {
    if (files.length === 0) return setError("请先选择文件");
    setError(null);
    setProgress({ done: 0, total: files.length });

    startTransition(async () => {
      let done = 0;
      const errors: string[] = [];
      for (const file of files) {
        try {
          const text = await file.text();
          if (text.trim().length < 10) {
            errors.push(`${file.name}: 文件内容太短`);
          } else {
            await addKnowledgeItem(kbId, {
              title: file.name.replace(/\.[^.]+$/, ""),
              content: text,
              sourceDocument: file.name,
            });
          }
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : "失败"}`);
        }
        done++;
        setProgress({ done, total: files.length });
      }

      if (errors.length > 0) {
        setError(errors.join("\n"));
      } else {
        setFiles([]);
        setProgress(null);
        onOpenChange(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>上传文件</DialogTitle>
          <DialogDescription>
            支持 .md / .txt / .markdown 文件，可一次选择多个。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.markdown"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-dashed h-24 flex flex-col gap-2"
          >
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">点击选择文件</span>
          </Button>
          {files.length > 0 && (
            <div className="text-xs text-muted-foreground">
              已选择 {files.length} 个文件:
              <ul className="mt-1 space-y-0.5">
                {files.map((f) => (
                  <li key={f.name} className="truncate">
                    · {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}
          {progress && (
            <p className="text-xs text-muted-foreground">
              处理中... {progress.done} / {progress.total}
            </p>
          )}
          {error && <p className="text-xs text-red-500 whitespace-pre-line">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="border-0"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={pending || files.length === 0}
            className="border-0"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : `上传 ${files.length} 个文件`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UrlDialog({
  kbId,
  open,
  onOpenChange,
  onSuccess,
}: {
  kbId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    if (!url.trim()) return setError("URL 不能为空");
    try {
      new URL(url.trim());
    } catch {
      return setError("URL 格式无效");
    }

    startTransition(async () => {
      try {
        await crawlUrlIntoKB(kbId, url.trim());
        setUrl("");
        onOpenChange(false);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "爬取失败");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>URL 爬取</DialogTitle>
          <DialogDescription>
            通过 Jina Reader 抓取页面正文。爬取过程通常需要几秒钟。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="url-input">页面 URL</Label>
            <Input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="border-0"
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={pending} className="border-0">
            {pending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                爬取中
              </>
            ) : (
              "开始爬取"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
