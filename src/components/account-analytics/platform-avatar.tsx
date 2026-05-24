import { cn } from "@/lib/utils";
import { getPlatformMeta } from "@/lib/account-analytics/platform-meta";

interface PlatformAvatarProps {
  platform: string;
  /** 优先用账号自身的头像 URL（如 my_accounts.avatarUrl）；缺则 fallback 到平台短简称色块 */
  avatarUrl?: string | null;
  /** 备用：账号名首字符（avatarUrl 不可用时叠加显示，比平台 short 更个性化） */
  accountChar?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 sm:h-16 sm:w-16 text-[18px] sm:text-[20px]",
} as const;

/**
 * 平台账号头像 —— 三层降级：账号自有 avatarUrl > 账号首字符（带平台色背景）> 平台 short 简称。
 * 始终带"平台品牌色"作为标识，让一眼能识别是哪个平台的账号。
 */
export function PlatformAvatar({
  platform,
  avatarUrl,
  accountChar,
  size = "md",
  className,
}: PlatformAvatarProps) {
  const meta = getPlatformMeta(platform);
  const baseClasses = cn(
    "relative inline-flex shrink-0 items-center justify-center rounded-full text-white font-bold overflow-hidden",
    SIZE_MAP[size],
    className,
  );

  if (avatarUrl) {
    return (
      <div className={baseClasses} style={{ backgroundColor: meta.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={platform}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* 右下角小角标显示平台 short */}
        <span
          className="absolute bottom-0 right-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-white px-1 text-[9px] font-semibold"
          style={{ backgroundColor: meta.color }}
        >
          {meta.short}
        </span>
      </div>
    );
  }

  const displayChar = accountChar?.trim().charAt(0) || meta.short;
  return (
    <div className={baseClasses} style={{ backgroundColor: meta.color }}>
      {displayChar}
    </div>
  );
}
