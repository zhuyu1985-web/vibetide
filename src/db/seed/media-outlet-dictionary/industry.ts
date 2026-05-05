import type { MediaOutletInsert } from "@/db/schema/media-outlet-dictionary";

export const INDUSTRY_OUTLETS: Omit<
  MediaOutletInsert,
  "id" | "organizationId" | "createdAt" | "updatedAt"
>[] = [
  {
    outletName: "中国环境报",
    outletTier: "industry",
    industryTag: "环境",
    domains: ["cenews.com.cn"],
    publicAccountNames: ["中国环境", "中国环境报"],
  },
  {
    outletName: "中国能源报",
    outletTier: "industry",
    industryTag: "能源",
    domains: ["cnenergynews.cn"],
    publicAccountNames: ["中国能源报"],
  },
  {
    outletName: "中国绿色时报",
    outletTier: "industry",
    industryTag: "林草/生态",
    domains: ["greentimes.com"],
    publicAccountNames: ["中国绿色时报"],
  },
  {
    outletName: "中国自然资源报",
    outletTier: "industry",
    industryTag: "自然资源",
    domains: ["iziran.net"],
    publicAccountNames: ["i自然", "i 自然"],
  },
  {
    outletName: "中国水利报",
    outletTier: "industry",
    industryTag: "水利",
    domains: ["slb.com.cn"],
    publicAccountNames: ["中国水利报"],
  },
  {
    outletName: "中国应急管理报",
    outletTier: "industry",
    industryTag: "应急",
    domains: [],
    publicAccountNames: ["中国应急管理报"],
  },
  {
    outletName: "中国旅游报",
    outletTier: "industry",
    industryTag: "文旅",
    domains: ["ctnews.com.cn"],
    publicAccountNames: ["中国旅游报"],
  },
  {
    outletName: "经济参考报",
    outletTier: "industry",
    industryTag: "经济",
    domains: ["jjckb.cn"],
    publicAccountNames: ["经济参考报"],
  },
  {
    outletName: "健康报",
    outletTier: "industry",
    industryTag: "卫生健康",
    domains: ["jkb.com.cn"],
    publicAccountNames: ["健康报"],
  },
  {
    outletName: "中国教育报",
    outletTier: "industry",
    industryTag: "教育",
    domains: ["jyb.cn"],
    publicAccountNames: ["中国教育报"],
  },
  {
    outletName: "中国消费者报",
    outletTier: "industry",
    industryTag: "消费",
    domains: ["ccn.com.cn"],
    publicAccountNames: ["中国消费者报"],
  },
  {
    outletName: "中国建设报",
    outletTier: "industry",
    industryTag: "住建",
    domains: ["chinajsb.cn"],
    publicAccountNames: ["中国建设报"],
  },
];
