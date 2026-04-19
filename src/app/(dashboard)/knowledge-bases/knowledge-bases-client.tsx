"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/shared/search-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createKnowledgeBase } from "@/app/actions/knowledge-bases";
import {
  BookMarked,
  Plus,
  Search,
  Database,
  Loader2,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Tv,
} from "lucide-react";
import type {
  KBSummary,
  KBVectorizationStatus,
  KnowledgeSource,
  KnowledgeItem,
  ChannelDNA,
  KnowledgeSyncLog,
} from "@/lib/types";

const ChannelKnowledgeClient = dynamic(
  () => import("@/app/(dashboard)/channel-knowledge/channel-knowledge-client"),
  { ssr: false }
);

const KB_TYPE_LABELS: Record<string, string> = {
  general: "通用",
  channel_style: "频道风格",
  sensitive_topics: "敏感话题",
  domain_specific: "领域专业",
};

const KB_TYPE_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70",
  channel_style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  sensitive_topics: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  domain_specific: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const STATUS_CONFIG: Record<
  KBVectorizationStatus,
  { label: string; color: string; Icon: typeof CheckCircle2 }
> = {
  pending: {
    label: "待向量化",
    color: "text-gray-500 dark:text-white/50",
    Icon: Clock,
  },
  processing: {
    label: "向量化中",
    color: "text-blue-500 dark:text-blue-400",
    Icon: Sparkles,
  },
  done: {
    label: "已就绪",
    color: "text-emerald-500 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  failed: {
    label: "失败",
    color: "text-red-500 dark:text-red-400",
    Icon: AlertTriangle,
  },
};

const STATUS_TABS = [
  { value: "all", label: "全部" },
  { value: "done", label: "已就绪" },
  { value: "pending", label: "待向量化" },
  { value: "processing", label: "向量化中" },
  { value: "failed", label: "失败" },
] as const;

interface ChannelData {
  sources: {
    upload: KnowledgeSource[];
    cms: KnowledgeSource[];
    subscription: KnowledgeSource[];
    stats: { totalDocuments: number; totalChunks: number; lastSync: string };
  };
  items: KnowledgeItem[];
  dna: { dimensions: ChannelDNA[]; report: string };
  syncLogs: KnowledgeSyncLog[];
}

interface Props {
  initialSummaries: KBSummary[];
  channelData?: ChannelData;
}

export function KnowledgeBasesClient({ initialSummaries, channelData }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("general");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    return initialSummaries.filter((kb) => {
      if (statusFilter !== "all" && kb.vectorizationStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !kb.name.toLowerCase().includes(q) &&
          !kb.description.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [initialSummaries, search, statusFilter]);

  return (
    <div className="max-w-[1400px] mx-auto px-1">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90 mb-1">
            知识库
          </h1>
          <p className="text-sm text-gray-400 dark:text-white/40">
            管理 AI 员工的通用知识库与频道专属知识沉淀。
          </p>
        </div>
        {activeTab === "general" && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl border-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            新建知识库
          </Button>
        )}
      </div>

      {/* ── Top-level Tab: 通用知识库 / 频道知识沉淀 ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-transparent border-0 p-0 h-auto gap-1">
          <TabsTrigger value="general" className="border-0 data-[state=active]:bg-accent rounded-lg px-4 py-2">
            <Database className="w-4 h-4 mr-1.5" />
            通用知识库
          </TabsTrigger>
          <TabsTrigger value="channel" className="border-0 data-[state=active]:bg-accent rounded-lg px-4 py-2">
            <Tv className="w-4 h-4 mr-1.5" />
            频道知识沉淀
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <SearchInput
          className="w-full sm:w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索知识库名称或描述..."
        />

        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-0 cursor-pointer ${
                statusFilter === tab.value
                  ? "bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white/90"
                  : "bg-transparent text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Count ── */}
      <div className="mb-4">
        <span className="text-xs text-gray-300 dark:text-white/30">
          共 {filtered.length} 个知识库
          {(search.trim() || statusFilter !== "all") && " (已筛选)"}
        </span>
      </div>

      {/* ── Grid ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((kb) => (
            <KBCard key={kb.id} kb={kb} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <BookMarked className="w-10 h-10 text-gray-200 dark:text-white/20 mb-3" />
          <p className="text-sm text-gray-400 dark:text-white/40">
            {search.trim() || statusFilter !== "all"
              ? "没有匹配的知识库"
              : "暂无知识库，点击右上角创建第一个"}
          </p>
        </div>
      )}

      {/* ── Create Dialog ── */}
      <CreateKBDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => router.refresh()}
      />
        </TabsContent>

        <TabsContent value="channel" className="mt-4">
          {channelData ? (
            <ChannelKnowledgeClient
              sources={channelData.sources}
              items={channelData.items}
              dna={channelData.dna}
              syncLogs={channelData.syncLogs}
              embedded
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <Tv className="w-10 h-10 text-gray-200 dark:text-white/20 mb-3" />
              <p className="text-sm text-gray-400 dark:text-white/40">
                频道知识数据加载中...
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KB Card
// ---------------------------------------------------------------------------

function KBCard({ kb }: { kb: KBSummary }) {
  const status = STATUS_CONFIG[kb.vectorizationStatus];
  const StatusIcon = status.Icon;
  const typeLabel = KB_TYPE_LABELS[kb.type] || kb.type;
  const typeColor = KB_TYPE_COLORS[kb.type] || KB_TYPE_COLORS.general;

  return (
    <Link
      href={`/knowledge-bases/${kb.id}`}
      className="group bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-border/80 transition-all duration-200 block"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {kb.name}
            </h3>
            <Badge className={`${typeColor} text-[10px] border-0`}>{typeLabel}</Badge>
          </div>
          {kb.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {kb.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
            <span>{kb.documentCount} 文档</span>
            <span>·</span>
            <span>{kb.chunkCount} chunks</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {kb.boundEmployeeCount}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
        <div className={`flex items-center gap-1 text-[11px] ${status.color}`}>
          <StatusIcon className="w-3 h-3" />
          <span>{status.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground/50">
          {formatRelative(kb.updatedAt)}
        </span>
      </div>
    </Link>
  );
}

function formatRelative(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN");
}

// ---------------------------------------------------------------------------
// Create Dialog
// ---------------------------------------------------------------------------

function CreateKBDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    if (!name.trim()) {
      setError("名称不能为空");
      return;
    }
    startTransition(async () => {
      try {
        await createKnowledgeBase({ name, description, type });
        setName("");
        setDescription("");
        setType("general");
        onOpenChange(false);
        onCreated();
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建失败");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>新建知识库</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="kb-name">名称</Label>
            <Input
              id="kb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：企业品牌风格指南"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-desc">描述（可选）</Label>
            <Textarea
              id="kb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要说明这个知识库的内容和用途"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-type">类型</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="kb-type">
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
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
