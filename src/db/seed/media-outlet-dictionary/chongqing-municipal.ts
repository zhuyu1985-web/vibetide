import type { MediaOutletInsert } from "@/db/schema/media-outlet-dictionary";

export const CHONGQING_MUNICIPAL_OUTLETS: Omit<
  MediaOutletInsert,
  "id" | "organizationId" | "createdAt" | "updatedAt"
>[] = [
  {
    outletName: "重庆日报",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["cqrb.cn", "cqdsw.cn"],
    publicAccountNames: ["重庆日报"],
  },
  {
    outletName: "华龙网",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["cqnews.net", "hualongw.com"],
    publicAccountNames: ["华龙网"],
  },
  {
    outletName: "上游新闻",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["cqcb.com"],
    publicAccountNames: ["上游新闻"],
  },
  {
    outletName: "重庆广电",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["cbg.cn"],
    publicAccountNames: ["重庆广电", "第 1 眼新闻"],
  },
  {
    outletName: "重庆晚报",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["cqwb.com.cn"],
    publicAccountNames: ["重庆晚报"],
  },
  {
    outletName: "重庆发布",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: [],
    publicAccountNames: ["重庆发布"],
    description: "政务，无独立官网",
  },
  // "美丽重庆" 已迁到 industry.ts（按客户 Excel 口径，划入行业媒体 tier）
  {
    outletName: "第1眼新闻",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["1tv.com.cn"],
    publicAccountNames: ["第 1 眼新闻"],
  },
  // TODO: domains / publicAccountNames 待调研确认后补全（当前为 Excel 主题统计口径占位）
  {
    outletName: "ichongqing",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["ichongqing.info"],
    publicAccountNames: ["iChongqing", "西部国传"],
    description: "重庆国际传播中心（西部国传），Excel 主题统计市级媒体列",
  },
  {
    outletName: "七一网",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["71.cn"],
    publicAccountNames: ["当代党员", "七一客户端"],
    description: "中共重庆市委《当代党员》杂志官网，Excel 主题统计市级媒体列",
  },
];
