"use client";
//
// /data-collection/reports/resources 客户端
// 双 tab + 返回报告列表入口

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScopesTab, type ScopeRow } from "./scopes-tab";
import { DatasetsTab, type DatasetRow } from "./datasets-tab";

interface Props {
  initialTab: "scopes" | "datasets";
  scopes: ScopeRow[];
  datasets: DatasetRow[];
}

export function ResourcesClient({ initialTab, scopes, datasets }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"scopes" | "datasets">(initialTab);

  function handleTabChange(v: string) {
    const next = v === "datasets" ? "datasets" : "scopes";
    setTab(next);
    router.replace(`/data-collection/reports/resources?tab=${next}`);
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-6">
      <PageHeader
        title="研究报告资源管理"
        description="管理媒体名单和线下活动数据集,用于生成生态文明传播指数报告"
        actions={
          <Link href="/data-collection/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4 mr-1.5" />
              返回报告列表
            </Button>
          </Link>
        }
      />
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList variant="line">
          <TabsTrigger value="scopes">媒体名单 ({scopes.length})</TabsTrigger>
          <TabsTrigger value="datasets">活动数据集 ({datasets.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="scopes" className="mt-4">
          <ScopesTab rows={scopes} />
        </TabsContent>
        <TabsContent value="datasets" className="mt-4">
          <DatasetsTab rows={datasets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
