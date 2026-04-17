"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  Check,
  Trash2,
  Pencil,
  MessageSquare,
  Settings2,
  Eye,
  EyeOff,
  Loader2,
  Webhook,
  Filter,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import {
  createChannelConfig,
  updateChannelConfig,
  deleteChannelConfig,
  toggleChannelConfig,
  testChannelConfig,
} from "@/app/actions/channels";
import type {
  ChannelConfigRow,
  ChannelPlatform,
  ChannelMessageRow,
  PaginatedChannelMessages,
} from "@/lib/dal/channels";

// ── Constants ───────────────────────────────────────────────

const PLATFORM_CFG = {
  dingtalk: {
    label: "钉钉",
    cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  },
  wechat_work: {
    label: "企业微信",
    cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  },
} as const;

const DIRECTION_CFG = {
  inbound: { label: "入站", cls: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" },
  outbound: { label: "出站", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
} as const;

const STATUS_CFG = {
  received: { label: "已接收", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  processed: { label: "已处理", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
  sent: { label: "已发送", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
  failed: { label: "失败", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
} as const;

// ── Helpers ──────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function buildWebhookUrl(platform: ChannelPlatform, configId: string): string {
  const base =
    typeof window !== "undefined" ? window.location.origin : "";
  const path =
    platform === "dingtalk"
      ? `/api/channels/dingtalk/webhook/${configId}`
      : `/api/channels/wechat/webhook/${configId}`;
  return `${base}${path}`;
}

function contentPreview(content: Record<string, unknown>): string {
  if (!content) return "—";
  const text =
    (content.text as string) ||
    (content.content as string) ||
    (content.message as string) ||
    JSON.stringify(content);
  return text.length > 60 ? text.slice(0, 60) + "…" : text;
}

// ── Form state types ─────────────────────────────────────────

interface ChannelFormState {
  platform: ChannelPlatform;
  name: string;
  appKey: string;
  appSecret: string;
  robotSecret: string;
  agentId: string;
  token: string;
  encodingAesKey: string;
}

const defaultForm = (): ChannelFormState => ({
  platform: "dingtalk",
  name: "",
  appKey: "",
  appSecret: "",
  robotSecret: "",
  agentId: "",
  token: "",
  encodingAesKey: "",
});

// ── Main Component ───────────────────────────────────────────

export function ChannelsClient({
  initialConfigs,
  initialMessages,
}: {
  initialConfigs: ChannelConfigRow[];
  initialMessages: PaginatedChannelMessages;
}) {
  const [configs, setConfigs] = useState<ChannelConfigRow[]>(initialConfigs);
  const [messages] = useState<ChannelMessageRow[]>(initialMessages.rows);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChannelConfigRow | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ChannelConfigRow | null>(null);

  // Form
  const [form, setForm] = useState<ChannelFormState>(defaultForm());
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Message filters
  const [msgPlatformFilter, setMsgPlatformFilter] = useState<ChannelPlatform | "all">("all");
  const [msgDirectionFilter, setMsgDirectionFilter] = useState<"inbound" | "outbound" | "all">("all");

  const [isPending, startTransition] = useTransition();

  // ── Form helpers ───────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm());
    setCreatedId(null);
    setShowSecrets({});
    setSheetOpen(true);
  }

  function openEdit(cfg: ChannelConfigRow) {
    setEditTarget(cfg);
    setCreatedId(null);
    setForm({
      platform: cfg.platform,
      name: cfg.name,
      appKey: cfg.appKey ?? "",
      appSecret: cfg.appSecret ?? "",
      robotSecret: cfg.robotSecret ?? "",
      agentId: cfg.agentId ?? "",
      token: cfg.token ?? "",
      encodingAesKey: cfg.encodingAesKey ?? "",
    });
    setShowSecrets({});
    setSheetOpen(true);
  }

  function setField<K extends keyof ChannelFormState>(key: K, value: ChannelFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSecret(field: string) {
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  // ── Submit ─────────────────────────────────────────────────

  function handleSubmit() {
    startTransition(async () => {
      try {
        if (editTarget) {
          await updateChannelConfig(editTarget.id, {
            name: form.name,
            appKey: form.appKey || null,
            appSecret: form.appSecret || null,
            robotSecret: form.robotSecret || null,
            agentId: form.agentId || null,
            token: form.token || null,
            encodingAesKey: form.encodingAesKey || null,
          });
          setConfigs((prev) =>
            prev.map((c) =>
              c.id === editTarget.id
                ? {
                    ...c,
                    name: form.name,
                    appKey: form.appKey || null,
                    appSecret: form.appSecret || null,
                    robotSecret: form.robotSecret || null,
                    agentId: form.agentId || null,
                    token: form.token || null,
                    encodingAesKey: form.encodingAesKey || null,
                  }
                : c
            )
          );
          toast.success("渠道配置已更新");
          setSheetOpen(false);
        } else {
          const result = await createChannelConfig({
            platform: form.platform,
            name: form.name,
            appKey: form.appKey || undefined,
            appSecret: form.appSecret || undefined,
            robotSecret: form.robotSecret || undefined,
            agentId: form.agentId || undefined,
            token: form.token || undefined,
            encodingAesKey: form.encodingAesKey || undefined,
            isEnabled: true,
          });
          const newConfig: ChannelConfigRow = {
            id: result.id,
            organizationId: "",
            platform: form.platform,
            name: form.name,
            appKey: form.appKey || null,
            appSecret: form.appSecret || null,
            robotSecret: form.robotSecret || null,
            agentId: form.agentId || null,
            token: form.token || null,
            encodingAesKey: form.encodingAesKey || null,
            isEnabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setConfigs((prev) => [newConfig, ...prev]);
          setCreatedId(result.id);
          toast.success("渠道配置已创建");
        }
      } catch (err) {
        toast.error((err as Error).message ?? "操作失败");
      }
    });
  }

  // ── Toggle ─────────────────────────────────────────────────

  function handleToggle(cfg: ChannelConfigRow, enabled: boolean) {
    startTransition(async () => {
      try {
        await toggleChannelConfig(cfg.id, enabled);
        setConfigs((prev) =>
          prev.map((c) => (c.id === cfg.id ? { ...c, isEnabled: enabled } : c))
        );
        toast.success(enabled ? "渠道已启用" : "渠道已停用");
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
        await deleteChannelConfig(id);
        setConfigs((prev) => prev.filter((c) => c.id !== id));
        toast.success("渠道配置已删除");
      } catch (err) {
        toast.error((err as Error).message ?? "删除失败");
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  // ── Filtered messages ──────────────────────────────────────

  const filteredMessages = useMemo(() => {
    let list = messages;
    if (msgPlatformFilter !== "all") {
      list = list.filter((m) => m.platform === msgPlatformFilter);
    }
    if (msgDirectionFilter !== "all") {
      list = list.filter((m) => m.direction === msgDirectionFilter);
    }
    return list;
  }, [messages, msgPlatformFilter, msgDirectionFilter]);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="渠道集成"
        description="管理钉钉、企业微信等即时通讯渠道的 Webhook 接入配置"
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus size={15} />
            添加渠道
          </Button>
        }
      />

      <Tabs defaultValue="configs">
        <TabsList className="mb-5">
          <TabsTrigger value="configs" className="gap-2">
            <Settings2 size={14} />
            已配置渠道
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare size={14} />
            消息记录
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Configs ── */}
        <TabsContent value="configs">
          {configs.length === 0 ? (
            <GlassCard className="p-16 text-center">
              <Webhook size={40} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">暂无渠道配置</p>
              <Button variant="ghost" onClick={openCreate} className="mt-4 gap-2">
                <Plus size={14} />
                添加第一个渠道
              </Button>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {configs.map((cfg) => (
                <ChannelConfigCard
                  key={cfg.id}
                  config={cfg}
                  onEdit={() => openEdit(cfg)}
                  onDelete={() => setDeleteTarget(cfg)}
                  onToggle={(enabled) => handleToggle(cfg, enabled)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Messages ── */}
        <TabsContent value="messages">
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Filter size={14} className="text-muted-foreground shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-0.5">平台</span>
              {(
                [
                  { key: "all" as const, label: "全部" },
                  { key: "dingtalk" as const, label: "钉钉" },
                  { key: "wechat_work" as const, label: "企业微信" },
                ] as const
              ).map((f) => (
                <Button
                  key={f.key}
                  variant={msgPlatformFilter === f.key ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setMsgPlatformFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-0.5">方向</span>
              {(
                [
                  { key: "all" as const, label: "全部" },
                  { key: "inbound" as const, label: "入站" },
                  { key: "outbound" as const, label: "出站" },
                ] as const
              ).map((f) => (
                <Button
                  key={f.key}
                  variant={msgDirectionFilter === f.key ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setMsgDirectionFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {filteredMessages.length === 0 ? (
            <GlassCard className="p-16 text-center">
              <MessageSquare size={40} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">暂无消息记录</p>
            </GlassCard>
          ) : (
            <GlassCard variant="panel" padding="none">
              {/* Table header */}
              <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/60">
                <div className="w-20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  平台
                </div>
                <div className="w-16 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  方向
                </div>
                <div className="w-28 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  会话 ID
                </div>
                <div className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  内容摘要
                </div>
                <div className="w-28 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  任务
                </div>
                <div className="w-16 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  状态
                </div>
                <div className="w-24 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
                  时间
                </div>
              </div>

              {filteredMessages.map((msg) => {
                const platformCfg = PLATFORM_CFG[msg.platform];
                const dirCfg = DIRECTION_CFG[msg.direction];
                const statusCfg = STATUS_CFG[msg.status] ?? {
                  label: msg.status,
                  cls: "bg-gray-100 dark:bg-gray-800 text-gray-500",
                };
                return (
                  <div
                    key={msg.id}
                    className="flex items-center gap-3 px-5 py-3 border-b border-border/40 last:border-b-0 text-sm"
                  >
                    <div className="w-20 shrink-0">
                      <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", platformCfg?.cls)}>
                        {platformCfg?.label ?? msg.platform}
                      </Badge>
                    </div>
                    <div className="w-16 shrink-0">
                      <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", dirCfg?.cls)}>
                        {dirCfg?.label ?? msg.direction}
                      </Badge>
                    </div>
                    <div className="w-28 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono truncate block">
                        {msg.chatId ?? "—"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-foreground truncate block">
                        {contentPreview(msg.content)}
                      </span>
                    </div>
                    <div className="w-28 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono truncate block">
                        {msg.missionId ? msg.missionId.slice(0, 8) + "…" : "—"}
                      </span>
                    </div>
                    <div className="w-16 shrink-0">
                      <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", statusCfg.cls)}>
                        {statusCfg.label}
                      </Badge>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </GlassCard>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add / Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editTarget ? "编辑渠道配置" : "添加渠道"}</SheetTitle>
          </SheetHeader>

          {/* If just created, show webhook URL first */}
          {createdId && (
            <WebhookUrlDisplay
              platform={form.platform}
              configId={createdId}
              onClose={() => setSheetOpen(false)}
            />
          )}

          {!createdId && (
            <div className="space-y-5">
              {/* Platform selector (create only) */}
              {!editTarget && (
                <div className="space-y-2">
                  <Label>平台</Label>
                  <div className="flex gap-3">
                    {(["dingtalk", "wechat_work"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setField("platform", p)}
                        className={cn(
                          "flex-1 rounded-xl border py-3 px-4 text-sm font-medium transition-colors",
                          form.platform === p
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {PLATFORM_CFG[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="ch-name">配置名称</Label>
                <Input
                  id="ch-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="例如：运营群机器人"
                />
              </div>

              {/* Configuration guide */}
              <ConfigurationGuide
                platform={form.platform}
                defaultOpen={!editTarget}
              />

              {/* DingTalk fields */}
              {form.platform === "dingtalk" && (
                <>
                  <SecretField
                    id="ch-appKey"
                    label="Webhook URL"
                    helper="钉钉机器人的 Webhook 地址"
                    value={form.appKey}
                    masked={editTarget ? !showSecrets["appKey"] : false}
                    showToggle={!!editTarget}
                    onToggle={() => toggleSecret("appKey")}
                    onChange={(v) => setField("appKey", v)}
                    placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                  />
                  <SecretField
                    id="ch-robotSecret"
                    label="加签密钥"
                    helper="以 SEC 开头的签名密钥"
                    value={form.robotSecret}
                    masked={editTarget ? !showSecrets["robotSecret"] : false}
                    showToggle={!!editTarget}
                    onToggle={() => toggleSecret("robotSecret")}
                    onChange={(v) => setField("robotSecret", v)}
                    placeholder="SEC..."
                  />
                </>
              )}

              {/* WeChat Work fields */}
              {form.platform === "wechat_work" && (
                <>
                  <SecretField
                    id="ch-appKey"
                    label="企业ID (CorpID)"
                    helper="企业微信管理后台 → 我的企业"
                    value={form.appKey}
                    masked={editTarget ? !showSecrets["appKey"] : false}
                    showToggle={!!editTarget}
                    onToggle={() => toggleSecret("appKey")}
                    onChange={(v) => setField("appKey", v)}
                    placeholder="ww..."
                  />
                  <SecretField
                    id="ch-appSecret"
                    label="应用 Secret"
                    helper="自建应用详情页获取"
                    value={form.appSecret}
                    masked={editTarget ? !showSecrets["appSecret"] : false}
                    showToggle={!!editTarget}
                    onToggle={() => toggleSecret("appSecret")}
                    onChange={(v) => setField("appSecret", v)}
                    placeholder="AppSecret"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="ch-agentId">应用 AgentId</Label>
                    <Input
                      id="ch-agentId"
                      value={form.agentId}
                      onChange={(e) => setField("agentId", e.target.value)}
                      placeholder="1000002"
                    />
                    <p className="text-xs text-muted-foreground">
                      自建应用详情页的数字ID
                    </p>
                  </div>
                  <SecretField
                    id="ch-token"
                    label="Token"
                    helper="在应用的接收消息配置中自定义"
                    value={form.token}
                    masked={editTarget ? !showSecrets["token"] : false}
                    showToggle={!!editTarget}
                    onToggle={() => toggleSecret("token")}
                    onChange={(v) => setField("token", v)}
                    placeholder="Token"
                  />
                  <SecretField
                    id="ch-encodingAesKey"
                    label="EncodingAESKey"
                    helper="43位随机字符串，接收消息配置页可生成"
                    value={form.encodingAesKey}
                    masked={editTarget ? !showSecrets["encodingAesKey"] : false}
                    showToggle={!!editTarget}
                    onToggle={() => toggleSecret("encodingAesKey")}
                    onChange={(v) => setField("encodingAesKey", v)}
                    placeholder="EncodingAESKey (43位)"
                  />
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setSheetOpen(false)}
                  disabled={isPending}
                >
                  取消
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleSubmit}
                  disabled={isPending || !form.name.trim()}
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {editTarget ? "保存修改" : "创建渠道"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirm ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除渠道配置？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除「{deleteTarget?.name}」及其相关 Webhook 配置，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── ChannelConfigCard ────────────────────────────────────────

function ChannelConfigCard({
  config,
  onEdit,
  onDelete,
  onToggle,
}: {
  config: ChannelConfigRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const webhookUrl = buildWebhookUrl(config.platform, config.id);
  const platformCfg = PLATFORM_CFG[config.platform];

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    try {
      const res = await testChannelConfig(config.id);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error((err as Error).message ?? "测试失败");
    } finally {
      setTesting(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      {/* Top row: badge + name + toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Badge className={cn("text-xs font-semibold px-2.5 py-0.5 shrink-0", platformCfg?.cls)}>
            {platformCfg?.label ?? config.platform}
          </Badge>
          <span className="text-sm font-medium text-foreground truncate">
            {config.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">
            {config.isEnabled ? "启用" : "停用"}
          </span>
          <Switch
            checked={config.isEnabled}
            onCheckedChange={onToggle}
          />
        </div>
      </div>

      {/* Webhook URL */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Webhook URL
        </p>
        <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
          <span className="flex-1 text-xs font-mono text-muted-foreground truncate">
            {webhookUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="复制"
          >
            {copied ? (
              <Check size={13} className="text-emerald-500" />
            ) : (
              <Copy size={13} />
            )}
          </button>
        </div>
      </div>

      {/* Footer: time + actions */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-muted-foreground">
          创建于 {relativeTime(config.createdAt)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={handleTest}
            disabled={testing || !config.isEnabled}
            title={config.isEnabled ? "发送测试消息" : "请先启用渠道"}
          >
            {testing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Zap size={12} />
            )}
            {testing ? "测试中..." : "测试"}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="编辑">
            <Pencil size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="删除"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

// ── SecretField ──────────────────────────────────────────────

function SecretField({
  id,
  label,
  helper,
  value,
  masked,
  showToggle,
  onToggle,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  helper?: string;
  value: string;
  masked: boolean;
  showToggle: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={masked ? "password" : "text"}
          value={masked ? "••••••••••••••••" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={masked ? undefined : placeholder}
          readOnly={masked}
          className={cn("pr-10", masked && "text-muted-foreground")}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {masked ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
      </div>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

// ── ConfigurationGuide ───────────────────────────────────────

const DINGTALK_STEPS = [
  "登录钉钉群 → 群设置 → 智能群助手 → 添加机器人 → 自定义机器人",
  "填写机器人名称，安全设置选择“加签”",
  "创建后获得 Webhook URL（形如 https://oapi.dingtalk.com/robot/send?access_token=xxx）和加签密钥（SEC 开头）",
  "将 URL 和密钥填入下方表单",
  "如需接收消息回复，需使用“企业内部应用 + 消息接收机器人”（参考钉钉开发者文档）",
];

const WECHAT_WORK_STEPS = [
  "登录企业微信管理后台 → 应用管理 → 自建 → 创建应用",
  "获取 企业ID (CorpID) — 在“我的企业”页面",
  "获取 应用 AgentId 和 Secret — 在应用详情页",
  "在应用“接收消息”配置中：自定义 Token，生成 EncodingAESKey",
  "将信息填入下方表单，保存后复制生成的 Webhook URL，贴回企业微信后台完成验证",
];

function ConfigurationGuide({
  platform,
  defaultOpen,
}: {
  platform: ChannelPlatform;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const steps = platform === "dingtalk" ? DINGTALK_STEPS : WECHAT_WORK_STEPS;
  const title = platform === "dingtalk" ? "钉钉配置指南" : "企业微信配置指南";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-border/60 bg-muted/30">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-primary" />
              <span className="text-sm font-medium">配置指南 · {title}</span>
            </div>
            {open ? (
              <ChevronUp size={14} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={14} className="text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="list-decimal space-y-2 px-5 pb-4 pl-8 pr-4 text-xs leading-relaxed text-muted-foreground">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── WebhookUrlDisplay ────────────────────────────────────────

function WebhookUrlDisplay({
  platform,
  configId,
  onClose,
}: {
  platform: ChannelPlatform;
  configId: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const webhookUrl = buildWebhookUrl(platform, configId);

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-2">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Check size={16} />
          <span className="text-sm font-medium">渠道配置已创建</span>
        </div>
        <p className="text-xs text-muted-foreground">
          请复制以下 Webhook URL，并将其配置到对应平台的机器人或接收端中。
        </p>
      </div>

      <div className="space-y-2">
        <Label>Webhook URL</Label>
        <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2.5">
          <span className="flex-1 text-xs font-mono text-foreground break-all">
            {webhookUrl}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 w-full"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-500" />
              已复制
            </>
          ) : (
            <>
              <Copy size={13} />
              复制 Webhook URL
            </>
          )}
        </Button>
      </div>

      <Button className="w-full" onClick={onClose}>
        完成
      </Button>
    </div>
  );
}
