import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

export interface RecognizableItem {
  canonicalUrl?: string | null;
  rawMetadata?: Record<string, unknown> | null;
}

export interface RecognizableSource {
  outletId: string | null;
  defaultOutletTier: string | null;
  defaultOutletRegion: string | null;
}

export interface RecognizedOutlet {
  outletId: string | null;
  outletTier: string | null;
  outletRegion: string | null;
}

export function recognizeOutlet(
  item: RecognizableItem,
  source: RecognizableSource,
  dict: MediaOutletRow[],
): RecognizedOutlet | null {
  // 1. source.outletId 已配置
  if (source.outletId) {
    const outlet = dict.find((o) => o.id === source.outletId);
    if (outlet) {
      return { outletId: outlet.id, outletTier: outlet.outletTier, outletRegion: outlet.outletRegion };
    }
  }

  // 2. URL host 匹配 dict.domains
  if (item.canonicalUrl) {
    try {
      const host = new URL(item.canonicalUrl).hostname.toLowerCase();
      const matched = dict.find((o) =>
        (o.domains ?? []).some((d) => {
          const lower = d.toLowerCase();
          return host === lower || host.endsWith("." + lower);
        }),
      );
      if (matched) {
        return { outletId: matched.id, outletTier: matched.outletTier, outletRegion: matched.outletRegion };
      }
    } catch {
      // invalid URL, fall through
    }
  }

  // 3. publicAccountName 命中
  const meta = item.rawMetadata ?? {};
  const accountName =
    (meta as { publicAccountName?: string }).publicAccountName ??
    (meta as { author?: string }).author;
  if (accountName) {
    const matched = dict.find((o) => (o.publicAccountNames ?? []).includes(accountName));
    if (matched) {
      return { outletId: matched.id, outletTier: matched.outletTier, outletRegion: matched.outletRegion };
    }
  }

  // 4. source.default_* 兜底
  if (source.defaultOutletTier || source.defaultOutletRegion) {
    return { outletId: null, outletTier: source.defaultOutletTier, outletRegion: source.defaultOutletRegion };
  }

  // 5. 不命中
  return null;
}
