/**
 * 内容生产闭环的纯意图解析（无副作用，便于单测）。
 * 语音转写比打字更口语化、有同音字，这里只做高置信的精确/编号匹配，
 * 兜底交给上层 clarifyOrPlan LLM。
 */

const HOT_TOPIC_PATTERNS = [
  /获取.*热点/,
  /今[天日].*热点/,
  /热点.*(榜|清单|列表)/,
  /(来点|看看|刷|查|拉).*热点/,
  /^热点$/,
  /热[点榜]+$/,
];

/** "获取今天的热点" 类启动闭环意图。 */
export function isHotTopicIntent(text: string): boolean {
  const t = text.trim();
  return HOT_TOPIC_PATTERNS.some((re) => re.test(t));
}

// 中文问候允许带轻量语气尾巴（你好啊 / 在吗？），但开头必须是问候词；
// 英文问候要求整条消息就是问候，避免吃掉 "this is..." 里的 hi。
const GREETING_CN = /^(你好|您好|哈喽|哈罗|你们好|嗨|嗨喽|在吗|在不在|在不|有人吗|有人在吗)[啊呀哈呢吗？?！!，,。.~\s]*$/;
const GREETING_EN = /^(hello|hi|hey|yo|hiya)[\s!.,?]*$/i;

/** 通用问候/开场白意图（任何阶段都先友好回应）。保持收紧，不吃正常任务消息。 */
export function isGreeting(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return GREETING_CN.test(t) || GREETING_EN.test(t);
}

/** "换一批 / 重新来 / 再来一批 / 换个" 重出意图。 */
export function isRegenerate(text: string): boolean {
  return /(换一?批|换一?个|重新(来|生成|出|获取|抓取|拉取)|再来|再出|换换)/.test(text.trim());
}

/** "退出 / 取消闭环 / 不做了 / 结束" 退出闭环意图。 */
export function isExitLoop(text: string): boolean {
  return /(退出|取消(闭环|流程)?|不做了|不弄了|结束(闭环|对话)?|算了)/.test(
    text.trim(),
  );
}

// 中文数字 → 阿拉伯（覆盖 1~10）
const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  壹: 1, 贰: 2, 叁: 3, 肆: 4, 伍: 5,
};

// 字母选项 A/B/C → 1/2/3（兼容大小写、全角）
const LETTER_OPT: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, a全: 1,
  Ａ: 1, Ｂ: 2, Ｃ: 3, Ｄ: 4,
};

/**
 * 从语音/文字里解析"选第 N 个"的 1-based 序号。
 * 支持：阿拉伯数字、中文数字、第N个、选A/B/C、最后一个、中间那个（needs total 推断时给 fallback）。
 * @param total 候选总数（用于"最后一个/中间"语义）。
 * @returns 1-based 序号；解析不出返回 null。
 */
export function parseSelection(text: string, total?: number): number | null {
  const t = text.trim();

  // 字母选项 选A/B/C（要求紧跟"选"或独立出现，避免误吃英文单词）
  const letterMatch = t.match(/(?:选|第|^)\s*([a-dA-DＡ-Ｄ])(?:\b|个|项|$)/);
  if (letterMatch) {
    const key = letterMatch[1].toLowerCase();
    if (LETTER_OPT[key] != null) return LETTER_OPT[key];
    if (LETTER_OPT[letterMatch[1]] != null) return LETTER_OPT[letterMatch[1]];
  }

  // 语义位置
  if (/最后(一个|那个|一条)?/.test(t) && total) return total;
  if (/中间(那个|一个)?/.test(t) && total && total >= 1) return Math.ceil(total / 2);
  if (/第一|头一个|开头|最前/.test(t)) return 1;

  // 阿拉伯数字（选3 / 第3 / 3 / 第3个）
  const arabic = t.match(/(?:选|第)?\s*(\d{1,2})\s*(?:个|条|项|号)?/);
  if (arabic) {
    const n = parseInt(arabic[1], 10);
    if (n >= 1) return n;
  }

  // 中文数字（第三个 / 选三 / 三）
  const cn = t.match(/(?:选|第)?\s*([一二两三四五六七八九十壹贰叁肆伍])\s*(?:个|条|项)?/);
  if (cn && CN_NUM[cn[1]] != null) return CN_NUM[cn[1]];

  return null;
}

// ── 改稿 / 翻译 / 定稿意图（drafting / translating 阶段用）──

const LANGUAGES: { code: string; label: string; re: RegExp }[] = [
  { code: "en", label: "英文", re: /英文|英语|english/i },
  { code: "ja", label: "日文", re: /日文|日语|japanese/i },
  { code: "ko", label: "韩文", re: /韩文|韩语|korean/i },
  { code: "fr", label: "法文", re: /法文|法语|french/i },
  { code: "es", label: "西班牙文", re: /西班牙[文语]|西语|spanish/i },
  { code: "de", label: "德文", re: /德文|德语|german/i },
  { code: "ru", label: "俄文", re: /俄文|俄语|russian/i },
];

/** "定稿 / 就这版 / 可以了 / 外文也定了" 定稿意图。 */
export function isFinalizeIntent(text: string): boolean {
  return /(定稿|就这[版样个]|这版本?可以|可以了|没问题了?|就这样|敲定|外文也?定|搞定了?)/.test(
    text.trim(),
  );
}

/** "翻译成英文 / 转英文 / 英文版" 转外文意图。 */
export function isTranslateIntent(text: string): boolean {
  const t = text.trim();
  if (/^翻译|翻译(一下|成|为)/.test(t)) return true;
  const hasLang = LANGUAGES.some((l) => l.re.test(t)) || /外[文语]/.test(t);
  const hasVerb = /(翻译|译|转|做|出|生成|来个?|要个?)/.test(t);
  return hasLang && hasVerb;
}

/** 抽目标语种；识别不出默认英文。 */
export function extractTargetLanguage(text: string): { code: string; label: string } {
  const hit = LANGUAGES.find((l) => l.re.test(text));
  return hit ? { code: hit.code, label: hit.label } : { code: "en", label: "英文" };
}

/**
 * 发布渠道多选解析（publishing 阶段）。
 * 返回 all=全发 / domestic=只国内 / overseas=只海外 / idx=指定编号集合 / null=没解析出。
 */
export type MultiSelection =
  | { kind: "all" }
  | { kind: "domestic" }
  | { kind: "overseas" }
  | { kind: "idx"; idx: number[] };

export function parseMultiSelection(text: string): MultiSelection | null {
  const t = text.trim();
  if (/(都发|全发|全部发|都要发|全部都发|一起发|都来|全来)/.test(t)) {
    return { kind: "all" };
  }
  if (/(只|仅)?(发)?国内/.test(t) && !/海外/.test(t)) return { kind: "domestic" };
  if (/(只|仅)?(发)?海外/.test(t) && !/国内/.test(t)) return { kind: "overseas" };

  const nums = new Set<number>();
  for (const m of t.matchAll(/\d{1,2}/g)) {
    const n = parseInt(m[0], 10);
    if (n >= 1) nums.add(n);
  }
  for (const ch of t) {
    if (CN_NUM[ch] != null) nums.add(CN_NUM[ch]);
  }
  if (nums.size > 0) return { kind: "idx", idx: [...nums].sort((a, b) => a - b) };
  return null;
}

/** "保存到稿库并提交审核 / 提交审核 / 送审" 提交审核意图。 */
export function isSubmitReviewIntent(text: string): boolean {
  const t = text.trim();
  return (
    /(提交|送|发|交).{0,4}(审核|审查|审)/.test(t) ||
    /送审|报审|审核一下|交审/.test(t) ||
    /保存.{0,6}审核/.test(t)
  );
}

/** "查这篇传播数据 / 复盘 / 效果怎么样" 数据复盘意图（analytics 阶段）。 */
export function isAnalyzeIntent(text: string): boolean {
  const t = text.trim();
  return (
    /(传播|阅读|转发|互动|效果|流量).{0,4}(数据|情况|怎么样|如何|表现)?/.test(t) ||
    /(查|看|拉|统计).{0,6}(数据|传播|效果|阅读|复盘)/.test(t) ||
    /复盘|数据复盘|发得怎么样|看看效果|再查一次|刷新/.test(t)
  );
}
