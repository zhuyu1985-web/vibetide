"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypewriterTextProps {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
  highlightWords?: Record<string, string>;
}

export function TypewriterText({
  text,
  delay = 0.3,
  speed = 80,
  className,
  highlightWords,
}: TypewriterTextProps) {
  const [displayedCount, setDisplayedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);

  useEffect(() => {
    setDisplayedCount(0);
    setIsComplete(false);
    setShowHighlights(false);

    const startTimeout = setTimeout(() => {
      let current = 0;
      const interval = setInterval(() => {
        current += 1;
        setDisplayedCount(current);
        if (current >= text.length) {
          clearInterval(interval);
          setIsComplete(true);
          setTimeout(() => setShowHighlights(true), 300);
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(startTimeout);
  }, [text, delay, speed]);

  const renderedContent = useMemo(() => {
    const visibleText = text.slice(0, displayedCount);

    if (!highlightWords || !showHighlights) {
      return <>{visibleText}</>;
    }

    const entries = Object.entries(highlightWords);
    const parts: { text: string; highlight?: string }[] = [];
    let remaining = visibleText;

    while (remaining.length > 0) {
      let earliestIndex = remaining.length;
      let matchedWord = "";
      let matchedGradient = "";

      for (const [word, gradient] of entries) {
        const idx = remaining.indexOf(word);
        if (idx !== -1 && idx < earliestIndex) {
          earliestIndex = idx;
          matchedWord = word;
          matchedGradient = gradient;
        }
      }

      if (matchedWord) {
        if (earliestIndex > 0) {
          parts.push({ text: remaining.slice(0, earliestIndex) });
        }
        parts.push({
          text: matchedWord,
          highlight: matchedGradient,
        });
        remaining = remaining.slice(earliestIndex + matchedWord.length);
      } else {
        parts.push({ text: remaining });
        remaining = "";
      }
    }

    return (
      <>
        {parts.map((part, i) =>
          part.highlight ? (
            <motion.span
              key={`${i}-hl`}
              initial={{ opacity: 0.7, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={cn("bg-clip-text text-transparent", part.highlight)}
            >
              {part.text}
            </motion.span>
          ) : (
            <span key={`${i}-plain`}>{part.text}</span>
          )
        )}
      </>
    );
  }, [displayedCount, text, highlightWords, showHighlights]);

  return (
    <span className={cn("inline", className)}>
      {renderedContent}
      <AnimatePresence>
        {!isComplete && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.1em] bg-current"
            style={{
              animation: "blink 1s step-end infinite",
            }}
          />
        )}
      </AnimatePresence>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}
