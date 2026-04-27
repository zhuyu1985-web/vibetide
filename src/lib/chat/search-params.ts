/**
 * Chat 场景下 Tavily web_search 的参数推断工具。
 *
 * 独立成文件是为了可测：route.ts 是 Next.js Route Handler，单测里直接 import
 * 会把整条 Supabase / DB 初始化链路拖进来。这里只放纯函数。
 */

export type WebSearchTimeRange = "1h" | "24h" | "7d" | "30d";

const TIME_RANGE_VALUES: readonly WebSearchTimeRange[] = [
  "1h",
  "24h",
  "7d",
  "30d",
];

/**
 * 判断 key（场景表单里的 label 或字段名）是否属于 timeRange 技术字段。
 * 两种形态都要识别：
 * - 中文 label：检索时间窗 / 检索窗口 / 时间窗
 * - 英文字段名：time_range / timeRange / time-range
 */
function isTimeRangeKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (/^(检索时间窗|检索窗口|时间窗|检索窗)$/.test(key.trim())) return true;
  return /^time[-_\s]?range$/.test(normalized);
}

/**
 * 把首页场景表单 / 自由输入的消息转成给 Tavily 的检索关键词。
 *
 * 场景表单发出的消息长这样：
 *   场景：本地新闻
 *   本地区域: 成都 青羊区
 *   新闻范围: 抖音
 *   产出条数: 1
 *
 * 整段直接丢给 Tavily 命中率极差（label 文字会稀释关键词，纯数字字段
 * 当噪音）。这里做轻量解析：抽出场景名 + 非数字值字段，拼成关键词串。
 *
 * 非场景表单的自由输入（没有 `场景：` 开头或单行文本）原样返回。
 */
export function extractSearchQuery(message: string): string {
  const lines = message
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1 || !lines[0].startsWith("场景：")) {
    return message;
  }

  const values: string[] = [];
  const scenarioName = lines[0].replace(/^场景：/, "").trim();
  if (scenarioName) values.push(scenarioName);

  for (const line of lines.slice(1)) {
    const m = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();
    if (!value) continue;
    if (/^\d+$/.test(value)) continue; // 跳过"产出条数: 3" / "事件发生时间: 2026"这种
    if (isTimeRangeKey(key)) continue; // "检索时间窗: 24h" 不进 query，由 parseExplicitTimeRange 处理
    values.push(value);
  }

  return values.length > 0 ? values.join(" ") : message;
}

/**
 * 根据用户消息语义推断 Tavily web_search 的 timeRange。
 * 规则与 tool-registry.ts 里 web_search 的 description 对齐：
 * - 突发 / 特急 / 紧急 / 刚刚 / 速报 / today / breaking
 *   / N 分钟内 / N 小时内 / 今日 / 每日 / 实时 → 24h
 * - 本周 / 最近一周 / 最近几天 → 7d
 * - 本月 / 近一月 / 年度展会类（CCBN/世博等长周期专有名词） → 30d
 * - 其余 → undefined（不做时间过滤，由 Tavily 按相关度排序）
 *
 * 漏"突发"系词曾翻过车：用户启动"突发新闻"场景填"10 分钟内发布"，
 * inferTimeRange 返回 undefined → Tavily 不过滤时间 → 头条是 2011 盈江
 * 地震、2024 能登地震这类相关度高但严重过期的旧稿。中文 breaking 家族
 * 必须显式列出，不要靠 "实时" / "today" 兜底。
 */
export function inferTimeRange(
  message: string,
): WebSearchTimeRange | undefined {
  const lower = message.toLowerCase();

  // Breaking / realtime 家族 —— 中英混合，含"N 分钟内/前"、"N 小时内/前"。
  if (
    /今日|每日|今天|daily|实时|real[-\s]?time|breaking|突发|特急|紧急|刚刚|刚才|速报/i.test(
      message,
    ) ||
    /\btoday\b/.test(lower) ||
    /\d+\s*(分钟|小时)(内|前)/.test(message)
  ) {
    return "24h";
  }
  if (/本周|这周|最近一周|近一周|weekly|past\s+week/i.test(message)) {
    return "7d";
  }
  if (
    /本月|近一月|最近一月|这个月|近期|monthly|past\s+month/i.test(message)
  ) {
    return "30d";
  }
  // 未命中时不设 timeRange —— 放开时间让 Tavily 按相关度返回，
  // 避免 CCBN 这种年度专有名词被 24h 窗口过滤掉。
  return undefined;
}

/**
 * 解析启动表单里显式传入的 timeRange（来自"突发新闻追踪"这类场景的
 * `检索时间窗: 24h` 字段）。命中则优先于 inferTimeRange 使用，避免自然
 * 语言推断误判（例如"突发事件"却拿回一堆 2011 年旧稿的事故）。
 *
 * 仅接受规范值：1h / 24h / 7d / 30d —— 其它格式一律忽略。
 */
export function parseExplicitTimeRange(
  message: string,
): WebSearchTimeRange | undefined {
  const lines = message.split("\n");
  for (const line of lines) {
    const m = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();
    if (!isTimeRangeKey(key)) continue;
    const normalized = value.toLowerCase() as WebSearchTimeRange;
    if (TIME_RANGE_VALUES.includes(normalized)) return normalized;
  }
  return undefined;
}

/**
 * 综合解析：显式 > 推断。用于 intent-execute/route.ts 的 web_search
 * 预执行参数决定。抽成单函数是为了让 route 逻辑更短，且让测试单点覆盖。
 */
export function resolveWebSearchTimeRange(
  message: string,
): WebSearchTimeRange | undefined {
  return parseExplicitTimeRange(message) ?? inferTimeRange(message);
}
