"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
import {
  bindExistingOutletToAccount,
  createAccountWithOutlet,
} from "@/app/actions/account-analytics";
import { cn } from "@/lib/utils";

// 当前 Phase 2 只支持这三个平台（与 server action 的 SupportedAccountPlatform 保持一致）
const SUPPORTED_PLATFORMS = [
  { value: "douyin", label: "抖音", helper: "https://www.douyin.com/user/MS4w..." },
  { value: "weibo", label: "微博", helper: "https://weibo.com/u/1234567890" },
  { value: "kuaishou", label: "快手", helper: "https://www.kuaishou.com/profile/3xa..." },
] as const;

const BENCHMARK_LEVELS = [
  { value: "central", label: "央级" },
  { value: "provincial", label: "省级" },
  { value: "city", label: "市级" },
  { value: "industry", label: "行业" },
  { value: "self_media", label: "自媒体" },
] as const;

type AccountSource = "my" | "benchmark";
type Platform = (typeof SUPPORTED_PLATFORMS)[number]["value"];
type BenchmarkLevel = (typeof BENCHMARK_LEVELS)[number]["value"];

export interface OutletOption {
  id: string;
  outletName: string;
  outletTier: string;
  outletRegion: string | null;
  /** 用来显示 outlet 已配过哪些平台（标识符是否齐全） */
  channels: Array<{ type: string; nickname?: string }>;
}

interface BindAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlets: OutletOption[];
  onSuccess?: () => void;
}

export function BindAccountDialog({
  open,
  onOpenChange,
  outlets,
  onSuccess,
}: BindAccountDialogProps) {
  const [tab, setTab] = useState<"existing" | "manual">("existing");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!pending) onOpenChange(o);
      }}
    >
      <DialogContent className="glass-panel sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>绑定账号</DialogTitle>
          <DialogDescription>
            把账号加入「账号分析」。可以从「媒体账号库」里挑现成的 outlet，也可以手动添加新账号（同时会建一份到媒体账号库）。
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "existing" | "manual")}
          className="mt-1"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="existing">从媒体账号库选择</TabsTrigger>
            <TabsTrigger value="manual">手动添加</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="pt-3">
            <FromExistingForm
              outlets={outlets}
              pending={pending}
              onSubmit={(args) =>
                startTransition(async () => {
                  const res = await bindExistingOutletToAccount(args);
                  if (!res.success) {
                    toast.error(res.error ?? "绑定失败");
                    return;
                  }
                  toast.success(
                    res.alreadyExists ? "账号已存在，已重新绑定到此 outlet" : "已成功绑定账号",
                  );
                  onSuccess?.();
                  onOpenChange(false);
                })
              }
            />
          </TabsContent>

          <TabsContent value="manual" className="pt-3">
            <ManualAddForm
              pending={pending}
              onSubmit={(args) =>
                startTransition(async () => {
                  const res = await createAccountWithOutlet(args);
                  if (!res.success) {
                    toast.error(res.error ?? "创建失败");
                    return;
                  }
                  toast.success("已新建账号并同步到媒体账号库");
                  onSuccess?.();
                  onOpenChange(false);
                })
              }
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2 text-[11px] text-gray-400">
          {pending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              处理中...
            </span>
          ) : (
            <span>提交后可在账号列表立即看到该账号</span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-form 1：从媒体账号库挑已有 outlet
// ────────────────────────────────────────────────────────────

function FromExistingForm({
  outlets,
  pending,
  onSubmit,
}: {
  outlets: OutletOption[];
  pending: boolean;
  onSubmit: (args: {
    outletId: string;
    source: AccountSource;
    platform: Platform;
    level?: BenchmarkLevel;
  }) => void;
}) {
  const [source, setSource] = useState<AccountSource>("my");
  const [platform, setPlatform] = useState<Platform>("weibo");
  const [level, setLevel] = useState<BenchmarkLevel>("provincial");
  const [outletId, setOutletId] = useState<string>("");
  const [keyword, setKeyword] = useState("");

  const filteredOutlets = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return outlets;
    return outlets.filter(
      (o) =>
        o.outletName.toLowerCase().includes(kw) ||
        (o.outletRegion ?? "").toLowerCase().includes(kw),
    );
  }, [outlets, keyword]);

  const valid = outletId && platform && (source === "my" || level);

  function handleSubmit() {
    if (!valid) return;
    onSubmit({
      outletId,
      source,
      platform,
      level: source === "benchmark" ? level : undefined,
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="账号归属">
          <Select value={source} onValueChange={(v) => setSource(v as AccountSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">我方账号</SelectItem>
              <SelectItem value="benchmark">对标账号</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="平台">
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {source === "benchmark" && (
        <Field label="对标级别">
          <Select value={level} onValueChange={(v) => setLevel(v as BenchmarkLevel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BENCHMARK_LEVELS.map((lv) => (
                <SelectItem key={lv.value} value={lv.value}>
                  {lv.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label="选择 outlet">
        <SearchInput
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索名称 / 地区..."
        />
        <div className="mt-2 h-[260px] overflow-y-auto rounded-md border border-gray-200/60 dark:border-gray-700/60 bg-white/40 dark:bg-white/5">
          {filteredOutlets.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-gray-400">
              {outlets.length === 0
                ? "媒体账号库暂无 outlet，请先到「采集配置 / 媒体账号库」新建"
                : "没有匹配的 outlet"}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredOutlets.map((o) => {
                const hasPlatform = o.channels.some((c) => c.type === platform);
                const active = outletId === o.id;
                return (
                  <li
                    key={o.id}
                    onClick={() => setOutletId(o.id)}
                    className={cn(
                      "px-3 py-2 cursor-pointer flex items-center justify-between gap-2",
                      active && "bg-sky-50 dark:bg-sky-900/20",
                      !active && "hover:bg-gray-50 dark:hover:bg-white/5",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate text-[#1F3864] dark:text-blue-200">
                        {o.outletName}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {o.outletRegion ?? "未知地区"} ·{" "}
                        {o.channels.length === 0
                          ? "尚未配置任何 channel"
                          : `已配 ${o.channels.map((c) => c.type).join(" / ")}`}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 inline-block w-2 h-2 rounded-full",
                        hasPlatform ? "bg-emerald-500" : "bg-amber-400",
                      )}
                      title={
                        hasPlatform
                          ? `outlet 已配 ${platform} channel`
                          : `outlet 还没有 ${platform} channel —— 绑定后请到媒体账号库补齐`
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Field>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!valid || pending}>
          {pending && <Loader2 size={14} className="mr-1 animate-spin" />}
          绑定
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-form 2：手动添加新账号（自动同步到媒体账号库）
// ────────────────────────────────────────────────────────────

function ManualAddForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (args: {
    source: AccountSource;
    platform: Platform;
    name: string;
    handle: string;
    profileUrl?: string;
    level?: BenchmarkLevel;
    region?: string;
  }) => void;
}) {
  const [source, setSource] = useState<AccountSource>("my");
  const [platform, setPlatform] = useState<Platform>("weibo");
  const [level, setLevel] = useState<BenchmarkLevel>("provincial");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [region, setRegion] = useState("");

  const platformMeta = SUPPORTED_PLATFORMS.find((p) => p.value === platform);
  const valid =
    name.trim() && handle.trim() && (source === "my" || level);

  function handleSubmit() {
    if (!valid) return;
    onSubmit({
      source,
      platform,
      name: name.trim(),
      handle: handle.trim(),
      profileUrl: profileUrl.trim() || undefined,
      level: source === "benchmark" ? level : undefined,
      region: region.trim() || undefined,
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="账号归属">
          <Select value={source} onValueChange={(v) => setSource(v as AccountSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">我方账号</SelectItem>
              <SelectItem value="benchmark">对标账号</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="平台">
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {source === "benchmark" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="对标级别">
            <Select value={level} onValueChange={(v) => setLevel(v as BenchmarkLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BENCHMARK_LEVELS.map((lv) => (
                  <SelectItem key={lv.value} value={lv.value}>
                    {lv.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="地区（可选）">
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="如 北京 / 上海"
            />
          </Field>
        </div>
      )}

      <Field label="账号显示名 *">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如 北京时间"
        />
      </Field>

      <Field label="账号 handle *">
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="平台账号唯一标识，如 BeijingTime"
        />
        <p className="mt-1 text-[11px] text-gray-400">
          组织内 (平台, handle) 唯一，不能重复
        </p>
      </Field>

      <Field label="主页 URL（可选，自动提取识别符）">
        <Input
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder={platformMeta?.helper}
        />
        <p className="mt-1 text-[11px] text-gray-400">
          填了主页 URL，会自动解析出{" "}
          {platform === "douyin" ? "secUid" : platform === "weibo" ? "uid" : "userId"}{" "}
          并写入 outlet.channels，cron 立即可抓
        </p>
      </Field>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!valid || pending}>
          {pending && <Loader2 size={14} className="mr-1 animate-spin" />}
          创建
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 通用字段壳
// ────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] text-gray-600 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
