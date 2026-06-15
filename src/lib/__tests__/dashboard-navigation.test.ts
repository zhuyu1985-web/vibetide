import { describe, expect, it } from "vitest";

import {
  DASHBOARD_NAV_ITEMS,
  DASHBOARD_MORE_ITEMS,
  DASHBOARD_SHOW_MORE_ENTRY,
  flattenDashboardNavLabels,
} from "@/lib/dashboard-navigation";

describe("dashboard navigation", () => {
  it("exposes only the requested top-level menu groups in order", () => {
    expect(DASHBOARD_NAV_ITEMS.map((item) => item.label)).toEqual([
      "首页",
      "智能体",
      "应用",
      "内容",
      "审核",
      "渠道",
      "采集",
      "数据",
    ]);
  });

  it("moves skills out of the main sidebar and keeps AI items under 智能体", () => {
    const agents = DASHBOARD_NAV_ITEMS.find((item) => item.label === "智能体");

    expect(agents?.children?.map((child) => child.label)).toEqual([
      "AI 员工",
      "工作流",
      "任务",
    ]);
    expect(flattenDashboardNavLabels()).not.toContain("技能管理");
    expect(DASHBOARD_SHOW_MORE_ENTRY).toBe(true);
    expect(DASHBOARD_MORE_ITEMS).toEqual([]);
  });

  it("keeps the requested application, content, and collection submenus", () => {
    const labelsOf = (label: string) =>
      DASHBOARD_NAV_ITEMS.find((item) => item.label === label)?.children?.map(
        (child) => child.label,
      );

    expect(labelsOf("应用")).toEqual([
      "热点发现",
      "同题对比",
      "漏题筛查",
      "账号分析",
      "优秀案例",
    ]);
    expect(labelsOf("内容")).toEqual(["稿件库", "素材库"]);
    expect(labelsOf("采集")).toEqual([
      "内容池",
      "主体监测",
      "采集配置",
      "研究报告",
      "监控面板",
    ]);
  });
});
