/**
 * 视频与播客意图识别纯函数。
 * 与 isIllustrateIntent（"配图/加图"）互斥——视频/播客正则不匹配纯图意图。
 */

const VIDEO_PATTERNS = [
  /配视频/,
  /做个视频/,
  /做条视频/,
  /生成视频/,
  /做视频/,
];

const PODCAST_PATTERNS = [
  /配播客/,
  /做个播客/,
  /做成播客/,
  /生成播客/,
  /做播客/,
];

export function isVideoIntent(text: string): boolean {
  return VIDEO_PATTERNS.some((re) => re.test(text));
}

export function isPodcastIntent(text: string): boolean {
  return PODCAST_PATTERNS.some((re) => re.test(text));
}
