"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { toggleAccountCrawlCron } from "@/app/actions/account-analytics";
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

const CRAWLABLE_PLATFORMS = ["douyin", "weibo", "kuaishou", "wechat_oa"];

/**
 * 自动抓取开关 —— 点击调 toggleAccountCrawlCron Server Action。
 *
 * 简化后的 UI：
 *   - 永远可点；如账号未绑 outlet，开启时 Server Action 自动建/复用占位 outlet
 *   - 需要补识别符时，左侧显示"前往媒体字典"链接而不是 inline 弹窗
 *     （识别符配置统一回到「采集配置 / 媒体字典」或「绑定账号」对话框里完成）
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
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [hasOutlet, setHasOutlet] = useState(hasOutletBinding);
  const [pending, startTransition] = useTransition();
  const platformSupported = CRAWLABLE_PLATFORMS.includes(platform);

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
          toast.info(
            "已开启自动抓取 · 接下来请到媒体字典补全识别符才能真正抓数据",
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

  const lastText = lastCrawledAt
    ? `${lastCrawledAt.slice(5, 16).replace("T", " ")} 上次`
    : "暂未抓取";

  // 需配识别符的判断：是可抓平台 + 没识别符
  const needsConfig = platformSupported && !hasIdentifier;

  return (
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
              router.push("/data-collection/outlets");
            }}
            title={
              hasOutlet
                ? "outlet 已建但缺识别符 —— 点击前往媒体字典补全"
                : "尚未绑定 outlet —— 点击前往媒体字典创建"
            }
            className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 whitespace-nowrap border-0 bg-transparent p-0 cursor-pointer"
          >
            <AlertTriangle size={11} className="shrink-0" />
            前往媒体字典补识别符
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
  );
}
