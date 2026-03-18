"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "首页", href: "#hero" },
  { label: "AI团队", href: "#team" },
  { label: "核心引擎", href: "#capabilities" },
  { label: "工作流程", href: "#workflow" },
  { label: "场景演绎", href: "#scenarios" },
  { label: "加入我们", href: "#cta" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  // Lock observer updates during programmatic smooth-scroll to prevent pill bounce-back
  const scrollLockRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const setActiveSectionFromObserver = useCallback((href: string) => {
    if (!scrollLockRef.current) setActiveSection(href);
  }, []);

  useEffect(() => {
    const sectionIds = navLinks.map((l) => l.href.slice(1));
    const observers: IntersectionObserver[] = [];
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSectionFromObserver(`#${id}`); },
        { rootMargin: "-40% 0px -55% 0px" },
      );
      observer.observe(el);
      observers.push(observer);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [setActiveSectionFromObserver]);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    // Lock observer updates, set target immediately, then unlock after scroll settles
    scrollLockRef.current = true;
    setActiveSection(href);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
    // Unlock after smooth scroll completes (~800ms is typical)
    setTimeout(() => { scrollLockRef.current = false; }, 900);
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Glass background — light mode */}
      <motion.div
        className="absolute inset-0 border-b dark:hidden"
        style={{
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          background: "rgba(255,255,255,0.6)",
          borderColor: "rgba(0,0,0,0.06)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: scrolled ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      {/* Glass background — dark mode */}
      <motion.div
        className="absolute inset-0 border-b hidden dark:block"
        style={{
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          background: "rgba(8,13,25,0.85)",
          borderColor: "rgba(30,41,59,0.8)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: scrolled ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />

      <nav className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl shadow-sm"
            style={{
              background: "rgba(10,132,255,0.9)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 2px 12px rgba(10,132,255,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">Vibe Media</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-4 md:flex">
          <div
            className="flex items-center rounded-2xl p-1 dark:!bg-[#111a2e] dark:!border-[#1e293b] dark:!shadow-[0_1px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.04)]"
            style={{
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(16px) saturate(150%)",
              WebkitBackdropFilter: "blur(16px) saturate(150%)",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            {navLinks.map((link) => {
              const isActive = activeSection === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className={cn(
                    "relative rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                    isActive ? "text-white" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-xl shadow-md"
                      style={{
                        background: "#0A84FF",
                        border: "1px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 2px 12px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
                      }}
                      layoutId="navbar-active-pill"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </a>
              );
            })}
          </div>

          <ThemeSwitcher />

          <Link
            href="/team-hub"
            className="rounded-2xl px-5 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 cursor-pointer"
            style={{
              background: "#0A84FF",
              boxShadow: "0 2px 8px rgba(10,132,255,0.3)",
            }}
          >
            免费体验
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeSwitcher />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="absolute inset-x-0 top-16 border-b md:hidden dark:!bg-[#080d19]/95 dark:!border-[#1e293b]"
            style={{
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              background: "rgba(255,255,255,0.75)",
              borderColor: "rgba(0,0,0,0.06)",
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {navLinks.map((link) => {
                const isActive = activeSection === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleAnchorClick(e, link.href)}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "text-white"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    style={isActive ? {
                      background: "#0A84FF",
                      boxShadow: "0 2px 12px rgba(10,132,255,0.3)",
                    } : undefined}
                  >
                    {link.label}
                  </a>
                );
              })}
              <hr className="my-2 border-border/50" />
              <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" onClick={() => setMobileOpen(false)}>
                登录
              </Link>
              <Link
                href="/team-hub"
                className="rounded-xl px-3 py-2.5 text-center text-sm font-medium text-white"
                style={{
                  background: "#0A84FF",
                  boxShadow: "0 2px 12px rgba(10,132,255,0.3)",
                }}
                onClick={() => setMobileOpen(false)}
              >
                免费体验
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
