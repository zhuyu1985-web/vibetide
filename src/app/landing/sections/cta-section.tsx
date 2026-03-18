"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ShimmerButton } from "../components/shimmer-button";

export function CtaSection() {
  return (
    <section className="relative w-full overflow-hidden">
      {/* CTA area */}
      <div className="relative py-24 px-4">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#0A84FF]/[0.03] to-slate-50 dark:from-[#080d19] dark:via-[#0A84FF]/[0.08] dark:to-[#0c1222]" />

        {/* Subtle decorative blur */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "#0A84FF" }}
        />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <motion.h2
            className="text-3xl font-bold md:text-5xl text-slate-900 dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            让 AI 团队，成为你的内容引擎
          </motion.h2>

          <motion.p
            className="mt-4 text-lg text-slate-500 dark:text-slate-400"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            无需复杂配置，注册即可开始。你的 8 位 AI 同事已就位。
          </motion.p>

          <motion.div
            className="mt-8 flex items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ShimmerButton variant="primary" href="/team-hub">
              免费开始使用
              <ArrowRight className="h-4 w-4" />
            </ShimmerButton>
            <ShimmerButton variant="outline" href="/login">
              登录账号
            </ShimmerButton>
          </motion.div>

          <motion.p
            className="mt-4 text-sm text-slate-400 dark:text-slate-500"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            免费使用 · 无需信用卡 · 支持团队协作
          </motion.p>
        </div>
      </div>

      {/* Professional dark footer */}
      <footer className="relative bg-slate-900 dark:bg-[#060a14] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            {/* Brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: "#0A84FF" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="text-lg font-bold">Vibe Media</span>
              </div>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                数智全媒平台，AI赋能内容生产新范式。
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-8 md:grid-cols-3 md:gap-12">
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">产品</h4>
                <ul className="space-y-2">
                  <li><a href="#capabilities" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">核心引擎</a></li>
                  <li><a href="#team" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">AI团队</a></li>
                  <li><a href="#scenarios" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">应用场景</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">公司</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">关于我们</a></li>
                  <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">联系我们</a></li>
                  <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">加入我们</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">法律</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">使用条款</a></li>
                  <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">隐私政策</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
            <p className="text-sm text-slate-500">
              &copy; 2026 Vibe Media. All rights reserved.
            </p>
            <p className="text-sm text-slate-500">
              数智全媒平台
            </p>
          </div>
        </div>
      </footer>
    </section>
  );
}
