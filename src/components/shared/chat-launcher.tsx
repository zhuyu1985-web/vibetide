"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatLauncher() {
  const pathname = usePathname();
  if (pathname?.startsWith("/chat")) return null;

  return (
    <Link
      href="/chat"
      aria-label="进入对话中心"
      title="对话中心"
      className={cn(
        "chat-launcher group fixed bottom-6 right-6 z-50",
        "flex items-center h-11 rounded-full",
        "bg-blue-600 text-white",
        "pl-3 pr-3 hover:pr-4",
        "transition-[padding,background-color] duration-200 ease-out",
        "hover:bg-blue-700 active:bg-blue-800"
      )}
    >
      <MessagesSquare size={18} strokeWidth={2} className="flex-shrink-0" />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap text-sm font-medium",
          "max-w-0 group-hover:max-w-[120px]",
          "ml-0 group-hover:ml-2",
          "transition-[max-width,margin] duration-200 ease-out"
        )}
      >
        对话中心
      </span>
    </Link>
  );
}
