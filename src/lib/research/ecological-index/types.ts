// 生态文明传播指数报告模块 - 共享 TypeScript 类型
//
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md
// Plan: docs/superpowers/plans/2026-05-26-ecological-index-report-plan.md (Phase 2)
//
// 这些类型用于 scope-parser / activity-parser / matcher / compute 之间的边界,
// 字段命名与 DB 表(research_media_scopes / research_media_scope_units /
// research_activity_datasets)的 camelCase TS 端对齐。

/**
 * 媒体单位分级 enum,与 DB `scope_unit_tier` 枚举一一对应。
 * - central: 央级(人民日报、央视等)
 * - industry: 行业(中国环境报等)
 * - municipal: 市级(含 xlsx 中"省/市级" + "市级" 两类)
 * - district_rmt: 区县融媒(融媒中心)
 * - district_gov: 政务新媒体(区县政务公众号)
 */
export type ScopeUnitTier =
  | "central"
  | "industry"
  | "municipal"
  | "district_rmt"
  | "district_gov";

/**
 * 解析后的单位明细。一行 xlsx → 一个 ParsedScopeUnit。
 * 字段命名与 research_media_scope_units 表对齐(camelCase TS 端)。
 */
export type ParsedScopeUnit = {
  /** 1-based 原 xlsx 行号(含表头),用于追溯与展示。L2 是第一行数据 */
  xlsxRow: number;
  /** 媒体名,xlsx B 列 */
  name: string;
  /** 五级分级 */
  tier: ScopeUnitTier;
  /** xlsx E 列原始值(可能为 null,如 L32 忠州新闻 / L54 巫溪发布) */
  districtOrig: string | null;
  /** 标准化区县名(已合并 江北/渝北→两江、补全 忠县/巫溪县) */
  districtNormalized: string | null;
  /** 已知网站,xlsx G 列 "|" 分隔,已去协议头与尾部 "/" */
  websites: string[];
  /** 已知公众号名,xlsx H 列 "|" 分隔 */
  wechatNames: string[];
  /** 公众号 ghid (gh_xxxxx),xlsx M 列,非 gh_ 开头则 null */
  wechatGhid: string | null;
  /** 微博 UID,从 xlsx J 列 URL 提取 */
  weiboUid: string | null;
  /** 微博 handle(用户名),P2 暂 null,P3 matcher 阶段再补 */
  weiboHandle: string | null;
  /** 抖音主页 URL,xlsx I 列(多 URL 时取首个 douyin.com) */
  douyinUrl: string | null;
  /** 快手主页 URL,xlsx K 列(多 URL 时取首个 kuaishou.com) */
  kuaishouUrl: string | null;
  /** 备注:district 补全说明等(忠州/巫溪触发) */
  notes: string | null;
};

/**
 * scope-parser 输出。包含明细 + 警告 + 分级统计。
 */
export type ParsedScope = {
  units: ParsedScopeUnit[];
  /** 解析过程中的警告(district 补全、未知分级跳过等),便于人工核对 */
  warnings: string[];
  stats: {
    totalUnits: number;
    centralCount: number;
    industryCount: number;
    municipalCount: number;
    districtRmtCount: number;
    districtGovCount: number;
  };
};
