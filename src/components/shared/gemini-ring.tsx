"use client";

import { useEffect, useRef } from "react";

/**
 * Gemini 渐变流光环驱动器 —— 放在 .gemini-border 容器内。
 *
 * 自身不渲染可见 DOM,只以 30fps 更新父容器的 --gemini-angle,驱动
 * .gemini-border::before 的 conic-gradient 起始角(环的视觉结构与最初版完全一致)。
 *
 * 性能史(两个都不要走回头路):
 * 1. 旧版纯 CSS:@property --gemini-angle 动画 —— 不可合成,主线程每帧重绘
 *    渐变 + 双层 mask,120Hz 屏 = 每秒 120 次 paint,渲染进程常驻大头。
 * 2. 2026-06-11 曾改成"大正方形渐变层 transform 旋转 + 父层 mask 裁环"——
 *    渲染进程是省了,但被 mask 的旋转合成层让 Chrome GPU 进程每帧对
 *    ~876×876 离屏表面做 mask 合成,实测 GPU 进程 CPU 飙到 98%,更糟。
 * 现方案:JS 30fps 改 CSS 变量 → 每秒只 30 次小区域 paint(比旧版省 75%),
 * 无新增合成层;页面隐藏 / 窗口失焦 / 容器不可见时完全暂停。
 */

const ROTATE_PERIOD_MS = 6000; // 360° / 6s,与旧版 CSS 动画速度一致
const FRAME_INTERVAL = 1000 / 30;

export function GeminiRing() {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = anchorRef.current?.parentElement;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return; // 静止环(angle 固定 0°),与 reduce 块行为一致

    let raf = 0;
    let last = -Infinity;
    let visible = !document.hidden;
    let focused = document.hasFocus();
    let inView = true;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_INTERVAL - 1) return;
      last = now;
      const angle = ((now % ROTATE_PERIOD_MS) / ROTATE_PERIOD_MS) * 360;
      host.style.setProperty("--gemini-angle", `${angle.toFixed(1)}deg`);
    };

    const sync = () => {
      const shouldRun = visible && focused && inView;
      if (shouldRun && !raf) {
        raf = requestAnimationFrame(tick);
      } else if (!shouldRun && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onVisibility = () => { visible = !document.hidden; sync(); };
    // 窗口失焦(如切到别的 app 但窗口仍可见)时暂停 —— 后台挂机不烧 CPU
    const onBlur = () => { focused = false; sync(); };
    const onFocus = () => { focused = true; sync(); };
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) inView = e.isIntersecting;
      sync();
    }, { threshold: 0.01 });

    observer.observe(host);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return <span ref={anchorRef} aria-hidden className="hidden" />;
}
