"use client";

/**
 * 右二列「基本信息」面板（对齐参考图 #5）。
 *
 * 顶部：[AI 帮填] 紫色按钮 + 「同步」文字按钮
 * 表单：
 *   - 提交至通稿库（dropdown）
 *   - 作者
 *   - 来源
 *   - 摘要（含 AI 图标 + 0/255 计数）
 *   - 关键词（含 ? 帮助 + AI 图标）
 *   - * 列表样式（眼睛预览 + AI 图标 + chip 6 项）
 *   - 封面图（上传方框 + 16:9 提示）
 */

import { useState, useTransition } from "react";
import { Sparkles, Eye, HelpCircle, Plus, RefreshCw, Loader2 } from "lucide-react";
import { updateArticle } from "@/app/actions/articles";
import { cn } from "@/lib/utils";

const LIST_STYLE_OPTIONS = [
  { value: "default", label: "默认" },
  { value: "single_image", label: "单图" },
  { value: "multi_image", label: "多图" },
  { value: "title", label: "标题" },
  { value: "narrow", label: "窄图" },
  { value: "seamless", label: "无缝" },
] as const;

const SUBMIT_LIBRARY_OPTIONS = [
  { value: "feature_news", label: "转载稿件" },
  { value: "original_news", label: "原创新闻" },
  { value: "industry", label: "行业资讯" },
  { value: "overseas_en", label: "海外英文" },
];

interface ArticleInfoPanelProps {
  articleId: string;
  initial: {
    authorName?: string;
    sourceName?: string;
    summary?: string;
    keywords?: string[];
    coverImageUrl?: string;
    shareImageUrl?: string;
    listStyle?: string;
  };
}

export function ArticleInfoPanel({ articleId, initial }: ArticleInfoPanelProps) {
  const [submitLibrary, setSubmitLibrary] = useState("feature_news");
  const [author, setAuthor] = useState(initial.authorName ?? "");
  const [source, setSource] = useState(initial.sourceName ?? "");
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [keywordsRaw, setKeywordsRaw] = useState((initial.keywords ?? []).join(" "));
  const [coverUrl, setCoverUrl] = useState(initial.coverImageUrl ?? "");
  const [listStyle, setListStyle] = useState(initial.listStyle ?? "default");
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const handleSave = () => {
    const keywords = keywordsRaw
      .split(/[\s,，]+/)
      .map((w) => w.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        await updateArticle(articleId, {
          summary: summary || undefined,
          keywords,
          coverImageUrl: coverUrl || null,
          listStyle: listStyle || null,
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶部：AI 帮填 + 同步 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] shrink-0">
        <button
          onClick={() => alert("「AI 帮填」即将上线，将根据稿件正文自动填充摘要 / 关键词 / 列表样式")}
          className="h-7 px-3 rounded-md bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" />
          AI 帮填
        </button>
        <button
          onClick={handleSave}
          disabled={pending}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors flex items-center gap-1"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {saveStatus === "saved" ? "已同步" : "同步"}
        </button>
      </div>

      {/* 表单 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <FieldGroup label="提交至通稿库">
          <select
            value={submitLibrary}
            onChange={(e) => setSubmitLibrary(e.target.value)}
            className="w-full rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-400/30"
          >
            {SUBMIT_LIBRARY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FieldGroup>

        <FieldGroup label="作者">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="作者署名"
            className="w-full rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-400/30"
          />
        </FieldGroup>

        <FieldGroup label="来源">
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="稿件来源"
            className="w-full rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-400/30"
          />
        </FieldGroup>

        <FieldGroup
          label="摘要"
          iconRight={<AiHint />}
          hint={`${summary.length} / 255`}
        >
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="请输入摘要"
            rows={3}
            maxLength={255}
            className="w-full resize-none rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-400/30"
          />
        </FieldGroup>

        <FieldGroup
          label="关键词"
          iconLeft={<span title="多关键词请用空格分隔" className="inline-flex"><HelpCircle className="h-3 w-3 text-muted-foreground" /></span>}
          iconRight={<AiHint />}
        >
          <input
            type="text"
            value={keywordsRaw}
            onChange={(e) => setKeywordsRaw(e.target.value)}
            placeholder="请输入关键词"
            className="w-full rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-400/30"
          />
        </FieldGroup>

        <FieldGroup
          label="* 列表样式"
          iconRight={
            <span className="flex items-center gap-1.5">
              <Eye className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">预览</span>
              <AiHint />
            </span>
          }
        >
          <div className="flex flex-wrap gap-1">
            {LIST_STYLE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setListStyle(o.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] transition-colors",
                  listStyle === o.value
                    ? "bg-blue-500 text-white"
                    : "bg-muted/30 dark:bg-white/5 text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup
          label="分享图"
          iconLeft={<span title="点击上传 16:9 封面图，将显示在文章列表与分享链接" className="inline-flex"><HelpCircle className="h-3 w-3 text-muted-foreground" /></span>}
        >
          {coverUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="封面" className="w-full aspect-video object-cover rounded-lg" />
              <button
                onClick={() => setCoverUrl("")}
                className="absolute top-1 right-1 px-2 py-0.5 rounded bg-black/60 text-white text-[10px]"
              >
                重新上传
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                const url = window.prompt("请输入封面图 URL（后续接资源库选择器）");
                if (url) setCoverUrl(url);
              }}
              className="w-full aspect-video border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground hover:border-blue-400/50 hover:bg-blue-50/40 dark:hover:bg-blue-500/[0.05] transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs">点击上传封面图</span>
              <span className="text-[10px] opacity-60">建议比例 16:9</span>
            </button>
          )}
        </FieldGroup>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  iconLeft,
  iconRight,
  hint,
  children,
}: {
  label: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          <label className="text-[11px] font-medium text-foreground">{label}</label>
          {iconLeft}
        </div>
        {(iconRight || hint) && (
          <div className="flex items-center gap-2">
            {iconRight}
            {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function AiHint() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 text-white text-[9px]">
      ✦
    </span>
  );
}
