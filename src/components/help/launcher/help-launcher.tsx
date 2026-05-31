"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { LATEST_CHANGELOG_AT } from "@/lib/help/changelog-meta";

import { XiaobangAvatar } from "./xiaobang-avatar";

/**
 * 小帮 · 帮助中心浮动入口
 * 5 态机:idle / hover / active / wave / first-tip
 * 详见 docs/superpowers/specs/2026-05-31-help-center-design.md §4
 */

const FIRST_TIP_KEY = "vibetide-help-launcher-first-tip-shown";
const CHANGELOG_SEEN_KEY = "vibetide-help-changelog-last-seen";
const WAVE_COUNT_KEY = "vibetide-help-wave-count";
const WAVE_LAST_AT_KEY = "vibetide-help-wave-last-at";

const IDLE_MS = 30_000;
const WAVE_INTERVAL_MS = 5 * 60_000;
const WAVE_MAX_PER_SESSION = 3;
const WAVE_DURATION_MS = 2500;
const FIRST_TIP_DELAY_MS = 5000;
const FIRST_TIP_DURATION_MS = 3000;

export function HelpLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [showFirstTip, setShowFirstTip] = useState(false);
  const [waving, setWaving] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // 红点 badge:本地存的"上次看到 changelog 时间" < 当前 changelog 时间 → 显示
  useEffect(() => {
    if (LATEST_CHANGELOG_AT === 0) {
      setHasUnread(false);
      return;
    }
    try {
      const seenAt = Number(localStorage.getItem(CHANGELOG_SEEN_KEY) ?? "0");
      setHasUnread(seenAt < LATEST_CHANGELOG_AT);
    } catch {
      // localStorage 不可用(SSR / 隐私模式)→ 安静失败
      setHasUnread(false);
    }
  }, []);

  // first-tip:终身一次,5 秒后弹,3 秒后收
  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (localStorage.getItem(FIRST_TIP_KEY)) return;
    } catch {
      return;
    }
    openTimer = setTimeout(() => {
      setShowFirstTip(true);
      try {
        localStorage.setItem(FIRST_TIP_KEY, "1");
      } catch {
        // 写不进去也无所谓,顶多多弹一次
      }
      dismissTimer = setTimeout(() => setShowFirstTip(false), FIRST_TIP_DURATION_MS);
    }, FIRST_TIP_DELAY_MS);
    return () => {
      if (openTimer) clearTimeout(openTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  // 30 秒无活动 → 招手(同 session ≤ 3 次,相邻 ≥ 5 分钟)
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let waveDismissTimer: ReturnType<typeof setTimeout> | undefined;

    const triggerWave = () => {
      try {
        const count = Number(sessionStorage.getItem(WAVE_COUNT_KEY) ?? "0");
        if (count >= WAVE_MAX_PER_SESSION) return;                       // 上限达成,本 session 不再尝试
        const lastAt = Number(sessionStorage.getItem(WAVE_LAST_AT_KEY) ?? "0");
        if (Date.now() - lastAt < WAVE_INTERVAL_MS) {
          // 5 分钟内已招手过 → 排队下一次 30 秒后再判断(避免 long-stay 用户只看到 1 次)
          idleTimer = setTimeout(triggerWave, IDLE_MS);
          return;
        }
        sessionStorage.setItem(WAVE_COUNT_KEY, String(count + 1));
        sessionStorage.setItem(WAVE_LAST_AT_KEY, String(Date.now()));
      } catch {
        // sessionStorage 不可用 → 安静失败,但仍允许这一次挥手
      }
      // 覆盖前清理,避免 timer 引用泄漏
      if (waveDismissTimer) clearTimeout(waveDismissTimer);
      setWaving(true);
      waveDismissTimer = setTimeout(() => setWaving(false), WAVE_DURATION_MS);
    };

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(triggerWave, IDLE_MS);
    };

    const events = ["mousemove", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (waveDismissTimer) clearTimeout(waveDismissTimer);
      events.forEach((e) => window.removeEventListener(e, resetIdle));
    };
  }, []);

  // ? 快捷键(Shift + /):焦点不在 input/textarea/contenteditable 时跳 /help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || !e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("[data-help-shortcut-ignore]"))
      ) {
        return;
      }
      e.preventDefault();
      if (pathname?.startsWith("/help")) {
        document
          .querySelector<HTMLInputElement>("[data-help-search-input]")
          ?.focus();
      } else {
        router.push("/help");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  // 点击瞬间,把红点状态同步为"已看",避免回来仍显示红点
  const handleClick = useCallback(() => {
    if (LATEST_CHANGELOG_AT === 0) return;
    try {
      localStorage.setItem(CHANGELOG_SEEN_KEY, String(LATEST_CHANGELOG_AT));
      setHasUnread(false);
    } catch {
      // 安静失败
    }
  }, []);

  // /help 内不显示自身(避免重复入口)
  if (pathname?.startsWith("/help")) return null;

  const bubbleText = showFirstTip
    ? "第一次来?这里有使用指南 →"
    : hasUnread
      ? "有新公告 →"
      : "需要帮助吗?  按 ? 打开";

  return (
    <div className="fixed bottom-6 left-6 z-50 select-none max-md:bottom-4 max-md:left-4">
      <Link
        href="/help"
        aria-label="打开帮助中心"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        className="block relative"
      >
        <motion.div
          whileHover={{ scale: 1.08, rotate: 8 }}
          whileTap={{ scale: 0.92, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          className="w-14 h-14 max-md:w-12 max-md:h-12 drop-shadow-[0_8px_24px_rgba(14,165,233,0.35)]"
        >
          <XiaobangAvatar className="w-full h-full" waving={waving} />
        </motion.div>
        {hasUnread && (
          <span
            aria-hidden
            className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950"
          />
        )}
      </Link>

      <AnimatePresence>
        {(hovered || showFirstTip || waving) && (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.9 }}
            transition={{ duration: 0.18, ease: [0.22, 0.68, 0.35, 1.0] }}
            className="absolute left-16 bottom-2 whitespace-nowrap px-3 py-2 rounded-xl bg-popover/95 backdrop-blur-xl border border-border/60 shadow-lg text-[13px] font-medium text-foreground pointer-events-none max-md:left-14"
          >
            {waving ? "在这里呢 ✋" : bubbleText}
            <span
              aria-hidden
              className="absolute -left-1.5 bottom-3 w-3 h-3 rotate-45 bg-popover/95 border-l border-b border-border/60"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
