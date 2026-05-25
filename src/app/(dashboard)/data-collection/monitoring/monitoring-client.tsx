"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import type { OperationsPanelProps } from "./operations-panel";
import type { BusinessDashboardProps } from "./business-dashboard";

// 两个面板互斥(tab 切换),Recharts 重型,改 dynamic 让切到的 tab 才加载对应 chunk。
const BusinessDashboard = dynamic(
  () => import("./business-dashboard").then((m) => m.BusinessDashboard),
  { ssr: false },
);
const OperationsPanel = dynamic(
  () => import("./operations-panel").then((m) => m.OperationsPanel),
  { ssr: false },
);

interface MonitoringClientProps {
  operationsProps: OperationsPanelProps;
  businessProps: BusinessDashboardProps;
  /** 初始激活的 sub-tab(由 URL ?tab= 决定;默认 business) */
  initialTab?: "business" | "ops";
}

export function MonitoringClient({
  operationsProps,
  businessProps,
  initialTab = "business",
}: MonitoringClientProps) {
  const [tab, setTab] = useState<"business" | "ops">(initialTab);

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-2">
        <Button
          variant={tab === "business" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("business")}
        >
          业务看板
        </Button>
        <Button
          variant={tab === "ops" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("ops")}
        >
          采集运维
        </Button>
      </nav>
      {tab === "business" ? (
        <BusinessDashboard {...businessProps} />
      ) : (
        <OperationsPanel {...operationsProps} />
      )}
    </div>
  );
}
