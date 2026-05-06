// 共享类型，避免 client/server 双引用 server action 文件类型
export type AdvancedSearchField =
  | "title" | "content" | "author" | "outletName"
  | "outletTier" | "outletRegion" | "district" | "topic"
  | "contentType" | "publishedAt" | "platform";

export type AdvancedSearchOperator =
  | "contains" | "not_contains" | "equals" | "not_equals" | "between";

export interface AdvancedSearchCondition {
  field: AdvancedSearchField;
  operator: AdvancedSearchOperator;
  value: string;                                   // 单值 (text/enum)
  value2?: string;                                  // between 操作符的右端
  valueRange?: { from: string; to: string };       // publishedAt between (ISO 字符串)
  logic: "and" | "or";                              // 与下一行的连接（最后一行未用）
}

export interface SidebarFilter {
  outletTiers?: string[];
  districtIds?: string[];
  topicIds?: string[];
  contentTypes?: string[];
  publishedAtRange?: { from: string; to: string };
}

// 字段 → 操作符可选列表（UI 联动）
export const FIELD_OPERATORS: Record<AdvancedSearchField, AdvancedSearchOperator[]> = {
  title: ["contains", "not_contains"],
  content: ["contains", "not_contains"],
  author: ["contains", "not_contains"],
  outletName: ["contains", "not_contains"],
  outletTier: ["equals", "not_equals"],
  outletRegion: ["equals", "not_equals"],
  district: ["equals", "not_equals"],
  topic: ["equals", "not_equals"],
  contentType: ["equals", "not_equals"],
  platform: ["equals", "not_equals"],
  publishedAt: ["between"],
};

export const FIELD_LABELS: Record<AdvancedSearchField, string> = {
  title: "标题", content: "正文", author: "作者", outletName: "媒体名",
  outletTier: "媒体分级", outletRegion: "区域", district: "区县", topic: "主题",
  contentType: "内容类型", platform: "平台", publishedAt: "发布时间",
};

export const OPERATOR_LABELS: Record<AdvancedSearchOperator, string> = {
  contains: "包含", not_contains: "不包含",
  equals: "等于", not_equals: "不等于",
  between: "在范围内",
};
