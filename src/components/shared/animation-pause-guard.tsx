"use client";

import { useEffect } from "react";

/**
 * 全局动画暂停守卫 —— 页面隐藏(切 tab/最小化)或窗口失焦(切到别的 app)时,
 * 给 <html> 打 data-anim-paused,由 globals.css 把全站 CSS 动画整体
 * `animation-play-state: paused`。配合粒子画布 / gemini 环各自的 JS 失焦暂停,
 * 实现"用户不在看时,这个标签页完全不烧 GPU/CPU"。
 *
 * 解决的是"开着 /home 切去别的 app,Vibetide 后台继续满速跑动画把电脑烤热"——
 * 这类后台占用对用户完全不可见,暂停零体验损失。回到窗口立即恢复。
 *
 * 只渲染副作用,无 DOM 输出。挂在 dashboard layout 覆盖全部仪表盘页面。
 */
export function AnimationPauseGuard() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const paused = document.hidden || !document.hasFocus();
      if (paused) root.setAttribute("data-anim-paused", "");
      else root.removeAttribute("data-anim-paused");
    };

    apply();
    document.addEventListener("visibilitychange", apply);
    window.addEventListener("blur", apply);
    window.addEventListener("focus", apply);

    return () => {
      document.removeEventListener("visibilitychange", apply);
      window.removeEventListener("blur", apply);
      window.removeEventListener("focus", apply);
      root.removeAttribute("data-anim-paused");
    };
  }, []);

  return null;
}
