"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pure helper: how many characters of `text` should be revealed at time `now`,
 * given the typewriter started at `startedAt` with speed `charsPerSec`.
 *
 * - Returns 0 when text is empty.
 * - Returns full text length when `charsPerSec <= 0` (animation disabled).
 * - Clamps to `text.length`.
 */
export function nextRevealLength(
  text: string,
  startedAt: number,
  charsPerSec: number,
  now: number,
): number {
  if (!text) return 0;
  if (charsPerSec <= 0) return text.length;
  const elapsedSec = Math.max(0, (now - startedAt) / 1000);
  const wanted = Math.floor(elapsedSec * charsPerSec);
  return Math.min(text.length, wanted);
}

/**
 * Typewriter hook that reveals `text` character-by-character.
 *
 * 注意（dedup 行为，请如实理解）：
 * `playedKeysRef` 是 useRef，作用域 = 当前组件的当前 mount。
 * - 同一次 mount 里，相同 `replayKey` 再次出现（StrictMode 双触发 / 父组件 re-render
 *   导致 props 不变地复用同一 hook 实例）不会重放——直接整段显示。
 * - 一旦组件真正 unmount → remount（例如切换聊天对象后切回来），ref 会重建，
 *   该 mount 内已"播完"的步骤会再次从头打字。
 *
 * 跨 mount 的全局 dedup 需要把已播 key 提到 Context / Module 级 state，
 * 不在这个 hook 的职责范围内。Pass `null` to opt out of animation entirely.
 */
export function useTypewriter(
  text: string,
  charsPerSec: number,
  replayKey: string | null,
): string {
  const playedKeysRef = useRef<Set<string>>(new Set());
  const startedAtRef = useRef<number | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  // 渲染节流：上一帧已经 setState 过的 length，避免相同长度反复触发 React render
  const lastLenRef = useRef<number>(-1);

  const alreadyPlayed = replayKey !== null && playedKeysRef.current.has(replayKey);
  const shouldAnimate = replayKey !== null && !alreadyPlayed && charsPerSec > 0 && text.length > 0;

  // Reset start timestamp when key changes and animation should play.
  if (replayKey !== lastKeyRef.current) {
    lastKeyRef.current = replayKey;
    startedAtRef.current = shouldAnimate ? performance.now() : null;
    lastLenRef.current = -1;
  }

  const [revealed, setRevealed] = useState<string>(() => {
    if (!shouldAnimate) return text;
    return "";
  });

  useEffect(() => {
    if (!shouldAnimate) {
      setRevealed(text);
      return;
    }

    const startedAt = startedAtRef.current ?? performance.now();
    startedAtRef.current = startedAt;
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const len = nextRevealLength(text, startedAt, charsPerSec, performance.now());
      // 仅当 reveal 长度真正前进时再触发一次 setState，省掉同帧重复 render
      if (len !== lastLenRef.current) {
        lastLenRef.current = len;
        setRevealed(text.slice(0, len));
      }
      if (len < text.length) {
        raf = requestAnimationFrame(tick);
      } else if (replayKey !== null) {
        playedKeysRef.current.add(replayKey);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [text, charsPerSec, replayKey, shouldAnimate]);

  // If we already played this key (e.g. revisited render), surface the full text.
  if (alreadyPlayed && revealed !== text) {
    return text;
  }
  return revealed;
}
