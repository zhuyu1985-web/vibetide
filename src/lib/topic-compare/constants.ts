/**
 * TikHub account 模式支持的平台白名单。
 * 见 spec §4.3：超出此列表的账号 cron 跑了也没东西回，全链路统一过滤。
 */
export const TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS = [
  "douyin",
  "weibo",
  "kuaishou",
  "wechat_mp",
] as const;

export type TikhubAccountSupportedPlatform =
  (typeof TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS)[number];

export function isTikhubAccountSupported(platform: string): boolean {
  return (TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS as readonly string[]).includes(platform);
}
