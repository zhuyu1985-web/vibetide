import { describe, expect, it } from "vitest";
import { recognizeOutlet } from "../outlet-recognizer";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

const dict: MediaOutletRow[] = [
  { id: "11111111-1111-1111-1111-111111111111", organizationId: "org-a", outletName: "人民日报", outletTier: "central", outletRegion: "全国", outletDistrict: null, industryTag: null, domains: ["people.com.cn", "paper.people.com.cn"], publicAccountNames: ["人民日报"], description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() } as MediaOutletRow,
  { id: "22222222-2222-2222-2222-222222222222", organizationId: "org-a", outletName: "中国环境报", outletTier: "industry", outletRegion: null, outletDistrict: null, industryTag: "环境", domains: ["cenews.com.cn"], publicAccountNames: ["中国环境"], description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() } as MediaOutletRow,
  { id: "33333333-3333-3333-3333-333333333333", organizationId: "org-a", outletName: "重庆日报", outletTier: "provincial_municipal", outletRegion: "重庆", outletDistrict: null, industryTag: null, domains: ["cqrb.cn"], publicAccountNames: ["重庆日报"], description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() } as MediaOutletRow,
  { id: "44444444-4444-4444-4444-444444444444", organizationId: "org-a", outletName: "涪陵发布", outletTier: "district_media", outletRegion: "重庆", outletDistrict: "涪陵区", industryTag: null, domains: [], publicAccountNames: ["涪陵发布"], description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() } as MediaOutletRow,
];

describe("recognizeOutlet 优先级链", () => {
  it("优先级 1：source.outletId 已配置 → 直接用", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://anything-else.com/article" },
      { outletId: dict[0]!.id, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[0]!.id);
    expect(r?.outletTier).toBe("central");
    expect(r?.outletRegion).toBe("全国");
  });

  it("优先级 2：URL host 命中 dict.domains（精确）", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://people.com.cn/article/2025" },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[0]!.id);
  });

  it("优先级 2：URL host 命中 dict.domains（子域名）", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://paper.people.com.cn/rmrb/2025-12-01.html" },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[0]!.id);
  });

  it("优先级 3：rawMetadata.publicAccountName 命中", () => {
    const r = recognizeOutlet(
      { canonicalUrl: null, rawMetadata: { publicAccountName: "涪陵发布" } },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[3]!.id);
    expect(r?.outletTier).toBe("district_media");
  });

  it("优先级 3：rawMetadata.author 也命中（fallback）", () => {
    const r = recognizeOutlet(
      { canonicalUrl: null, rawMetadata: { author: "中国环境" } },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[1]!.id);
  });

  it("优先级 4：都不命中 + source.default_* 兜底", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://unknown-site.com" },
      { outletId: null, defaultOutletTier: "central", defaultOutletRegion: "全国" },
      dict,
    );
    expect(r?.outletId).toBeNull();
    expect(r?.outletTier).toBe("central");
    expect(r?.outletRegion).toBe("全国");
  });

  it("优先级 5：全部不命中 → null", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://unknown-site.com" },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r).toBeNull();
  });

  it("无效 URL 不抛异常", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "not-a-url" },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r).toBeNull();
  });
});
