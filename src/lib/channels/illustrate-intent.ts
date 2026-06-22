/**
 * 加配图意图识别纯函数。
 * 命中：含"加配图/配图/配个图/加个图/配张图/来张图/加张图"的用户消息。
 * 不命中：写稿/发布/检索/取消/问候等其他意图。
 */

const ILLUSTRATE_PATTERNS = [
  /加配图/,
  /配图/,
  /配个图/,
  /加个图/,
  /配张图/,
  /来张图/,
  /加张图/,
];

export function isIllustrateIntent(text: string): boolean {
  return ILLUSTRATE_PATTERNS.some((re) => re.test(text));
}
