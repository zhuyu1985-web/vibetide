import { ReactNode } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const tabs = [
  { href: "/data-collection/sources", label: "源管理" },
  { href: "/data-collection/content", label: "内容浏览" },
  { href: "/data-collection/monitoring", label: "监控面板" },
];

export default function DataCollectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <header className="px-8 pt-6 pb-4 border-b border-border/30">
        <h1 className="text-xl font-semibold tracking-tight">数据采集</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          统一管理所有采集源。在此添加/编辑站点、订阅、关键词搜索,查看采集状态。
        </p>
        <nav className="mt-4 flex gap-4">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex-1 px-8 py-6">{children}</div>
    </div>
  );
}
