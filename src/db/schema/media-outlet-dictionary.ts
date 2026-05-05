import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";

export const mediaOutletDictionary = pgTable(
  "media_outlet_dictionary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    outletName: text("outlet_name").notNull(),
    outletTier: text("outlet_tier").notNull(),
    outletRegion: text("outlet_region"),
    outletDistrict: text("outlet_district"),
    industryTag: text("industry_tag"),
    domains: text("domains").array(),
    publicAccountNames: text("public_account_names").array(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueOrgName: unique("media_outlet_dictionary_org_name_unique").on(
      t.organizationId,
      t.outletName,
    ),
    tierIdx: index("media_outlet_dictionary_tier_idx").on(
      t.organizationId,
      t.outletTier,
      t.isActive,
    ),
    regionIdx: index("media_outlet_dictionary_region_idx").on(
      t.organizationId,
      t.outletRegion,
    ),
    domainsGin: index("media_outlet_dictionary_domains_gin").using(
      "gin",
      t.domains,
    ),
    publicAccountsGin: index("media_outlet_dictionary_pa_gin").using(
      "gin",
      t.publicAccountNames,
    ),
  }),
);

export type MediaOutletRow = typeof mediaOutletDictionary.$inferSelect;
export type MediaOutletInsert = typeof mediaOutletDictionary.$inferInsert;
