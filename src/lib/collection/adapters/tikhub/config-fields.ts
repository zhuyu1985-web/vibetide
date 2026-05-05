import type { ConfigField } from "../../types";
import { TIKHUB_PLATFORMS, TIKHUB_PLATFORM_LABELS } from "./config";

export const tikhubConfigFields: ConfigField[] = [
  {
    key: "platform",
    label: "平台",
    type: "select",
    required: true,
    options: TIKHUB_PLATFORMS.map((p) => ({ value: p, label: TIKHUB_PLATFORM_LABELS[p] })),
  },
  { key: "keywords", label: "关键词", type: "multiselect", required: true, help: "1-20 个关键词" },
  {
    key: "timeWindow",
    label: "时间窗",
    type: "select",
    options: [
      { value: "day", label: "一天内" },
      { value: "week", label: "一周内" },
      { value: "halfYear", label: "半年内" },
      { value: "all", label: "全部（如平台支持）" },
    ],
    help: "tikhub 时间窗最长仅半年内",
  },
  { key: "maxPagesPerRun", label: "每次最大页数", type: "number", validation: { min: 1, max: 10 } },
  { key: "resultsPerPage", label: "每页条数", type: "number", validation: { min: 10, max: 50 } },
  {
    key: "monthlyBudgetUsd",
    label: "月度预算（USD）",
    type: "number",
    validation: { min: 0 },
    help: "默认 $5；超 80% 告警，100% 自动停用",
  },
];
