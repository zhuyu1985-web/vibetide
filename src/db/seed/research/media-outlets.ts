// src/db/seed/research/media-outlets.ts
import { db } from "@/db";
import {
  mediaOutlets,
  mediaOutletAliases,
} from "@/db/schema/research/media-outlets";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { organizations } from "@/db/schema/users";
import { eq, and } from "drizzle-orm";

type Tier = "central" | "provincial_municipal" | "industry" | "district_media";

type Seed = {
  name: string;
  tier: Tier;
  province?: string;
  districtName?: string;
  industryTag?: string;
  officialUrl?: string;
  aliases?: { alias: string; matchPattern: string }[];
};

// ─── 中央级（8 家） ───
const CENTRAL: Seed[] = [
  { name: "人民日报", tier: "central", officialUrl: "https://www.people.com.cn",
    aliases: [{ alias: "人民网", matchPattern: "people.com.cn" }] },
  { name: "新华社", tier: "central", officialUrl: "https://www.news.cn",
    aliases: [
      { alias: "新华网", matchPattern: "xinhuanet.com" },
      { alias: "新华社客户端", matchPattern: "news.cn" },
    ]},
  { name: "中央广播电视总台", tier: "central", officialUrl: "https://www.cctv.com",
    aliases: [
      { alias: "央视网", matchPattern: "cctv.com" },
      { alias: "央视新闻", matchPattern: "cctvnews.cctv.com" },
    ]},
  { name: "光明日报", tier: "central", officialUrl: "https://www.gmw.cn",
    aliases: [{ alias: "光明网", matchPattern: "gmw.cn" }] },
  { name: "经济日报", tier: "central", officialUrl: "https://www.ce.cn",
    aliases: [{ alias: "中国经济网", matchPattern: "ce.cn" }] },
  { name: "中国日报", tier: "central", officialUrl: "https://www.chinadaily.com.cn",
    aliases: [{ alias: "China Daily", matchPattern: "chinadaily.com.cn" }] },
  { name: "求是", tier: "central", officialUrl: "https://www.qstheory.cn",
    aliases: [{ alias: "求是网", matchPattern: "qstheory.cn" }] },
  { name: "中国青年报", tier: "central", officialUrl: "https://www.cyol.com",
    aliases: [{ alias: "中青在线", matchPattern: "cyol.com" }] },
];

// ─── 省/市级（重庆，7 家） ───
const MUNICIPAL: Seed[] = [
  { name: "重庆日报", tier: "provincial_municipal", province: "重庆市",
    officialUrl: "https://www.cqrb.cn" },
  { name: "华龙网", tier: "provincial_municipal", province: "重庆市",
    officialUrl: "https://www.cqnews.net",
    aliases: [{ alias: "华龙智库", matchPattern: "cqnews.net" }] },
  { name: "上游新闻", tier: "provincial_municipal", province: "重庆市",
    officialUrl: "https://www.cqcb.com",
    aliases: [{ alias: "重庆晨报", matchPattern: "cqcb.com" }] },
  { name: "第1眼新闻", tier: "provincial_municipal", province: "重庆市",
    officialUrl: "https://www.cbg.cn",
    aliases: [{ alias: "视界网", matchPattern: "cbg.cn" }] },
  { name: "重庆发布", tier: "provincial_municipal", province: "重庆市" },
  { name: "重庆商报", tier: "provincial_municipal", province: "重庆市" },
  { name: "美丽重庆", tier: "provincial_municipal", province: "重庆市" },
];

// ─── 行业级（6 家） ───
const INDUSTRY: Seed[] = [
  { name: "中国环境报", tier: "industry", industryTag: "环境",
    officialUrl: "https://www.cenews.com.cn" },
  { name: "中国能源报", tier: "industry", industryTag: "能源",
    officialUrl: "https://paper.people.com.cn/zgnyb" },
  { name: "健康报", tier: "industry", industryTag: "卫生健康",
    officialUrl: "https://www.jkb.com.cn" },
  { name: "农民日报", tier: "industry", industryTag: "三农",
    officialUrl: "https://www.farmer.com.cn" },
  { name: "科技日报", tier: "industry", industryTag: "科技",
    officialUrl: "https://www.stdaily.com" },
  { name: "中国水利报", tier: "industry", industryTag: "水利",
    officialUrl: "http://www.chinawater.com.cn" },
];

// ─── 区县融媒体（20 家，各区县一家示例） ───
const DISTRICT_MEDIA: Seed[] = [
  { name: "涪陵发布", tier: "district_media", districtName: "涪陵区" },
  { name: "渝中发布", tier: "district_media", districtName: "渝中区" },
  { name: "北碚发布", tier: "district_media", districtName: "北碚区" },
  { name: "两江新区报", tier: "district_media", districtName: "两江新区" },
  { name: "九龙坡发布", tier: "district_media", districtName: "九龙坡区" },
  { name: "沙坪坝发布", tier: "district_media", districtName: "沙坪坝区" },
  { name: "南岸发布", tier: "district_media", districtName: "南岸区" },
  { name: "大渡口发布", tier: "district_media", districtName: "大渡口区" },
  { name: "巴南发布", tier: "district_media", districtName: "巴南区" },
  { name: "万州融媒", tier: "district_media", districtName: "万州区" },
  { name: "璧山发布", tier: "district_media", districtName: "璧山区" },
  { name: "江津发布", tier: "district_media", districtName: "江津区" },
  { name: "永川发布", tier: "district_media", districtName: "永川区" },
  { name: "合川发布", tier: "district_media", districtName: "合川区" },
  { name: "铜梁发布", tier: "district_media", districtName: "铜梁区" },
  { name: "荣昌发布", tier: "district_media", districtName: "荣昌区" },
  { name: "大足发布", tier: "district_media", districtName: "大足区" },
  { name: "黔江发布", tier: "district_media", districtName: "黔江区" },
  { name: "长寿发布", tier: "district_media", districtName: "长寿区" },
  { name: "南川发布", tier: "district_media", districtName: "南川区" },
];

const ALL_OUTLETS: Seed[] = [...CENTRAL, ...MUNICIPAL, ...INDUSTRY, ...DISTRICT_MEDIA];

async function resolveSeedOrgId(): Promise<string> {
  if (process.env.SEED_ORG_ID) return process.env.SEED_ORG_ID;
  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (orgs.length === 0) {
    throw new Error("No organization found. Create one before seeding media outlets.");
  }
  return orgs[0].id;
}

export async function seedMediaOutlets() {
  const orgId = await resolveSeedOrgId();

  // Preload district name → id map
  const districts = await db.select().from(cqDistricts);
  const districtByName = new Map(districts.map((d) => [d.name, d.id]));

  let created = 0;
  let skipped = 0;

  for (const seed of ALL_OUTLETS) {
    const existing = await db.select().from(mediaOutlets)
      .where(and(
        eq(mediaOutlets.organizationId, orgId),
        eq(mediaOutlets.name, seed.name),
        eq(mediaOutlets.tier, seed.tier),
      )).limit(1);

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    const districtId = seed.districtName ? districtByName.get(seed.districtName) : undefined;
    if (seed.districtName && !districtId) {
      console.warn(`  ⚠ District not found: ${seed.districtName} for outlet ${seed.name}`);
    }

    const [outlet] = await db.insert(mediaOutlets).values({
      organizationId: orgId,
      name: seed.name,
      tier: seed.tier,
      province: seed.province,
      districtId,
      industryTag: seed.industryTag,
      officialUrl: seed.officialUrl,
    }).returning();

    if (seed.aliases?.length) {
      await db.insert(mediaOutletAliases).values(
        seed.aliases.map((a) => ({ outletId: outlet.id, ...a })),
      );
    }
    created += 1;
  }

  console.log(
    `✓ Seeded media outlets (new=${created}, skipped=${skipped}, total attempted=${ALL_OUTLETS.length}) (org=${orgId})`,
  );
}
