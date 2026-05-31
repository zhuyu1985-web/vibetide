import type { Metadata } from "next";
import { HelpHeader } from "@/components/help/layout/help-header";
import { HelpFooter } from "@/components/help/layout/help-footer";

export const metadata: Metadata = {
  title: { template: "%s | Vibe Media 帮助中心", default: "Vibe Media 帮助中心" },
  description: "Vibe Media 数智全媒平台使用文档、AI 员工指南、常见问题与更新日志。",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col bg-white dark:bg-slate-950">
      <HelpHeader />
      <main className="flex-1">{children}</main>
      <HelpFooter />
    </div>
  );
}
