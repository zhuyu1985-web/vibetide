"use client";

import { useState } from "react";
import { ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ScreenshotZoomProps {
  src: string;
  alt?: string;
  caption?: string;
  className?: string;
}

/**
 * MDX 内嵌截图:点击放大全屏 lightbox。
 * 为简化实现,使用原生 <img loading="lazy">,放弃 next/image 优化
 * (文档图片尺寸不固定,且首屏外懒加载已经够)。
 */
export function ScreenshotZoom({
  src,
  alt = "",
  caption,
  className,
}: ScreenshotZoomProps) {
  const [open, setOpen] = useState(false);

  return (
    <figure className={cn("my-6", className)}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <div className="group relative cursor-zoom-in overflow-hidden rounded-lg ring-1 ring-border/60 transition-shadow hover:ring-sky-300/60 hover:shadow-md">
            {}
            <img
              src={src}
              alt={alt}
              loading="lazy"
              className="block h-auto w-full"
            />
            <div className="pointer-events-none absolute right-2 top-2 flex size-8 items-center justify-center rounded-md bg-slate-900/70 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <ZoomIn className="size-4" aria-hidden />
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-[min(96vw,1600px)] p-2 sm:max-w-[min(96vw,1600px)]">
          <DialogTitle className="sr-only">{alt || "截图预览"}</DialogTitle>
          {}
          <img
            src={src}
            alt={alt}
            className="block max-h-[88vh] w-full rounded-md object-contain"
          />
        </DialogContent>
      </Dialog>
      {caption ? (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
