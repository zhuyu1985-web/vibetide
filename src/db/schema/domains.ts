import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";

/**
 * domains —— 受控字典表（「领域一等维度」P1）
 *
 * 把"领域"（财经 / 体育 / 时政 ...）提升为一等维度。每条领域记录除了名称外，
 * 还携带一个「口径包」：执行时差异化的真正载体。
 *  - promptGuidance：注入 Layer 4.5（领域口径 / 专业术语 / 报道禁忌）
 *  - authoritySources：权威源域名白名单 → 传给 web_search 的 includeDomains
 *
 * 后续 task 会给 ai_employees 加 domain_id 外键引用 domains.id。
 */
export const domains = pgTable(
  "domains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    slug: text("slug").notNull(), // "finance" / "sports" / "politics"
    name: text("name").notNull(), // 财经 / 体育 / 时政
    description: text("description"),
    // 领域口径包 —— 执行时差异化的真正载体
    promptGuidance: text("prompt_guidance"), // 注入 Layer 4.5（口径/术语/禁忌）
    authoritySources: jsonb("authority_sources")
      .$type<string[]>()
      .default([]), // 权威源域名白名单 → web_search includeDomains
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    orgSlugUidx: uniqueIndex("domains_org_slug_uidx").on(
      t.organizationId,
      t.slug,
    ),
  }),
);
