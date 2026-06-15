import { cn } from "@/lib/utils";

/**
 * 极光流光背景 —— 替代原 Canvas2D 粒子背景(后者全屏逐帧重绘 + 顶栏/卡片模糊
 * 跟着每帧重算,实测占 /home GPU 一半,见 [[playwright-mcp-cannot-measure-gpu]])。
 *
 * 实现原理(为什么几乎不耗 CPU/GPU):
 * - 3 个柔光球,`filter: blur()` 把模糊**烘焙进图层、只光栅化一次**;
 * - 动画只用 `transform: translate/scale` —— 纯合成器变换,无主线程 JS、无逐帧重绘;
 * - 无 `<canvas>`、无 requestAnimationFrame,和其他"有效果但不费 CPU"的页面同一类。
 * 失焦/隐藏时由 <AnimationPauseGuard> 通过 animation-play-state 整体冻结。
 *
 * 样式见 globals.css "Aurora ambient background"。纯展示组件,无客户端逻辑。
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("aurora-bg", className)} aria-hidden>
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
    </div>
  );
}
