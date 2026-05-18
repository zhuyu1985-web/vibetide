// strip-boilerplate.ts — 2026-05-14
//
// Jina Reader 抓回的 markdown 已经做了 readability,但对很多中文门户站
// (cbg.cn / 央视网 / 各级电视台)它还是把整页(导航 / 页脚 / 友情链接 / 相关推荐 /
// 版权说明 / 广告)都返回。这里做轻量后处理,把明显的非正文部分剥掉。
//
// 设计原则:
//   - 宁可保留可疑内容,也不要误删正文(false-positive 比 false-negative 痛苦得多)
//   - 启发式 + 关键词,不上 DOM/ML
//   - 在 fetchViaJinaReader 后统一调用,所有 adapter 受益

// 找到这些 section heading 就把它和它后面的内容全部砍掉(典型 footer 区段)
const FOOTER_SECTION_MARKERS = [
  /^相关推荐\s*$/m,
  /^头条推荐\s*$/m,
  /^视界独播/m,
  /^友情链接\s*$/m,
  /^推荐阅读\s*$/m,
  /^热门推荐\s*$/m,
  /^猜你喜欢\s*$/m,
  /^相关阅读\s*$/m,
  /^推荐新闻\s*$/m,
  /^版权所有\s*$/m,
  /Copyright\s*©/i,
  /All Rights Reserved/i,
];

// 行级关键词:行内含这些字符的整行删除(典型 footer 链接 / 法律声明)
const FOOTER_LINE_KEYWORDS = [
  "违法和不良信息举报",
  "互联网新闻信息服务许可证",
  "增值电信业务经营许可证",
  "信息网络传播视听节目许可证",
  "中国互联网视听节目服务自律公约",
  "中国互联网举报中心",
  "未成年专用举报通道",
  "网络暴力专项举报入口",
];

// 面包屑行 — 「当前位置: 首页 > ...」(冒号可能是半角 or 全角,也可能省略)
const BREADCRUMB_RE = /^当前位置/;

/**
 * 把 Jina Reader 返回的 markdown 里的导航 / 页脚 / 推荐区清洁掉,保留正文。
 *
 * @param content Jina Reader 返回的 markdown
 * @returns 清洁后的 markdown(空白折叠后)
 */
export function stripJinaBoilerplate(content: string): string {
  if (!content) return content;
  if (content.length < 50) return content; // 极短文本(可能只是 title)不动

  let text = content;

  // 1. 找到第一个 footer section 标记,从此处截断
  //    仅在文本后半部触发(避免误伤标题里出现"相关推荐"这种边界 case)
  const minCutoff = Math.floor(text.length * 0.2);
  let earliestCut = text.length;
  for (const re of FOOTER_SECTION_MARKERS) {
    const m = re.exec(text);
    if (m && m.index >= minCutoff && m.index < earliestCut) {
      earliestCut = m.index;
    }
  }
  if (earliestCut < text.length) {
    text = text.slice(0, earliestCut);
  }

  // 2. 行级清洁
  const cleaned: string[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (isPureLinkLine(trimmed)) continue;
    if (isImageOnlyLine(trimmed)) continue;
    if (BREADCRUMB_RE.test(trimmed)) continue;
    if (FOOTER_LINE_KEYWORDS.some((k) => trimmed.includes(k))) continue;
    cleaned.push(line);
  }

  // 3. 折叠多余空行
  return cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 判断是否是"纯链接行"(navbar / footer 典型):
 *
 * 关键判定:**去掉所有 markdown 链接/图片之后,行里还剩多少"真正的文本"**。
 *  - `* [标题](url)` 去掉 link → 空 → 是 nav
 *  - `* [链接 A](u1) | [链接 B](u2) | [链接 C](u3)` 去掉 link → "| | |" → 是 nav
 *  - `正文段落里 [链接示例](url) 内有 8 个中文字符` 去掉 link → "正文段落里 内有 8 个中文字符" → 还有中文 ≥ 4 → 不是 nav
 *
 * 这样既能清掉 link 文本含很多中文的 navbar(如「嗨!微剧场之烟火星辰」),
 * 又能保留链接嵌在段落里的真实正文。
 */
function isPureLinkLine(line: string): boolean {
  if (!line) return false;
  // 必须以 list 标记(* 或 [) 开头才考虑(确保是 nav/list 结构,不是段落)
  if (!/^(\|\s*)?\*\s+|^\[/.test(line)) return false;

  // 移除所有 markdown image / link 语法和分隔符,看剩下"非装饰"内容
  const stripped = line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")        // ![alt](img)
    .replace(/\[[^\]]*\]\([^)]*\s*("[^"]*")?\s*\)/g, "") // [text](url "title")
    .replace(/[\s|*"\-_·•·]/g, "");               // 装饰字符 + 分隔符

  // 去掉装饰后还剩 ≥ 4 个中文 → 真的有正文,放过
  const remainingCjk = (stripped.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  if (remainingCjk >= 4) return false;

  return true;
}

/** 仅 `![Image N](url)` 的图片行 */
function isImageOnlyLine(line: string): boolean {
  if (!line) return false;
  return /^!\[[^\]]*\]\([^)]+\)\s*$/.test(line);
}
