"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, MessagesSquare, type LucideIcon } from "lucide-react";

import { LATEST_CHANGELOG_AT } from "@/lib/help/changelog-meta";
import { cn } from "@/lib/utils";

import { XiaobangAvatar } from "./xiaobang-avatar";

/**
 * 小帮 · 助手浮动入口
 * - 主入口: 小帮 SVG (永远可见)
 * - hover / click 展开 2 个子按钮: 对话中心 / 帮助中心(替代独立 ChatLauncher)
 * - 5 态机: idle / hover / active / wave / first-tip + 红点 badge
 * - ? Shift+/ 全局快捷键直跳 /help
 * - dashboard-shell 内 only,/help 内自动隐藏
 * spec: docs/superpowers/specs/2026-05-31-help-center-design.md §4
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

interface SubAction {
  id: "chat" | "help";
  href: string;
  icon: LucideIcon;
  label: string; // 气泡文字
  ariaLabel: string;
  bg: string; // 圆形按钮背景色
  iconColor: string;
}

// 顺序: 越靠后 fly-out 越靠近主按钮(因外层 flex-col-reverse)
// 视觉上 chat 在上,help 在下 (主按钮上方紧邻)
const SUB_ACTIONS: SubAction[] = [
  {
    id: "chat",
    href: "/cowork",
    icon: MessagesSquare,
    label: "需要对话吗?",
    ariaLabel: "打开对话中心",
    bg: "bg-blue-600",
    iconColor: "text-white",
  },
  {
    id: "help",
    href: "/help",
    icon: BookOpen,
    label: "需要帮助吗?",
    ariaLabel: "打开帮助中心",
    bg: "bg-amber-100 dark:bg-amber-900/70 ring-1 ring-amber-200/60 dark:ring-amber-700/60",
    iconColor: "text-amber-700 dark:text-amber-200",
  },
];

// hover-intent 延迟收起 ms(防鼠标穿越 gap 时立刻 collapse)
const COLLAPSE_DELAY_MS = 200;

export function HelpLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [hoveredSub, setHoveredSub] = useState<string | null>(null);
  const [showFirstTip, setShowFirstTip] = useState(false);
  const [waving, setWaving] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hover-intent: 鼠标进入容器立即取消待执行的收起
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // hover-intent: 鼠标离开容器后延迟收起(给用户时间穿越 gap 拐回来)
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setExpanded(false);
      closeTimerRef.current = null;
    }, COLLAPSE_DELAY_MS);
  }, [cancelClose]);

  // 卸载时清理 timer
  useEffect(() => () => cancelClose(), [cancelClose]);

  // 红点 badge: 本地存的"上次看到 changelog 时间" < 当前 changelog 时间 → 显示
  useEffect(() => {
    if (LATEST_CHANGELOG_AT === 0) {
      setHasUnread(false);
      return;
    }
    try {
      const seenAt = Number(localStorage.getItem(CHANGELOG_SEEN_KEY) ?? "0");
      setHasUnread(seenAt < LATEST_CHANGELOG_AT);
    } catch {
      setHasUnread(false);
    }
  }, []);

  // first-tip: 终身一次,5 秒后弹,3 秒后收
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
        // ignore
      }
      dismissTimer = setTimeout(
        () => setShowFirstTip(false),
        FIRST_TIP_DURATION_MS,
      );
    }, FIRST_TIP_DELAY_MS);
    return () => {
      if (openTimer) clearTimeout(openTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  // 30 秒无活动 → 招手 (同 session ≤ 3 次,相邻 ≥ 5 分钟)
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let waveDismissTimer: ReturnType<typeof setTimeout> | undefined;

    const triggerWave = () => {
      try {
        const count = Number(sessionStorage.getItem(WAVE_COUNT_KEY) ?? "0");
        if (count >= WAVE_MAX_PER_SESSION) return;
        const lastAt = Number(sessionStorage.getItem(WAVE_LAST_AT_KEY) ?? "0");
        if (Date.now() - lastAt < WAVE_INTERVAL_MS) {
          idleTimer = setTimeout(triggerWave, IDLE_MS);
          return;
        }
        sessionStorage.setItem(WAVE_COUNT_KEY, String(count + 1));
        sessionStorage.setItem(WAVE_LAST_AT_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      if (waveDismissTimer) clearTimeout(waveDismissTimer);
      setWaving(true);
      waveDismissTimer = setTimeout(() => setWaving(false), WAVE_DURATION_MS);
    };

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(triggerWave, IDLE_MS);
    };

    const events = ["mousemove", "keydown", "scroll"] as const;
    events.forEach((e) =>
      window.addEventListener(e, resetIdle, { passive: true }),
    );
    resetIdle();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (waveDismissTimer) clearTimeout(waveDismissTimer);
      events.forEach((e) => window.removeEventListener(e, resetIdle));
    };
  }, []);

  // ? Shift+/ 全局快捷键 → 跳 /help (输入框内不触发)
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

  // 跳 /help 时同步红点为"已看"
  const markChangelogSeen = useCallback(() => {
    if (LATEST_CHANGELOG_AT === 0) return;
    try {
      localStorage.setItem(CHANGELOG_SEEN_KEY, String(LATEST_CHANGELOG_AT));
      setHasUnread(false);
    } catch {
      // ignore
    }
  }, []);

  // /help 内不显示自身
  if (pathname?.startsWith("/help")) return null;

  // 主按钮 idle 气泡 (未展开时显示 first-tip / wave / unread 提示)
  const idleBubbleText = waving
    ? "在这里呢 ✋"
    : showFirstTip
      ? "第一次来?这里有使用指南 →"
      : hasUnread
        ? "有新公告 →"
        : null;
  const showIdleBubble = !expanded && (waving || showFirstTip || hasUnread);

  return (
    // flex-col-reverse: 主按钮 (DOM 第 1) 在视觉底部,子按钮组 (DOM 第 2) 在主按钮上方
    // gap-3 = 12px 间距在 flex layout 内,鼠标穿越仍在容器 hit area 内 → 不触发 mouseleave
    // hover-intent: enter cancel close, leave 延迟 200ms (子按钮渲染中拐回主按钮也安全)
    <div
      className="fixed bottom-6 right-6 z-50 select-none max-md:bottom-4 max-md:right-4 flex flex-col-reverse items-end gap-3"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {/* 主入口: 小帮 (button 而非 Link,因为现在主要是 toggle 而非导航) */}
      <button
        type="button"
        aria-label="助手菜单"
        aria-expanded={expanded}
        onMouseEnter={() => {
          cancelClose();
          setExpanded(true);
        }}
        onClick={() => setExpanded((v) => !v)}
        className="relative block bg-transparent border-0 p-0 cursor-pointer"
      >
        <motion.div
          whileHover={{ scale: 1.08, rotate: -8 }}
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
      </button>

      {/* 主按钮 idle 气泡 — 展开时隐藏避免与子按钮 tooltip 冲突 */}
      <AnimatePresence>
        {showIdleBubble && idleBubbleText && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.9 }}
            transition={{ duration: 0.18, ease: [0.22, 0.68, 0.35, 1.0] }}
            className="absolute right-16 bottom-2 whitespace-nowrap px-3 py-2 rounded-xl bg-popover/95 backdrop-blur-xl border border-border/60 shadow-lg text-[13px] font-medium text-foreground pointer-events-none max-md:right-14"
          >
            {idleBubbleText}
            <span
              aria-hidden
              className="absolute -right-1.5 bottom-3 w-3 h-3 rotate-45 bg-popover/95 border-r border-t border-border/60"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* hover/click 展开的 2 个子按钮: 对话 + 帮助
          flow-in (非 absolute),作为外层 flex-col-reverse 的第 2 个 child,
          视觉上撑在主按钮上方,gap-3 由外层提供 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex flex-col-reverse items-end gap-3"
          >
            {SUB_ACTIONS.map((action, i) => {
              const Icon = action.icon;
              const isHovered = hoveredSub === action.id;
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 12, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.6 }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 22,
                    delay: i * 0.04,
                  }}
                  className="relative"
                  onMouseEnter={() => setHoveredSub(action.id)}
                  onMouseLeave={() => setHoveredSub(null)}
                >
                  <Link
                    href={action.href}
                    aria-label={action.ariaLabel}
                    onClick={() => {
                      if (action.id === "help") markChangelogSeen();
                      setExpanded(false);
                    }}
                    className={cn(
                      "flex items-center justify-center w-11 h-11 rounded-full shadow-lg",
                      "transition-transform hover:scale-110 active:scale-95",
                      action.bg,
                    )}
                  >
                    <Icon size={18} className={action.iconColor} />
                  </Link>
                  {/* 子按钮 tooltip (左侧弹出) */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 6 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-full top-1/2 -translate-y-1/2 mr-3 whitespace-nowrap px-3 py-1.5 rounded-lg bg-popover/95 backdrop-blur-xl border border-border/60 shadow text-[12px] font-medium text-foreground pointer-events-none"
                      >
                        {action.label}
                        <span
                          aria-hidden
                          className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-popover/95 border-r border-t border-border/60"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
