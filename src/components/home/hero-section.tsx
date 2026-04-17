"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";

const TITLE = "你的智媒工作空间";

export function HeroSection() {
  const [displayedChars, setDisplayedChars] = useState(0);
  const [titleDone, setTitleDone] = useState(false);

  // Typewriter effect for title
  useEffect(() => {
    const delay = setTimeout(() => {
      if (displayedChars < TITLE.length) {
        const timer = setInterval(() => {
          setDisplayedChars((prev) => {
            if (prev >= TITLE.length) {
              clearInterval(timer);
              return prev;
            }
            return prev + 1;
          });
        }, 80);
        return () => clearInterval(timer);
      }
    }, 400); // initial delay before typing starts
    return () => clearTimeout(delay);
  }, [displayedChars]);

  // Mark title as done when all chars are typed
  useEffect(() => {
    if (displayedChars >= TITLE.length && !titleDone) {
      const t = setTimeout(() => setTitleDone(true), 200);
      return () => clearTimeout(t);
    }
  }, [displayedChars, titleDone]);

  return (
    <div className="flex flex-col items-center gap-4 pt-4 pb-2">
      {/* Status badge — fades in first */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            超级个体已就绪 · 8 位专家待命
          </span>
        </div>
      </motion.div>

      {/* Title — typewriter effect */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {TITLE.slice(0, displayedChars)}
          {displayedChars < TITLE.length && (
            <span className="inline-block w-[3px] h-[1.1em] bg-indigo-500 dark:bg-indigo-400 ml-0.5 align-middle animate-blink" />
          )}
        </h1>

        {/* Subtitle + link — fade in after title finishes */}
        <AnimatePresence>
          {titleDone && (
            <motion.div
              className="flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <p className="text-base text-muted-foreground">
                与 AI 团队协作，高效完成内容生产
              </p>
              <Link
                href="/chat"
                className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-xs font-medium
                  text-blue-600 dark:text-blue-400 bg-blue-500/8 hover:bg-blue-500/15
                  transition-all duration-200 group"
              >
                <MessageSquare size={13} />
                进入对话中心
                <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
