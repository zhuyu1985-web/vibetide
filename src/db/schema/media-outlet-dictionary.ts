import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";
import type { Channel } from "@/lib/media-outlet/channels";

export const mediaOutletDictionary = pgTable(
  "media_outlet_dictionary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    outletName: text("outlet_name").notNull(),
    /** 集团/母公司,如"人民日报社" → 旗下"人民日报"/"人民网"/"人民视频"... 多个 outlet 共用此 group。
     *  M1 引入,用于"按集团聚合"展示;nullable。 */
    groupName: text("group_name"),
    outletTier: text("outlet_tier").notNull(),
    outletRegion: text("outlet_region"),
    outletDistrict: text("outlet_district"),
    industryTag: text("industry_tag"),

    /** 该 outlet 在各平台上的账号矩阵 — discriminated union by channel.type。
     *  M1 引入,GIN 索引 channels_gin 用于按 ghid/secUid/uid/userId/domain 反查 outlet。
     *  类型定义在 @/lib/media-outlet/channels。 */
    channels: jsonb("channels").$type<Channel[]>().notNull().default(sql`'[]'::jsonb`),

    /** @deprecated M1 迁移后保留 1-2 个 sprint 再删,旧字段已下沉到 channels[type=website].domain */
    domains: text("domains").array(),
    /** @deprecated M1 迁移后保留 1-2 个 sprint 再删,旧字段已下沉到 channels[type=wechat_oa].name */
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
    /** @deprecated 与 domains/publicAccountNames 字段同期清理 */
    domainsGin: index("media_outlet_dictionary_domains_gin").using(
      "gin",
      t.domains,
    ),
    /** @deprecated */
    publicAccountsGin: index("media_outlet_dictionary_pa_gin").using(
      "gin",
      t.publicAccountNames,
    ),
    groupNameIdx: index("media_outlet_dictionary_group_idx").on(
      t.organizationId,
      t.groupName,
    ),
    /** 关键索引 — 按账号标识反查 outlet (M3 tikhub account-mode 启动时校验) */
    channelsGin: index("media_outlet_dictionary_channels_gin").using(
      "gin",
      sql`${t.channels} jsonb_path_ops`,
    ),
  }),
);

export type MediaOutletRow = typeof mediaOutletDictionary.$inferSelect;
export type MediaOutletInsert = typeof mediaOutletDictionary.$inferInsert;
