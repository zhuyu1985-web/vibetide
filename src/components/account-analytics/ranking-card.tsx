import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RankingCardMetrics {
  likes: number;
  comments: number;
  favorites: number;
  shares: number;
}

interface RankingCardProps {
  /** 1-10，超出则用浅灰边框 */
  rank: number;
  title: string;
  /** 原文 URL,有值时标题渲染成跳转链接,带"查看原文"小标 */
  sourceUrl?: string | null;
  metrics: RankingCardMetrics;
  whyViralSummary?: string;
  /** 完整 attribution markdown；轻量模式（无归因）不传 */
  attributionMarkdown?: string;
  tags: string[];
  className?: string;
  /**
   * 轻量模式 —— 用于 6-10 名无 AI 归因的视频。
   * - 隐藏 whyViralSummary 黄框
   * - 隐藏 attributionMarkdown 正文
   * - 显示"暂无深度归因"占位 + 触发按钮
   */
  compact?: boolean;
  /** 轻量模式右下角"生成 AI 归因"按钮的点击回调 */
  onRequestAttribution?: () => void;
}

const RANK_BADGE: Record<
  number,
  { bg: string; emoji: string; border: string }
> = {
  1: {
    bg: "bg-gradient-to-br from-[#FFD700] to-[#FFA500]",
    emoji: "🥇",
    border: "border-[#FFD700]",
  },
  2: {
    bg: "bg-gradient-to-br from-[#B0BEC5] to-[#78909C]",
    emoji: "🥈",
    border: "border-[#B0BEC5]",
  },
  3: {
    bg: "bg-gradient-to-br from-[#CD7F32] to-[#A0522D]",
    emoji: "🥉",
    border: "border-[#CD7F32]",
  },
  4: {
    bg: "bg-gradient-to-br from-[#2E75B6] to-[#1F3864]",
    emoji: "④",
    border: "border-[#2E75B6]",
  },
  5: {
    bg: "bg-gradient-to-br from-[#5BA4D8] to-[#2E75B6]",
    emoji: "⑤",
    border: "border-[#5BA4D8]",
  },
  6: { bg: "bg-gradient-to-br from-[#94A3B8] to-[#64748B]", emoji: "⑥", border: "border-[#CBD5E1]" },
  7: { bg: "bg-gradient-to-br from-[#94A3B8] to-[#64748B]", emoji: "⑦", border: "border-[#CBD5E1]" },
  8: { bg: "bg-gradient-to-br from-[#94A3B8] to-[#64748B]", emoji: "⑧", border: "border-[#CBD5E1]" },
  9: { bg: "bg-gradient-to-br from-[#94A3B8] to-[#64748B]", emoji: "⑨", border: "border-[#CBD5E1]" },
  10: { bg: "bg-gradient-to-br from-[#94A3B8] to-[#64748B]", emoji: "⑩", border: "border-[#CBD5E1]" },
};

function getBadge(rank: number) {
  return RANK_BADGE[rank] ?? {
    bg: "bg-gradient-to-br from-[#94A3B8] to-[#64748B]",
    emoji: String(rank),
    border: "border-[#CBD5E1]",
  };
}

/**
 * 排行榜卡片 —— Top N 爆款逐条归因。
 * 视觉对齐 BRTV HTML 样张的 .ana-card 区块。
 *
 * attributionMarkdown 内支持轻量级 markdown：**加粗**、*斜体* 与换行。
 * Phase 1 用最小 markdown 渲染避免引入额外依赖；Phase 2 接 LLM 输出再考虑
 * 是否上 react-markdown。
 */
export function RankingCard({
  rank,
  title,
  sourceUrl,
  metrics,
  whyViralSummary,
  attributionMarkdown,
  tags,
  className,
  compact,
  onRequestAttribution,
}: RankingCardProps) {
  const badge = getBadge(rank);
  const isCompact = compact || !attributionMarkdown;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white dark:bg-gray-900 shadow-[0_2px_10px_rgba(0,0,0,0.05)]",
        badge.border,
        "border-2",
        isCompact ? "p-4 sm:p-5" : "p-5 sm:p-6",
        className,
      )}
    >
      {/* Header — badge + title(可跳转原文) */}
      <div className={cn("flex items-start gap-3", isCompact ? "mb-3" : "mb-4")}>
        <div
          className={cn(
            "shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold text-white",
            badge.bg,
          )}
        >
          {badge.emoji}
        </div>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex-1 inline-flex items-start gap-1.5 text-[15px] font-semibold leading-snug text-[#1F3864] dark:text-blue-200 hover:text-[#2E75B6] dark:hover:text-blue-300 transition-colors"
            title="点击在新标签页查看原文"
          >
            <span className="flex-1">{title}</span>
            <ExternalLink
              size={14}
              className="shrink-0 mt-1 text-gray-400 group-hover:text-[#2E75B6] dark:group-hover:text-blue-300 transition-colors"
            />
          </a>
        ) : (
          <h4 className="flex-1 text-[15px] font-semibold leading-snug text-[#1F3864] dark:text-blue-200">
            {title}
          </h4>
        )}
      </div>

      {/* Stat pills */}
      <div className={cn("flex flex-wrap gap-2", isCompact ? "mb-2" : "mb-3")}>
        <StatPill color="#E84057" label="👍" value={metrics.likes} />
        <StatPill color="#2E75B6" label="💬" value={metrics.comments} />
        <StatPill color="#2A9D8F" label="⭐" value={metrics.favorites} />
        <StatPill color="#E9A820" label="↗" value={metrics.shares} />
      </div>

      {/* 完整模式：why-viral + attribution */}
      {!isCompact && (
        <>
          {whyViralSummary && (
            <div className="mb-3 rounded-lg border-l-[3px] border-[#2E75B6] bg-[#EEF4FB] dark:bg-blue-950/30 px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
              {whyViralSummary}
            </div>
          )}
          {attributionMarkdown && (
            <MarkdownLite
              text={attributionMarkdown}
              className="text-[13.5px] text-gray-600 dark:text-gray-400 leading-[1.85]"
            />
          )}
        </>
      )}

      {/* 轻量模式：占位 + 触发按钮 */}
      {isCompact && (
        <div className="flex flex-wrap items-center gap-2 mt-2 mb-1 text-[12px] text-gray-400 dark:text-gray-500">
          <span>暂无 AI 深度归因</span>
          {onRequestAttribution && (
            <button
              type="button"
              onClick={onRequestAttribution}
              className="text-[12px] text-[#2E75B6] hover:underline cursor-pointer border-0 bg-transparent p-0"
            >
              生成归因 →
            </button>
          )}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className={cn("flex flex-wrap gap-1.5", isCompact ? "mt-2" : "mt-3")}>
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-xl bg-[#EEF4FB] dark:bg-blue-950/40 text-[#2E75B6] dark:text-blue-300 text-[12px] px-2.5 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F9FF] dark:bg-blue-950/30 px-3 py-1 text-[13px] text-gray-600 dark:text-gray-300">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: color }}
      />
      <span>
        {label} {value.toLocaleString("zh-CN")}
      </span>
    </span>
  );
}

/**
 * 最简 markdown：**加粗**、*斜体*、换行。
 * 避免额外依赖。Phase 2 接 LLM 长文本时再视情况升级。
 */
function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className={className}>
      {paragraphs.map((para, idx) => (
        <p key={idx} className={idx > 0 ? "mt-2.5" : undefined}>
          {renderInline(para)}
        </p>
      ))}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // 处理 **bold** 与 *italic*。先按 ** 分段，再处理 *
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(
        ...renderItalic(text.slice(lastIdx, match.index), `${key}-pre`),
      );
    }
    parts.push(
      <strong key={`b-${key++}`} className="font-semibold text-[#1F3864] dark:text-blue-200">
        {match[1]}
      </strong>,
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(...renderItalic(text.slice(lastIdx), `${key}-tail`));
  }
  return parts;
}

function renderItalic(text: string, baseKey: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const italicRegex = /\*([^*]+)\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = italicRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    parts.push(
      <em key={`${baseKey}-i-${i++}`} className="italic text-gray-700 dark:text-gray-300">
        {match[1]}
      </em>,
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}
