"use client";

import { Mail, Phone } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type LoginMode = "phone" | "email";

interface LoginModeTabsProps {
  value: LoginMode;
  onChange: (mode: LoginMode) => void;
  className?: string;
}

const tabTriggerClass = cn(
  "relative z-10 flex-1 gap-1.5 transition-colors duration-200",
  "text-foreground/45 hover:text-foreground/65",
  "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:ring-0",
  "data-[state=active]:text-foreground data-[state=active]:font-semibold",
  "dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-foreground",
  "group-data-[variant=glass]/tabs-list:data-[state=active]:!bg-transparent",
  "group-data-[variant=glass]/tabs-list:data-[state=active]:!text-foreground",
  "group-data-[variant=glass]/tabs-list:data-[state=active]:!shadow-none",
  "group-data-[variant=glass]/tabs-list:data-[state=active]:!ring-0",
  "dark:group-data-[variant=glass]/tabs-list:data-[state=active]:!text-foreground",
);

export function LoginModeTabs({
  value,
  onChange,
  className,
}: LoginModeTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as LoginMode)}
      className={cn("mb-6", className)}
    >
      <TabsList
        variant="glass"
        className={cn(
          "relative grid w-full h-11 grid-cols-2 p-1",
          "bg-black/[0.04] dark:bg-white/[0.06]",
          "ring-1 ring-black/[0.05] dark:ring-white/[0.08]",
          "shadow-none",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1 bottom-1 w-[calc(50%-6px)] rounded-full",
            "bg-white dark:bg-white/12",
            "shadow-[0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)]",
            "ring-1 ring-black/[0.05] dark:ring-white/[0.1]",
            "transition-[left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            value === "phone" ? "left-1.5" : "left-[calc(50%+3px)]",
          )}
        />
        <TabsTrigger value="phone" className={tabTriggerClass}>
          <Phone size={15} />
          手机号
        </TabsTrigger>
        <TabsTrigger value="email" className={tabTriggerClass}>
          <Mail size={15} />
          邮箱
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
