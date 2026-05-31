import { cn } from "@/lib/utils";

interface VideoEmbedProps {
  src: string;
  title?: string;
  poster?: string;
  className?: string;
}

/**
 * 16:9 iframe 包装,支持 B 站 / 腾讯视频 / YouTube 嵌入。
 * lazy loading 减少首屏负担。poster 字段保留 API 兼容,iframe 本身不显示 poster,
 * 由上游通过 src 中的封面参数控制。
 */
export function VideoEmbed({
  src,
  title = "视频",
  className,
}: VideoEmbedProps) {
  return (
    <div
      className={cn(
        "my-6 aspect-video w-full overflow-hidden rounded-lg bg-black ring-1 ring-border/60",
        className,
      )}
    >
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}
