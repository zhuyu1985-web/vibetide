"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OperationsPanel, type OperationsPanelProps } from "./operations-panel";
import {
  BusinessDashboard,
  type BusinessDashboardProps,
} from "./business-dashboard";

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
