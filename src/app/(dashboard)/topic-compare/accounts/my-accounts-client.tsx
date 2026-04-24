"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createMyAccount,
  updateMyAccount,
  deleteMyAccount,
} from "@/app/actions/topic-compare-accounts";
import type { MyAccountRow } from "@/lib/dal/my-accounts";

const PLATFORM_OPTIONS: Array<{
  value:
    | "app"
    | "website"
    | "wechat"
    | "weibo"
    | "douyin"
    | "kuaishou"
    | "bilibili"
    | "xiaohongshu"
    | "tv"
    | "radio"
    | "other";
  label: string;
}> = [
  { value: "app", label: "自家 APP" },
  { value: "website", label: "自家网站" },
  { value: "wechat", label: "微信公众号" },
  { value: "weibo", label: "微博" },
  { value: "douyin", label: "抖音" },
  { value: "kuaishou", label: "快手" },
  { value: "bilibili", label: "B 站" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "tv", label: "电视频道" },
  { value: "radio", label: "广播" },
  { value: "other", label: "其他" },
];

function platformLabel(platform: string): string {
  return PLATFORM_OPTIONS.find((o) => o.value === platform)?.label ?? platform;
}

interface Props {
  rows: MyAccountRow[];
}

type FormState = {
  id?: string;
  platform: (typeof PLATFORM_OPTIONS)[number]["value"];
  handle: string;
  name: string;
  accountUrl: string;
  description: string;
};

const emptyForm: FormState = {
  platform: "douyin",
  handle: "",
  name: "",
  accountUrl: "",
  description: "",
};

export function MyAccountsClient({ rows }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: MyAccountRow) {
    setForm({
      id: row.id,
      platform: row.platform as FormState["platform"],
      handle: row.handle,
      name: row.name,
      accountUrl: row.accountUrl ?? "",
      description: row.description ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = form.id
        ? await updateMyAccount({
            id: form.id,
            name: form.name,
            accountUrl: form.accountUrl,
            description: form.description,
          })
        : await createMyAccount({
            platform: form.platform,
            handle: form.handle,
            name: form.name,
            accountUrl: form.accountUrl,
            description: form.description,
          });
      if (res.success) {
        toast.success(form.id ? "已更新" : "已创建");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "保存失败");
      }
    });
  }

  function handleDelete(id: string) {
    setDeleteId(id);
  }

  function confirmDelete() {
    const id = deleteId;
    if (!id) return;
    startTransition(async () => {
      const res = await deleteMyAccount(id);
      if (res.success) {
        toast.success("已删除");
        router.refresh();
      } else {
        toast.error(res.error || "删除失败");
      }
      setDeleteId(null);
    });
  }

  // 按 platform 分组
  const grouped = rows.reduce<Record<string, MyAccountRow[]>>((acc, row) => {
    const key = row.platform;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="我方账号"
        description="绑定我方发布渠道账号（APP / 网站 / 抖音 / 微博 / 微信公众号 等），作为同题对比的作品来源"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            新增账号
          </Button>
        }
      />

      {rows.length === 0 ? (
        <GlassCard padding="lg">
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">暂无绑定账号</p>
            <p className="text-xs mt-2">点击右上角「新增账号」开始绑定</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([platform, accs]) => (
            <GlassCard padding="md" key={platform}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {platformLabel(platform)}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {accs.length} 个账号
                  </span>
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {accs.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-white/60 dark:bg-gray-800/60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {acc.name}
                        </div>
                        {!acc.isEnabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            已停用
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        @{acc.handle}
                      </div>
                      {acc.description && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {acc.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                        <span>{acc.postCount} 条帖子</span>
                        {acc.accountUrl && (
                          <a
                            href={acc.accountUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700"
                          >
                            <ExternalLink className="w-3 h-3" />
                            主页
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(acc)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(acc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "编辑账号" : "新增账号"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">平台</label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v as FormState["platform"] })}
                  disabled={!!form.id}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">handle（账号 ID）</label>
                <Input
                  value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  placeholder="douyin_user_123"
                  disabled={!!form.id}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">显示名称</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="北京卫视"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">账号主页 URL</label>
              <Input
                value={form.accountUrl}
                onChange={(e) => setForm({ ...form, accountUrl: e.target.value })}
                placeholder="https://www.douyin.com/user/..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">简介（选填）</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {form.id ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="删除账号"
        description="确认删除该账号？相关历史数据会一并清除。"
        confirmText="删除"
        variant="danger"
        loading={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
