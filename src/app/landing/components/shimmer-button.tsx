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
      ? "text-primary-foreground bg-primary hover:brightness-110 shadow-[0_2px_8px_color-mix(in_srgb,var(--primary)_30%,transparent)] hover:shadow-[0_4px_16px_color-mix(in_srgb,var(--primary)_40%,transparent)]"
      : [
          "text-foreground",
          "bg-card",
          "border border-border",
          "shadow-sm hover:shadow-md",
          "hover:border-border",
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
