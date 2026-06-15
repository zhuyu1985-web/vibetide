import {
  Award,
  BarChart3,
  BookMarked,
  Bot,
  Compass,
  Database,
  FileText,
  FolderOpen,
  Home,
  Lightbulb,
  ListTodo,
  Package,
  Radio,
  SearchX,
  ShieldCheck,
  TrendingUp,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface DashboardSubItem {
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefixes?: string[];
}

export interface DashboardNavItem extends DashboardSubItem {
  children?: DashboardSubItem[];
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "首页", href: "/home", icon: Home },
  {
    label: "智能体",
    href: "#agents",
    icon: Bot,
    children: [
      { label: "AI 员工", href: "/ai-employees", icon: Users },
      { label: "工作流", href: "/workflows", icon: Workflow },
      { label: "任务", href: "/missions", icon: ListTodo },
    ],
  },
  {
    label: "应用",
    href: "#apps",
    icon: Compass,
    children: [
      { label: "热点发现", href: "/inspiration", icon: Lightbulb },
      { label: "同题对比", href: "/topic-compare", icon: Compass },
      { label: "漏题筛查", href: "/missing-topics", icon: SearchX },
      { label: "账号分析", href: "/account-analytics", icon: TrendingUp },
      { label: "优秀案例", href: "/case-library", icon: Award },
    ],
  },
  {
    label: "内容",
    href: "#content",
    icon: FolderOpen,
    children: [
      { label: "稿件库", href: "/articles", icon: FileText },
      { label: "素材库", href: "/media-assets", icon: Package },
    ],
  },
  { label: "审核", href: "/audit-center", icon: ShieldCheck },
  { label: "渠道", href: "/settings/channels", icon: Radio },
  {
    label: "采集",
    href: "#data-collection",
    icon: Database,
    children: [
      { label: "内容池", href: "/data-collection/content", icon: FolderOpen },
      { label: "主体监测", href: "/data-collection/topics", icon: BookMarked },
      {
        label: "采集配置",
        href: "/data-collection/sources",
        matchPrefixes: ["/data-collection/sources", "/data-collection/outlets"],
        icon: Wrench,
      },
      { label: "研究报告", href: "/data-collection/reports", icon: FileText },
      { label: "监控面板", href: "/data-collection/monitoring", icon: BarChart3 },
    ],
  },
  { label: "数据", href: "/analytics", icon: BarChart3 },
];

export const DASHBOARD_MORE_ITEMS: DashboardSubItem[] = [];
export const DASHBOARD_SHOW_MORE_ENTRY = true;

export function flattenDashboardNavLabels(): string[] {
  return DASHBOARD_NAV_ITEMS.flatMap((item) => [
    item.label,
    ...(item.children?.map((child) => child.label) ?? []),
  ]);
}
