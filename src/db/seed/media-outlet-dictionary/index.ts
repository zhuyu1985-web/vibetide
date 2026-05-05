import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { CENTRAL_OUTLETS } from "./central";
import { INDUSTRY_OUTLETS } from "./industry";
import { CHONGQING_MUNICIPAL_OUTLETS } from "./chongqing-municipal";
import { CHONGQING_DISTRICT_OUTLETS } from "./chongqing-district";
import { CHONGQING_ECO_GOV_OUTLETS } from "./chongqing-eco-gov";

export const ALL_DEFAULT_OUTLETS = [
  ...CENTRAL_OUTLETS,
  ...INDUSTRY_OUTLETS,
  ...CHONGQING_MUNICIPAL_OUTLETS,
  ...CHONGQING_DISTRICT_OUTLETS,
  ...CHONGQING_ECO_GOV_OUTLETS,
];

export async function seedMediaOutletDictionary(orgId: string) {
  let inserted = 0;
  let skipped = 0;
  for (const outlet of ALL_DEFAULT_OUTLETS) {
    const result = await db
      .insert(mediaOutletDictionary)
      .values({ ...outlet, organizationId: orgId })
      .onConflictDoNothing({
        target: [
          mediaOutletDictionary.organizationId,
          mediaOutletDictionary.outletName,
        ],
      })
      .returning({ id: mediaOutletDictionary.id });
    if (result.length > 0) inserted++;
    else skipped++;
  }
  return { inserted, skipped, total: ALL_DEFAULT_OUTLETS.length };
}
