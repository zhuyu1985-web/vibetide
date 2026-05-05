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
  {
    outletName: "美丽重庆",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: [],
    publicAccountNames: ["美丽重庆"],
    description: "行业 + 政务",
  },
  {
    outletName: "第1眼新闻",
    outletTier: "provincial_municipal",
    outletRegion: "重庆",
    domains: ["1tv.com.cn"],
    publicAccountNames: ["第 1 眼新闻"],
  },
];
