export const FIELD_ALIASES: Record<string, string[]> = {
  title: ["title", "标题", "题目", "新闻标题", "报道标题", "标题列", "name", "headline"],
  content: ["content", "正文", "内容", "全文", "报道全文", "body", "text", "article"],
  summary: ["summary", "摘要", "概要", "简介", "snippet", "abstract", "description"],
  canonicalUrl: ["url", "链接", "网址", "原文链接", "原文 URL", "原文地址", "link", "source_url"],
  publishedAt: [
    "publishedat",
    "publish_time",
    "发布时间",
    "发布日期",
    "日期",
    "时间",
    "publish_date",
    "date",
    "publish",
    "发表时间",
  ],
  outletName: [
    "outlet",
    "媒体",
    "媒体名",
    "来源",
    "来源媒体",
    "publication",
    "source",
    "source_name",
    "publisher",
    "刊发媒体",
  ],
  outletTier: ["tier", "媒体分级", "分级", "媒体等级", "等级", "tier_level", "刊发媒体分级"],
  outletRegion: ["region", "区域", "地区", "省份", "城市", "省市", "area"],
  contentType: ["contenttype", "content_type", "内容类型", "类型", "类别", "type"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-·]/g, "");
}

export function matchColumns(excelColumns: string[]): Record<string, string | null> {
  const normalizedColumns = excelColumns.map((c) => ({
    original: c,
    normalized: normalize(c),
  }));
  const result: Record<string, string | null> = {};

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const normalizedAliases = aliases.map(normalize);
    const hit = normalizedColumns.find(({ normalized }) =>
      normalizedAliases.some(
        (alias) => normalized.includes(alias) || alias.includes(normalized),
      ),
    );
    result[field] = hit?.original ?? null;
  }

  return result;
}
