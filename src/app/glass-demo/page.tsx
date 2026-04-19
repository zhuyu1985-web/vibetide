"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Moon,
  Sun,
  ArrowRight,
  Sparkles,
  Bell,
  Search,
  CheckCircle2,
  Circle,
  TrendingUp,
  Users,
  Zap,
  Mail,
  Lock,
  User as UserIcon,
  MessageSquare,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import type { EmployeeId } from "@/lib/constants";
import { EMPLOYEE_META } from "@/lib/constants";
import s from "./demo.module.css";

const TEAM: EmployeeId[] = ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaojian", "xiaoshen", "xiaofa", "xiaoshu"];

export default function GlassDemoPage() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const [email, setEmail] = useState("");

  return (
    <div className={s.root}>
      {/* Background blobs */}
      <div className={`${s.blob} ${s.blob1}`} />
      <div className={`${s.blob} ${s.blob2}`} />
      <div className={`${s.blob} ${s.blob3}`} />

      {/* Top bar */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 pt-6">
        <div className={`${s.glass} flex items-center justify-between px-5 py-3`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white font-bold text-sm">
              V
            </div>
            <span className="font-semibold">Vibetide · Glass Demo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={s.chip}>
              <Sparkles size={12} /> 玻璃化视觉预览
            </span>
            <button
              className={s.btnGhost}
              onClick={() => setTheme(dark ? "light" : "dark")}
              aria-label="切换主题"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              {dark ? "亮色" : "暗色"}
            </button>
            <Link href="/home" className={s.btnGhost}>返回系统</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 backdrop-blur-md mb-6">
          <span className={s.dot} />
          <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
            超级个体已就绪 · 8 位专家待命
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-4">
          <span className="bg-gradient-to-r from-indigo-600 via-blue-500 to-sky-500 bg-clip-text text-transparent">
            智媒工作空间
          </span>
          <br />
          <span className="text-foreground">玻璃化视觉体验</span>
        </h1>
        <p className={`${s.muted} text-lg max-w-2xl mx-auto mb-8`}>
          融合毛玻璃质感、柔和淡蓝渐变与自然光晕，为 AI 协作体验打造优雅的沉浸式界面。
        </p>
        <div className="flex items-center justify-center gap-3">
          <button className={s.btnPrimary}>
            <MessageSquare size={16} /> 进入对话中心 <ArrowRight size={14} />
          </button>
          <button className={s.btnGhost}>
            <Search size={16} /> 浏览场景
          </button>
        </div>
      </section>

      {/* Split showcase - login / timeline (AdCreative-style) */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: login/form card */}
          <div className={`${s.glassStrong} ${s.lift} p-10`}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-[0_12px_30px_-8px_rgba(59,130,246,0.6)] mb-4">
                <Sparkles size={26} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-1">登录账户</h2>
              <p className={`${s.muted} text-sm`}>
                使用邮箱登录，继续你的智能协作旅程
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 ml-1">邮箱地址</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className={s.input}
                    style={{ paddingLeft: 42 }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 ml-1">密码</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className={s.input}
                    style={{ paddingLeft: 42 }}
                  />
                </div>
              </div>

              <button className={`${s.btnPrimary} w-full justify-center`} style={{ width: "100%", padding: "14px" }}>
                开始体验 <ArrowRight size={14} />
              </button>

              <div className="text-center text-xs pt-2">
                <span className={s.muted}>还没有账号？</span>
                <a href="#" className="text-blue-500 hover:text-blue-600 ml-1 font-medium">立即注册</a>
              </div>
            </div>
          </div>

          {/* Right: how it works (timeline) */}
          <div className={`${s.glass} p-10`}>
            <h3 className="text-2xl font-bold mb-6">如何开始你的旅程？</h3>
            <div className="space-y-5">
              {[
                { title: "注册并登录", desc: "3 秒完成账户创建，立即加入智媒平台。", done: true },
                { title: "选择你的 AI 专家", desc: "从 8 位数字员工中挑选本次任务的队友。", done: true },
                { title: "描述你的需求", desc: "用自然语言告诉 AI 你想完成的工作。", done: false },
                { title: "实时看到成果", desc: "内容产出、审核与发布，全程可视化。", done: false },
              ].map((step, i) => (
                <div key={i} className={s.timeline}>
                  <div className={s.timelineDot}>
                    {step.done ? (
                      <CheckCircle2 size={14} className="text-blue-500 -translate-x-[2px] -translate-y-[2px]" />
                    ) : (
                      <Circle size={8} className="text-blue-400 mx-auto mt-[2px]" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-0.5">{step.title}</h4>
                    <p className={`${s.muted} text-sm`}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature stats */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: Users, label: "AI 员工", value: "8", hint: "全栈专家团" },
            { icon: Zap, label: "场景模板", value: "24", hint: "开箱即用工作流" },
            { icon: TrendingUp, label: "周产出效率", value: "+340%", hint: "相较传统团队" },
          ].map((c, i) => (
            <div key={i} className={`${s.glass} ${s.lift} p-7`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15 flex items-center justify-center border border-indigo-400/20">
                  <c.icon size={18} className="text-indigo-500" />
                </div>
                <span className={s.chip}><TrendingUp size={11} /> 趋势上升</span>
              </div>
              <div className={`${s.statValue} mb-1`}>{c.value}</div>
              <div className="text-sm font-medium">{c.label}</div>
              <div className={`${s.muted} text-xs mt-0.5`}>{c.hint}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Team showcase */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-16">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold mb-1">AI 专家团队</h3>
            <p className={`${s.muted} text-sm`}>每位员工都有独特的发型、装备与岗位动画</p>
          </div>
          <a className={s.chip} href="#"><Users size={12} /> 查看全部</a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
          {TEAM.map((id) => {
            const meta = EMPLOYEE_META[id];
            return (
              <div key={id} className={`${s.glass} ${s.lift} p-5 text-center cursor-pointer`}>
                <div className="flex justify-center mb-3">
                  <EmployeeAvatar employeeId={id} size="xl" />
                </div>
                <div className="text-sm font-semibold">{meta.title}</div>
                <div className={`${s.muted} text-xs mt-1 line-clamp-1`}>{meta.description}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mixed cards: announcement + input + list */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Announcement */}
          <div className={`${s.glass} ${s.lift} p-6 lg:col-span-2`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shrink-0">
                <Bell size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">本周新增能力</h4>
                  <span className={s.chip}>NEW</span>
                </div>
                <p className={`${s.muted} text-sm mb-3`}>
                  全员头像升级为可动的卡通形象，支持眨眼、微笑与岗位动画；场景卡团队头像放大为 32px，细节更清晰。
                </p>
                <div className="flex items-center gap-2">
                  <button className={s.btnPrimary}>查看更新 <ArrowRight size={14} /></button>
                  <button className={s.btnGhost}>暂不查看</button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick input */}
          <div className={`${s.glass} p-6`}>
            <h4 className="font-semibold mb-1">告诉我你想完成的任务</h4>
            <p className={`${s.muted} text-xs mb-4`}>AI 会为你挑选合适的员工</p>
            <div className="relative mb-3">
              <UserIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={s.input} placeholder="你的名字" style={{ paddingLeft: 38 }} />
            </div>
            <textarea
              className={s.input}
              placeholder="比如：帮我产出一篇关于新能源的深度稿件..."
              rows={3}
              style={{ resize: "none" }}
            />
            <button className={`${s.btnPrimary} mt-4`} style={{ width: "100%", padding: "14px" }}>
              开始协作 <Sparkles size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* Bottom note */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 pb-12 text-center">
        <div className={`${s.glassSubtle} px-5 py-3 inline-flex items-center gap-2 text-xs ${s.muted}`}>
          <Sparkles size={12} />
          这是一个独立 demo 页面 (路径: /glass-demo) · 不影响现有系统 · 满意后可推广为全局风格
        </div>
      </footer>
    </div>
  );
}
