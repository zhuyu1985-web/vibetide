import { ReactNode } from "react";
import { DataCollectionTabs } from "./data-collection-tabs";

export default function DataCollectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <header className="px-8 pt-6 pb-0">
        <h1 className="text-2xl font-semibold tracking-tight">数据采集</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl">
          统一管理所有采集源。在此添加/编辑站点、订阅、关键词搜索,查看采集状态。
        </p>
        <DataCollectionTabs />
      </header>
      <div className="flex-1 px-8 py-6">{children}</div>
    </div>
  );
}
