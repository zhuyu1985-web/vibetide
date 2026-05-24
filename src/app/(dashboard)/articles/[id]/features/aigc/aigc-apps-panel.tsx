"use client";

/**
 * 左栏「AIGC 应用」面板。
 *
 * 列出 8 张能力卡片占位（Phase 2 不实接，第二期接 dashscope / fal / 火山方舟）。
 * 点击 → 提示「即将上线」。
 */

import { toast } from "sonner";
import {
  Image as ImageIcon,
  Sparkles,
  Eraser,
  Wand2,
  Film,
  Mic2,
  ScanText,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AIGCApp {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  accent: string;
}

const APPS: AIGCApp[] = [
  {
    id: "t2i",
    title: "文生图",
    desc: "用文本描述生成图片，配图、海报、插画",
    icon: ImageIcon,
    accent: "from-blue-500/15 to-cyan-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    id: "i2i",
    title: "图生图",
    desc: "基于参考图重绘 / 变换风格",
    icon: Wand2,
    accent: "from-violet-500/15 to-fuchsia-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    id: "bg-remove",
    title: "背景抠除",
    desc: "一键去背景，保留主体",
    icon: Eraser,
    accent: "from-amber-500/15 to-orange-500/15 text-amber-700 dark:text-amber-400",
  },
  {
    id: "t2v",
    title: "文生视频",
    desc: "用文本生成 10s-30s 短视频",
    icon: Film,
    accent: "from-rose-500/15 to-pink-500/15 text-rose-600 dark:text-rose-400",
  },
  {
    id: "tts",
    title: "语音合成",
    desc: "把正文一键转为人声朗读音频",
    icon: Mic2,
    accent: "from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-400",
  },
  {
    id: "smart-cover",
    title: "智能配图",
    desc: "根据稿件内容 AI 推荐配图",
    icon: Sparkles,
    accent: "from-indigo-500/15 to-purple-500/15 text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "ocr",
    title: "图片识字",
    desc: "OCR 识别图片中的文字",
    icon: ScanText,
    accent: "from-cyan-500/15 to-blue-500/15 text-cyan-700 dark:text-cyan-400",
  },
  {
    id: "layout",
    title: "智能排版",
    desc: "AI 自动重组段落 + 配图",
    icon: Layers,
    accent: "from-pink-500/15 to-rose-500/15 text-pink-600 dark:text-pink-400",
  },
];

export function AigcAppsPanel() {
  const handleClick = (app: AIGCApp) => {
    toast.info(`「${app.title}」即将上线，敬请期待`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[var(--glass-border)] shrink-0">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          AI 内容创作工具集，结合稿件正文一键生成图片 / 视频 / 音频 等素材。
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2">
        {APPS.map((app) => {
          const Icon = app.icon;
          return (
            <button
              key={app.id}
              onClick={() => handleClick(app)}
              className={cn(
                "aspect-[16/9] flex items-center gap-2 p-2 rounded-lg bg-gradient-to-br hover:scale-[1.02] active:scale-[0.98] transition-transform overflow-hidden",
                app.accent,
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5 text-left">
                <span className="text-xs font-medium leading-tight truncate w-full">{app.title}</span>
                <span className="text-[10px] text-muted-foreground leading-snug truncate w-full">
                  {app.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
