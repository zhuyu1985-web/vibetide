"use client";

import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <div className="flex flex-col items-center gap-4 pt-4 pb-2">
      {/* Status badge */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
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

      {/* Title */}
      <motion.div
        className="flex flex-col items-center gap-2 text-center"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          你的智媒工作空间
        </h1>
        <p className="text-base text-muted-foreground">
          与 AI 团队协作，高效完成内容生产
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-xs font-medium
            text-indigo-600 dark:text-indigo-400 bg-indigo-500/8 hover:bg-indigo-500/15
            transition-all duration-200 group"
        >
          <MessageSquare size={13} />
          进入对话中心
          <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </div>
  );
}
