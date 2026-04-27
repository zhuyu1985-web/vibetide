"use client";

import { motion } from "framer-motion";
import { ChevronDown, ArrowRight, Play } from "lucide-react";
import { HeroBackground } from "../components/hero-background";
import { ShimmerButton } from "../components/shimmer-button";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 pt-16">
      <HeroBackground />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-4xl">
        {/* Trust badge */}
        <motion.div
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary dark:border-primary/30 dark:bg-primary/15"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          数智全媒平台 · AI内容生产新范式
        </motion.div>

        {/* Main title */}
        <motion.h1
          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15] text-foreground"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          多智能体协同
          <br />
          <span className="bg-gradient-to-r from-primary to-[#22d3ee] bg-clip-text text-transparent">
            开放式内容生产引擎
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          8位AI智能体各司其职、自主协作，覆盖热点捕获到全渠道分发全链路，
          构建开放、可扩展的智能内容生产生态
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <ShimmerButton variant="primary" href="/home">
            免费开始使用
            <ArrowRight className="h-4 w-4" />
          </ShimmerButton>
          <ShimmerButton variant="outline" href="#capabilities">
            <Play className="h-4 w-4" />
            了解更多
          </ShimmerButton>
        </motion.div>

        <motion.p
          className="mt-4 text-sm text-muted-foreground/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          无需信用卡 · 免费使用 · 即刻上手
        </motion.p>

        {/* Hero product mockup card */}
        <motion.div
          className="mt-16 w-full max-w-3xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_20px_60px_-10px_rgba(10,132,255,0.15),0_8px_20px_-6px_rgba(0,0,0,0.08)]">
            {/* Mock window chrome */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400/80" />
                <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                <div className="h-3 w-3 rounded-full bg-green-400/80" />
              </div>
              <div className="ml-4 flex-1 rounded-lg bg-muted px-4 py-1.5 text-xs text-muted-foreground">
                app.vibemedia.ai/missions
              </div>
            </div>
            {/* Mock content area */}
            <div className="grid grid-cols-4 gap-3 p-4">
              {[
                { name: "小雷", role: "热点捕获", color: "#0A84FF", status: "工作中" },
                { name: "小策", role: "选题策划", color: "#22d3ee", status: "就绪" },
                { name: "小文", role: "内容创作", color: "#2dd4bf", status: "工作中" },
                { name: "小发", role: "渠道分发", color: "#38bdf8", status: "就绪" },
              ].map((emp) => (
                <div key={emp.name} className="rounded-xl border border-border bg-muted/50 p-3 text-center">
                  <div
                    className="mx-auto mb-2 h-8 w-8 rounded-full"
                    style={{ backgroundColor: `${emp.color}20`, border: `2px solid ${emp.color}40` }}
                  />
                  <p className="text-xs font-semibold text-foreground">{emp.name}</p>
                  <p className="text-[10px] text-muted-foreground">{emp.role}</p>
                  <span
                    className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: emp.status === "工作中" ? `${emp.color}15` : "rgba(0,0,0,0.03)",
                      color: emp.status === "工作中" ? emp.color : "#94a3b8",
                    }}
                  >
                    {emp.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="h-6 w-6 text-muted-foreground/50" />
        </motion.div>
      </motion.div>
    </section>
  );
}
