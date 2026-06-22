/**
 * 发布意图识别纯函数
 * 无外部依赖，供 gateway 等下游直接 import。
 */

/**
 * 是否含有发布意图：含"发布到 / 发到 / 推送到"动宾结构，
 * 并且不是纯写稿 / 检索 / 闲聊句。
 */
export function isPublishIntent(text: string): boolean {
  const t = text.trim();
  return /发布到|发到|推送到/.test(t);
}

/**
 * 从含发布意图的文本中提取目标栏目名（去掉"频道/栏目/里/中"后缀）。
 * 提不出明确目标（无"到X"结构）返回 null。
 */
export function extractPublishTarget(text: string): string | null {
  const t = text.trim();
  const m = t.match(/(?:发布到|发到|推送到)\s*([^\s，。,.!！?？]+)/u);
  if (!m) return null;
  // 只去掉"栏目/里/中"这类纯结构后缀；"频道"是栏目名的一部分，保留
  const name = m[1].replace(/(栏目|里|中)$/u, "").trim();
  return name.length > 0 ? name : null;
}
