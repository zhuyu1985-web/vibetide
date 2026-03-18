"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShimmerButtonProps {
  children: ReactNode;
  variant?: "primary" | "outline";
  className?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function ShimmerButton({
  children,
  variant = "primary",
  className,
  href,
  onClick,
  disabled,
  type,
}: ShimmerButtonProps) {
  const isPrimary = variant === "primary";

  const sharedClasses = cn(
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 cursor-pointer",
    isPrimary
      ? "text-white bg-[#0A84FF] hover:bg-[#0071e3] shadow-[0_2px_8px_rgba(10,132,255,0.3)] hover:shadow-[0_4px_16px_rgba(10,132,255,0.4)] dark:shadow-[0_4px_20px_rgba(10,132,255,0.4)] dark:hover:shadow-[0_8px_30px_rgba(10,132,255,0.5)]"
      : [
          "text-slate-700 dark:text-slate-200",
          "bg-white dark:bg-[#111a2e]",
          "border border-slate-200 dark:border-[#1e293b]",
          "shadow-sm hover:shadow-md",
          "hover:border-slate-300 dark:hover:border-[#2d3a50]",
        ].join(" "),
    className
  );

  if (href) {
    return (
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
        <Link href={href} className={sharedClasses}>{children}</Link>
      </motion.div>
    );
  }

  return (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={sharedClasses} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </motion.button>
  );
}
