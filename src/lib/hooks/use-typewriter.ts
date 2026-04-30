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
 * `replayKey` controls dedup: the same key value reappearing in a later render
 * (e.g. after re-mount or React StrictMode double-invoke) will NOT replay the
 * animation — the full text is shown immediately. Pass `null` to opt out of
 * animation entirely.
 */
export function useTypewriter(
  text: string,
  charsPerSec: number,
  replayKey: string | null,
): string {
  const playedKeysRef = useRef<Set<string>>(new Set());
  const startedAtRef = useRef<number | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  const alreadyPlayed = replayKey !== null && playedKeysRef.current.has(replayKey);
  const shouldAnimate = replayKey !== null && !alreadyPlayed && charsPerSec > 0 && text.length > 0;

  // Reset start timestamp when key changes and animation should play.
  if (replayKey !== lastKeyRef.current) {
    lastKeyRef.current = replayKey;
    startedAtRef.current = shouldAnimate ? performance.now() : null;
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
      setRevealed(text.slice(0, len));
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
