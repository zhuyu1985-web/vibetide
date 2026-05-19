import type { MediaOutletInsert } from "@/db/schema/media-outlet-dictionary";

// 重庆 39 个区县名称(与 src/db/seed/research/cq-districts.ts DISTRICTS 保持一致)
// 注意:cq-districts.ts 仅 export 异步函数,故此处静态内联;如区县字典变更需同步更新
const CQ_DISTRICT_NAMES = [
  "北碚区",
  "两江新区",
  "九龙坡区",
  "云阳县",
  "巴南区",
  "巫山县",
  "涪陵区",
  "奉节县",
  "江津区",
  "梁平区",
  "忠县",
  "渝中区",
  "长寿区",
  "开州区",
  "黔江区",
  "南岸区",
  "南川区",
  "大渡口区",
  "永川区",
  "沙坪坝区",
  "璧山区",
  "万州区",
  "秀山县",
  "丰都县",
  "铜梁区",
  "万盛经开区",
  "合川区",
  "潼南区",
  "科学城重庆高新区",
  "城口县",
  "彭水县",
  "武隆区",
  "垫江县",
  "綦江区",
  "荣昌区",
  "酉阳县",
  "大足区",
  "石柱县",
  "巫溪县",
] as const;

const MUNICIPAL: Omit<
  MediaOutletInsert,
  "id" | "organizationId" | "createdAt" | "updatedAt"
> = {
  outletName: "重庆市生态环境局",
  outletTier: "government_self_media",
  outletRegion: "重庆",
  industryTag: "环境",
  publicAccountNames: ["重庆生态环境"],
  description: "重庆市生态环境局政务新媒体",
};

// 江北区/渝北区生态环境局:实体保留,outletDistrict 归到"两江新区"使统计归口
const MERGED_INTO_LIANGJIANG: Omit<
  MediaOutletInsert,
  "id" | "organizationId" | "createdAt" | "updatedAt"
>[] = [
  {
    outletName: "江北区生态环境局",
    outletTier: "government_self_media",
    outletRegion: "重庆",
    outletDistrict: "两江新区",
    industryTag: "环境",
    publicAccountNames: [],
    description: "江北区生态环境局政务新媒体(并入两江新区统计)",
  },
  {
    outletName: "渝北区生态环境局",
    outletTier: "government_self_media",
    outletRegion: "重庆",
    outletDistrict: "两江新区",
    industryTag: "环境",
    publicAccountNames: [],
    description: "渝北区生态环境局政务新媒体(并入两江新区统计)",
  },
];

export const CHONGQING_ECO_GOV_OUTLETS: Omit<
  MediaOutletInsert,
  "id" | "organizationId" | "createdAt" | "updatedAt"
>[] = [
  MUNICIPAL,
  ...CQ_DISTRICT_NAMES.map((districtName) => ({
    outletName: `${districtName}生态环境局`,
    outletTier: "government_self_media" as const,
    outletRegion: "重庆",
    outletDistrict: districtName,
    industryTag: "环境",
    publicAccountNames: [] as string[],
    description: `${districtName}生态环境局政务新媒体`,
  })),
  ...MERGED_INTO_LIANGJIANG,
];
