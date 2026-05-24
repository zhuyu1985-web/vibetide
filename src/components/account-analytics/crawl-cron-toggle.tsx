"use client";

import { useState, useTransition } from "react";
import { Clock, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  toggleAccountCrawlCron,
  setAccountChannelIdentifier,
} from "@/app/actions/account-analytics";
import { PromptDialog } from "@/components/shared/prompt-dialog";
import { cn } from "@/lib/utils";

interface CrawlCronToggleProps {
  accountId: string;
  accountSource: "my" | "benchmark";
  platform: string;
  initialEnabled: boolean;
  /** 当前 outlet.channels[type=platform] 是否已经有 identifier */
  hasIdentifier?: boolean;
  lastCrawledAt?: string | null;
  /** 是否已绑定 outlet */
  hasOutletBinding?: boolean;
  className?: string;
  variant?: "card" | "inline";
}

const PLATFORM_HELP: Record<string, { label: string; example: string }> = {
  douyin: {
    label: "抖音主页 URL 或 secUid",
    example: "https://www.douyin.com/user/MS4wLjABAAAA...",
  },
  weibo: {
    label: "微博主页 URL 或数字 uid",
    example: "https://weibo.com/u/1234567890",
  },
  kuaishou: {
    label: "快手主页 URL 或 userId",
    example: "https://www.kuaishou.com/profile/3xa...",
  },
  wechat_oa: {
    label: "微信公众号 ghid",
    example: "gh_a3d35d4c9d3f",
  },
};

const CRAWLABLE_PLATFORMS = ["douyin", "weibo", "kuaishou", "wechat_oa"];

/**
 * 客户端自动抓取开关 —— 点击调 toggleAccountCrawlCron Server Action。
 * 永远可点；如账号未绑 outlet，开启时 Server Action 自动创建占位 outlet，
 * 提示用户去媒体字典补 secUid。
 */
export function CrawlCronToggle({
  accountId,
  accountSource,
  platform,
  initialEnabled,
  hasIdentifier = false,
  lastCrawledAt,
  hasOutletBinding = true,
  className,
  variant = "card",
}: CrawlCronToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [hasOutlet, setHasOutlet] = useState(hasOutletBinding);
  const [identifierOk, setIdentifierOk] = useState(hasIdentifier);
  const [pending, startTransition] = useTransition();
  // 「配置识别符」对话框开/关 + 加载态
  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const platformSupported = CRAWLABLE_PLATFORMS.includes(platform);
  const helpInfo = PLATFORM_HELP[platform];

  function handleToggle() {
    if (pending) return;
    const nextEnabled = !enabled;
    setEnabled(nextEnabled); // optimistic
    startTransition(async () => {
      const res = await toggleAccountCrawlCron({
        accountId,
        accountSource,
        enabled: nextEnabled,
      });
      if (!res.success) {
        setEnabled(enabled); // rollback
        toast.error(res.error ?? "切换失败");
        return;
      }
      if (nextEnabled) {
        if (res.needsSecUid) {
          setHasOutlet(true);
          toast.warning(
            "已开启 · 还需在「媒体字典」中为此账号补 secUid，cron 才能真正抓数据",
            { duration: 5000 },
          );
        } else {
          toast.success("已开启自动抓取（次日 05:00 SH 触发）");
        }
      } else {
        toast.success("已关闭自动抓取");
      }
    });
  }

  function openConfigDialog() {
    if (!helpInfo) {
      toast.error(`平台 ${platform} 不支持配置识别符`);
      return;
    }
    setConfigOpen(true);
  }

  function handleConfigSubmit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      toast.error("请输入主页 URL 或识别符");
      return;
    }
    setSavingConfig(true);
    startTransition(async () => {
      const res = await setAccountChannelIdentifier({
        accountId,
        accountSource,
        raw: trimmed,
      });
      setSavingConfig(false);
      if (!res.success) {
        toast.error(res.error ?? "保存失败");
        return;
      }
      setIdentifierOk(true);
      setConfigOpen(false);
      toast.success(`已保存识别符：${res.identifier?.slice(0, 24)}…`);
    });
  }

  const lastText = lastCrawledAt
    ? `${lastCrawledAt.slice(5, 16).replace("T", " ")} 上次`
    : "暂未抓取";

  // 需配识别符的判断：开启 + 是可抓平台 + 没识别符
  const needsConfig = platformSupported && !identifierOk;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 text-[11.5px]",
          variant === "card" ? "justify-between" : "",
          className,
        )}
        onClick={(e) => e.preventDefault()}
      >
        <div className="inline-flex items-center gap-1 text-gray-500 min-w-0">
          {needsConfig ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openConfigDialog();
              }}
              disabled={pending || savingConfig}
              title="点击粘贴主页 URL，自动提取识别符"
              className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer border-0 bg-transparent p-0 whitespace-nowrap"
            >
              <Settings size={11} className="shrink-0" />
              点此配置识别符
            </button>
          ) : (
            <>
              <Clock size={11} className="shrink-0" />
              <span className="whitespace-nowrap">{lastText}</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleToggle();
          }}
          disabled={pending}
          title={
            pending
              ? "切换中…"
              : enabled
                ? "点击关闭自动抓取"
                : "点击开启自动抓取（如未绑定 outlet 会自动创建）"
          }
          className={cn(
            "relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors cursor-pointer border-0 p-0",
            enabled ? "bg-[#2A9D8F]" : "bg-gray-300 dark:bg-gray-700",
            pending && "opacity-50 cursor-wait",
          )}
        >
          <span className="sr-only">{enabled ? "关闭" : "开启"}自动抓取</span>
          <span
            className={cn(
              "inline-block h-3 w-3 rounded-full bg-white transition-transform shadow",
              enabled ? "translate-x-4" : "translate-x-0.5",
            )}
          >
            {pending && (
              <RefreshCw size={8} className="animate-spin m-auto mt-0.5 text-gray-500" />
            )}
          </span>
        </button>
      </div>

      {/* 配置识别符对话框 —— 替代 window.prompt 的统一样式弹层 */}
      <PromptDialog
        open={configOpen}
        onOpenChange={(o) => {
          if (!savingConfig) setConfigOpen(o);
        }}
        title="配置识别符"
        description={
          helpInfo
            ? `请粘贴 ${helpInfo.label}（示例：${helpInfo.example}）`
            : undefined
        }
        placeholder={helpInfo?.example}
        confirmText="保存"
        cancelText="取消"
        loading={savingConfig}
        onConfirm={handleConfigSubmit}
      />
    </>
  );
}
